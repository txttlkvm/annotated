#!/usr/bin/env node
// Test harness — replays the diarized transcript through the same prompts/gates
// the live app uses, then writes results to JSON for analysis. Reads:
//   - eval/sabi-utts.json (Deepgram-diarized utterances)
//   - pickleglass_web/.env.local (API keys)
// Imports prompts + silenceGate from the live source so the harness stays in sync.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const webRoot = path.join(repoRoot, 'pickleglass_web')

// ── Env ───────────────────────────────────────────────────────────────────
const env = await fs.readFile(path.join(webRoot, '.env.local'), 'utf-8')
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] ||= m[2].replace(/^["']|["']$/g, '')
}
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GROQ_API_KEY   = process.env.GROQ_API_KEY
if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing')
if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY missing')

// ── Load prompts (TypeScript source, parsed by hand to avoid TS toolchain) ──
async function loadPrompt(name) {
  const txt = await fs.readFile(path.join(webRoot, 'lib', 'prompts.ts'), 'utf-8')
  const m = txt.match(new RegExp(`export const ${name} = \`([\\s\\S]*?)\``))
  if (!m) throw new Error(`prompt ${name} not found`)
  return m[1]
}
const FACT_CHECKER_SYSTEM = await loadPrompt('FACT_CHECKER_SYSTEM')
const CYNIC_SYSTEM        = await loadPrompt('CYNIC_SYSTEM')

// ── Replicate shouldFire / dedupe (kept tiny — must match silenceGate.ts) ──
const ENTITY_RE = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b|\b[A-Z][a-z]{2,}[A-Z][a-zA-Z]+\b|(?<=\S\s+)[A-Z][a-z]{3,}\b/
const CLAIM_RE  = /\$[\d,.]+\s?[MBK]?|\d+(\.\d+)?%|\d+\s?(million|billion|thousand|trillion|percent|dollars)\b|\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|million|billion|trillion)\s+(million|billion|thousand|trillion|percent|dollars|bucks|hundred)\b|\b(19|20)\d{2}\b/i
const ATTRIBUTION_RE = /\b(said|claimed|according|announced|confirmed|reported|stated|argued|denied|admitted|alleged|accused|criticized|praised|endorsed|told|tells|wrote|writes|tweeted|posted|warned|threatened|promised|pledged|predicted|estimated|suggested|believed|expected|thought|knew|founded|raised|launched|released|shipped|acquired|bought|sold|merged|spun|invested|funded|backed|valued|priced|signed|approved|rejected|vetoed|passed|voted|appointed|named|elected|won|lost|beat|defeated|fired|hired|laid|cut|joined|left|quit|resigned|stepped|sued|banned|charged|indicted|convicted|sentenced|ruled|dismissed|settled|filed|leaked|revealed|exposed|disclosed|invented|developed|built|created|started|killed|attacked|defended|opposed|supported)\b/i
const ASSERTION_RE = /\b(always|never|only|every|all|none|most|proves|shows|means|causes|because|biggest|largest|best|worst|first|leading|top|fastest|highest|lowest|impossible|guaranteed|certain|definitively|actually|literally|basically|exactly|honestly|clearly|obviously|definitely|probably|likely|unlikely|more|less|better|worse|bigger|smaller|earlier|later|already|still|yet|now|today|currently|recently|soon|quickly|slowly)\b/i
const FILLER_RE = /\b(thing|stuff|it|someone|whatever|something|anything)\b/i
const THIRD_PARTY_RE = /\b(he|she|they|him|her|them|his|hers|their|theirs)\b/i

function shouldFire(s) {
  const words = s.trim().split(/\s+/)
  if (words.length < 6) return false
  const hasEntity = ENTITY_RE.test(s), hasClaim = CLAIM_RE.test(s)
  const hasAttribution = ATTRIBUTION_RE.test(s), hasAssertion = ASSERTION_RE.test(s)
  const hasFiller = FILLER_RE.test(s), hasThirdParty = THIRD_PARTY_RE.test(s)
  if (hasAttribution && (hasEntity || hasThirdParty)) return true
  if (hasEntity || hasClaim) return true
  if (!hasAttribution && hasAssertion && hasFiller) return false
  if ((hasAttribution || hasAssertion) && !hasFiller) return true
  return false
}

