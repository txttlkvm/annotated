import type { Verdict } from '@/types/overlay'

export interface ParsedFC {
  verdict: Verdict
  comment: string   // FACT line — the truth (≤15 words)
  claim: string     // CLAIM line — what speaker said
  urls: string[]
}

/**
 * Parse structured FC response:
 *   CLAIM:   [resolved entity + claimed fact]
 *   VERDICT: CONFIRMED | CORRECTED | UNCONFIRMED
 *   FACT:    [true fact ≤15 words]
 *   SOURCE:  [single URL]
 *
 * Tolerates partial output and freeform fallback.
 */
export function parseFCResponse(raw: string): ParsedFC | null {
  if (!raw || raw.trim() === '~') return null

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)

  let verdict: Verdict = 'UNCONFIRMED'
  let comment = ''
  let claim = ''
  const urls: string[] = []

  for (const line of lines) {
    if (line.startsWith('VERDICT:')) {
      const v = line.replace('VERDICT:', '').trim().toUpperCase()
      if (v === 'CONFIRMED' || v === 'CORRECTED' || v === 'UNCONFIRMED') {
        verdict = v as Verdict
      }
    } else if (line.startsWith('FACT:')) {
      comment = line.replace('FACT:', '').trim()
    } else if (line.startsWith('CLAIM:')) {
      claim = line.replace('CLAIM:', '').trim()
    } else if (line.startsWith('SOURCES:') || line.startsWith('SOURCE:')) {
      const u = line.replace(/^SOURCES?:\s*/i, '').trim()
      if (/^https?:\/\//i.test(u)) urls.push(u.replace(/[)\]"'>]+$/, ''))
    } else if (/^https?:\/\//i.test(line)) {
      const clean = line.replace(/[)\]"'>]+$/, '')
      if (clean.length > 12) urls.push(clean)
    }
  }

  // Reject "empty" UNCONFIRMED — when the model has nothing to say it shouldn't fire a card
  const cleanComment = comment.replace(/^~+\s*$/, '').trim()
  const cleanClaim   = claim.replace(/^~+\s*$/, '').trim()
  if (!cleanComment && !cleanClaim && urls.length === 0) return null
  if (verdict === 'UNCONFIRMED' && !cleanComment && !cleanClaim && urls.length === 0) return null
  comment = cleanComment
  claim = cleanClaim

  // Reject "meta-commentary" UNCONFIRMED — when the model is just narrating
  // why it can't fact-check instead of saying ~. These produce noise cards
  // like "The speaker states X but no further information is provided".
  if (verdict === 'UNCONFIRMED') {
    const meta = comment.toLowerCase()
    const metaPatterns = [
      'no primary source',
      'no further information',
      'no readily available',
      'not readily available',
      'not readily found',
      'no information is provided',
      'not enough information',
      'no specific information',
      'no specific data',
      'no specific claim',
      'no verifiable',
      'no checkable',
      'cannot be verified',
      'cannot be confirmed',
      'cannot be fact-checked',
      'cannot be determined',
      'cannot determine',
      'could not be verified',
      'could not be confirmed',
      'could not be found',
      'could not confirm',
      'could not verify',
      'unable to verify',
      'unable to confirm',
      'unable to find',
      'is not provided',
      'is not specified',
      'is not available',
      'no information found',
      'no record',
      'no public record',
      'no evidence to support',
      'is not yet documented',
      'no credible reporting',
      'no such incident',
      'no such event',
      'no incident at',
      'no shooting at',
      'no record of an',
      'no record of a',
      'did not occur',
      'has not occurred',
      'never happened',
      'context does not',
      'context doesn',
      'context provided',
      'context offers',
      'context offer',   // catches "doesn't offer"
      'the provided context',
      'the speaker states',
      'the speaker mentions',
      'the speaker says',
      'the speaker is referring',
      'no claim to verify',
      'nothing to verify',
      'no factual claim',
      'no checkable claim',
      'mid-thought',
      'fragment',
    ]
    if (metaPatterns.some(p => meta.includes(p))) return null
  }

  // Event-denial filter — applies to ANY verdict. If the FACT line denies
  // an event happened ("no incident at...", "no such event"), suppress the
  // card entirely. The speaker may be referencing a real recent event the
  // model simply couldn't find via search; asserting it didn't happen is
  // worse than silence.
  const denial = comment.toLowerCase()
  const denialPatterns = [
    'no credible reporting',
    'no credible evidence',
    'no credible source',
    'no public record',
    'no such incident',
    'no such event',
    'no incident at',
    'no incident occurred',
    'no shooting at',
    'no shooting occurred',
    'no record of any',
    'did not occur',
    'has not occurred',
    'never happened',
    'no evidence the',
    'no evidence of any',
    'no evidence that',
    'no evidence to support',
    'no reporting that',
    'no reporting confirming',
    'fabricated event',
    'fabricated incident',
    'is not a real event',
    'has not pardoned',
    'has not been pardoned',
  ]
  if (denialPatterns.some(p => denial.includes(p))) return null

  // Freeform fallback: sniff verdict + extract URLs
  if (!comment) {
    const lower = raw.toLowerCase()
    if (lower.includes('confirmed')) verdict = 'CONFIRMED'
    else if (lower.includes('corrected') || lower.includes('incorrect') || lower.includes('false')) verdict = 'CORRECTED'
    const urlMatches = raw.match(/https?:\/\/[^\s\])"'>]+/g) ?? []
    urls.push(...urlMatches.slice(0, 3).map(u => u.replace(/[)\]"'>]+$/, '')))
    // Use first complete sentence as comment, not a raw mid-word slice
    const firstSentence = raw.match(/[^.!?\n]{10,}[.!?]/)
    comment = firstSentence ? firstSentence[0].trim() : raw.replace(/\n+/g, ' ').trim()
  }

  const deduped = urls.filter((u, i, a) => a.indexOf(u) === i)
  // Trim at word boundary to avoid mid-word cuts
  function trimWords(s: string, max: number): string {
    if (s.length <= max) return s
    const cut = s.slice(0, max)
    const lastSpace = cut.lastIndexOf(' ')
    return (lastSpace > max * 0.7 ? cut.slice(0, lastSpace) : cut) + '…'
  }
  return {
    verdict,
    comment: trimWords(comment, 300),
    claim: trimWords(claim, 150),
    urls: deduped.slice(0, 3),
  }
}

/**
 * Parse cynic 4-line response:
 *   FRAMING
 *   [fallacy label ≤4 words]
 *   [punch line ≤12 words]
 *   COUNTER: [opposing view / counterexample ≤25 words]
 */
export interface ParsedCY {
  fallacyLabel: string
  punchLine: string
  counter?: string
}

export function parseCYResponse(raw: string): ParsedCY | null {
  if (!raw || raw.trim() === '~') return null

  // Handle slash-separated single-line format Groq sometimes emits:
  //   "(FRAMING / Survivorship Bias / Ignoring failed startups.)"
  //   "FRAMING / Causal link / Because X happened Y must follow."
  const trimmed = raw.trim().replace(/^\(|\)$/g, '') // strip outer parens
  if (!trimmed.includes('\n') && trimmed.includes(' / ')) {
    const parts = trimmed.split(' / ').map(s => s.trim())
    if (parts.length >= 3 && parts[0].toUpperCase() === 'FRAMING') {
      return { fallacyLabel: parts[1], punchLine: parts[2], counter: parts[3] }
    }
    if (parts.length >= 2) {
      return { fallacyLabel: parts[0], punchLine: parts.slice(1).join(' / ') }
    }
  }

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return null

  const start = lines[0].toUpperCase() === 'FRAMING' ? 1 : 0
  const remaining = lines.length - start

  // Single-line cynic responses (LLM ignored the 4-line spec) — still show
  // the user something rather than silently dropping. Use a generic label.
  if (remaining === 1) {
    return { fallacyLabel: 'CYNIC', punchLine: lines[start] }
  }

  // Two-line: assume label + punch, no counter
  if (remaining < 2) return null

  const fallacyLabel = lines[start]
  const punchLine = lines[start + 1] ?? ''

  // Extract COUNTER: line (may or may not be present)
  let counter: string | undefined
  for (let i = start + 2; i < lines.length; i++) {
    const l = lines[i]
    if (l.toUpperCase().startsWith('COUNTER:')) {
      counter = l.replace(/^COUNTER:\s*/i, '').trim()
    } else if (!counter && i === start + 2) {
      // Line 4 without prefix — treat as counter
      counter = l
    }
  }

  return { fallacyLabel, punchLine, counter }
}