// ── Vertex redirect resolver (parallel) ────────────────────────────────────
async function resolveRedirect(url, ms = 2500) {
  if (!url || !url.includes('vertexaisearch.cloud.google.com')) return url
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal })
    return r?.url || url
  } catch { return url }
  finally { clearTimeout(t) }
}

// ── Gemini caller (with grounding) ─────────────────────────────────────────
async function callGemini(prompt, useSearch, maxTokens = 700) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
    ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
  }
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) {
    return { text: '~', groundedUrls: [], err: `HTTP ${res.status}` }
  }
  const data = await res.json()
  const cand = data.candidates?.[0] ?? {}
  const text = (cand.content?.parts ?? []).map(p => p.text ?? '').join('').trim()
  const chunks = cand.groundingMetadata?.groundingChunks ?? []
  const raw = chunks.map(c => c?.web?.uri).filter(u => typeof u === 'string')
  const resolved = await Promise.all(raw.map(resolveRedirect))
  const seen = new Set(), groundedUrls = []
  for (const u of resolved) { if (u && !seen.has(u)) { seen.add(u); groundedUrls.push(u) } }
  return { text: text || '~', groundedUrls }
}

// ── Groq Cynic caller ──────────────────────────────────────────────────────
async function callGroqCynic(system, context, newChunk) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: `Context (recent conversation):\n${context}\n\nNew segment to evaluate:\n${newChunk}` },
      ],
      temperature: 0.3,
      max_tokens: 250,
    }),
  })
  if (!res.ok) return '~'
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? '~'
}

// ── Lightweight FC parser ──────────────────────────────────────────────────
const META_PATTERNS = [
  'no primary source','no further information','no readily available','not readily available','not readily found',
  'no information is provided','not enough information','no specific information','no specific data','no specific claim',
  'no verifiable','no checkable','cannot be verified','cannot be confirmed','cannot be fact-checked','cannot be determined',
  'cannot determine','could not be verified','could not be confirmed','could not be found','could not confirm','could not verify',
  'unable to verify','unable to confirm','unable to find','is not provided','is not specified','is not available',
  'no information found','no record','no public record','no evidence to support','is not yet documented',
  'context does not','context doesn','context provided','context offers','context offer','the provided context',
  'the speaker states','the speaker mentions','the speaker says','the speaker is referring',
  'no claim to verify','nothing to verify','no factual claim','no checkable claim','mid-thought','fragment',
]

function parseFC(raw) {
  if (!raw || raw.trim() === '~') return null
  const verdict  = (raw.match(/^VERDICT:\s*(CONFIRMED|UNCONFIRMED|CORRECTED)/m) || [])[1] || 'UNCONFIRMED'
  const claim    = (raw.match(/^CLAIM:\s*(.+)$/m) || [])[1]?.trim() || ''
  const fact     = (raw.match(/^FACT:\s*(.+)$/m) || [])[1]?.trim() || ''
  const sources  = [...raw.matchAll(/^SOURCES?:\s*(https?:\/\/\S+)/gm)].map(m => m[1].replace(/[)\]"'>]+$/, '')).filter(u => /^https?:\/\//.test(u))
  if (!claim && !fact) return null
  // Filter meta-narration UNCONFIRMED — same as live parseFCResponse.ts
  if (verdict === 'UNCONFIRMED') {
    const meta = (fact + ' ' + claim).toLowerCase()
    if (META_PATTERNS.some(p => meta.includes(p))) return null
  }
  return { verdict, claim, fact, sources }
}
function parseCynic(raw) {
  if (!raw || raw.trim() === '~') return null
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.some(l => /^FRAMING\b/i.test(l))) return null
  const idx = lines.findIndex(l => /^FRAMING\b/i.test(l))
  return {
    label:    lines[idx + 1] || '',
    punch:    lines[idx + 2] || '',
    counter:  (lines[idx + 3] || '').replace(/^COUNTER:\s*/i, ''),
  }
}

// ── Coalescing — same as page.tsx (>=25 words ending in punctuation) ──────
async function main() {
  const utts = JSON.parse(await fs.readFile(path.join(here, 'sabi-utts.json'), 'utf-8'))
  const results = []
  let buffer = []
  let bufferStartIdx = 0

  function flushBuffer() {
    if (!buffer.length) return null
    const text = buffer.map(u => u.text).join(' ').trim()
    const speaker = buffer[0].speaker
    const start = buffer[0].start
    const out = { speaker, start, idx: bufferStartIdx, text }
    buffer = []
    return out
  }

  // Build a list of triggers (coalesced utterances ready for FC eval)
  const triggers = []
  for (let i = 0; i < utts.length; i++) {
    const u = utts[i]
    if (!buffer.length) bufferStartIdx = i
    buffer.push(u)
    const merged = buffer.map(x => x.text).join(' ').trim()
    if (/[.!?]$/.test(merged) && merged.split(/\s+/).length >= 25) {
      triggers.push(flushBuffer())
    }
  }
  if (buffer.length) triggers.push(flushBuffer())

  console.log(`Coalesced ${utts.length} utterances → ${triggers.length} triggers`)

  // Run FC + Cynic in parallel per trigger, with rolling context window
  const ROLL_WINDOW = 8 // last 8 triggers as context
  for (let i = 0; i < triggers.length; i++) {
    const t = triggers[i]
    const gate = shouldFire(t.text)
    const context = triggers.slice(Math.max(0, i - ROLL_WINDOW), i).map(x => `[S${x.speaker}] ${x.text}`).join('\n')

    let fc = null, cy = null, fcRaw = null, cyRaw = null, cyRawGroq = null, cyRawGemini = null, cyWinner = null, fcGrounded = []
    if (gate) {
      const fcPromise = callGemini(
        `${FACT_CHECKER_SYSTEM}\n\nContext (recent conversation):\n${context}\n\nNew segment to evaluate:\n${t.text}`,
        true, 700,
      )
      // Cynic — fire BOTH Groq and Gemini in parallel like the live app does.
      // raceValid picks the first non-~ result; if both return ~, no card.
      const cyGroqP = callGroqCynic(CYNIC_SYSTEM, context, t.text)
      const cyGemP  = callGemini(
        `${CYNIC_SYSTEM}\n\nContext (recent conversation):\n${context}\n\nNew segment to evaluate:\n${t.text}`,
        false, 250,
      ).then(r => r.text)
      const [fcRes, gqText, gemText] = await Promise.all([fcPromise, cyGroqP, cyGemP])
      fcRaw = fcRes.text; fcGrounded = fcRes.groundedUrls
      cyRawGroq = gqText
      cyRawGemini = gemText
      // Race-valid: first non-~ wins
      cyRaw = (gqText && gqText.trim() !== '~') ? gqText
            : (gemText && gemText.trim() !== '~') ? gemText
            : '~'
      cyWinner = (gqText && gqText.trim() !== '~') ? 'groq'
               : (gemText && gemText.trim() !== '~') ? 'gemini'
               : 'none'
      fc = parseFC(fcRaw)
      cy = parseCynic(cyRaw)
    }
    results.push({
      idx: i, time: t.start, speaker: t.speaker, gate, text: t.text,
      fc, cy, fcRaw, cyRaw, cyRawGroq, cyRawGemini, cyWinner, fcGrounded,
    })
    process.stdout.write(`[${i+1}/${triggers.length}] ${gate ? '◆' : '·'} ${fc ? `FC=${fc.verdict}` : '   '} ${cy ? 'CY' : '  '}  S${t.speaker} t=${Math.floor(t.start)}s  ${t.text.slice(0,80)}\n`)
  }

  await fs.writeFile(path.join(here, 'sabi-results.json'), JSON.stringify(results, null, 2))
  console.log(`\nWrote ${results.length} results → eval/sabi-results.json`)

  // Quick stats
  const fired = results.filter(r => r.fc).length
  const cyFired = results.filter(r => r.cy).length
  const verdicts = {}
  for (const r of results.filter(r => r.fc)) verdicts[r.fc.verdict] = (verdicts[r.fc.verdict] || 0) + 1
  console.log(`FC fires: ${fired}  Cynic fires: ${cyFired}  Verdicts:`, verdicts)
}

main().catch(e => { console.error('FAIL:', e); process.exit(1) })
