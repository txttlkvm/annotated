'use client'
// Debug helper — uses the working window.api.debug.log IPC channel
const dbg = (msg: string) => {
  try {
    const api = (window as any).api?.debug
    if (api?.log) api.log(`[overlay] ${msg}`)
    // eslint-disable-next-line no-console
    console.log('[overlay]', msg)
  } catch (_) { /* no-op */ }
}
import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { OverlayPanel } from '@/components/OverlayPanel'
import { appendToBuffer, getBuffer } from '@/lib/buffer'
import { shouldFire, canFireFC, canFireCynic, recordFCFire, recordCynicFire } from '@/lib/silenceGate'
import { firePersonas } from '@/lib/personas'
import { parseFCResponse, parseCYResponse } from '@/lib/parseFCResponse'
import { fetchCitations } from '@/lib/citations'
import {
  createSession, endSession, setSessionPublic,
  writeCard, updateCardReactions, updateCardBookmark, publishCard,
} from '@/lib/supabaseWrite'
import { KNOWN_SPEAKER_NAMES } from '@/lib/deepgram'
import type { Card, TranscriptLine } from '@/types/overlay'

type SessionMode = 'idle' | 'live' | 'paused' | 'ended'

// ── Speaker name auto-detection ─────────────────────────────────────────────
// Self-intro: "I'm X", "this is X", "X here", "name's X", "joining us is X",
// "welcome X", "say hi to X", "with us today is X"
const SELF_INTRO_RE = /\b(?:i'm|i am|this is|hey i'm|hi i'm|it's|my name is|name's|name is)\s+([a-z]+)/i
const HERE_INTRO_RE = /\b([a-z]+)\s+here\b/i
const JOINING_RE    = /\b(?:joining us(?:\s+today)?(?:\s+is|\s+are)?|with us(?:\s+today)?(?:\s+is|\s+are)?|welcome(?:\s+back)?|say hi to)\s+([a-z]+)/i
// Address patterns:
//   "X, what do you think"     — X[,\s]+verb
//   "thanks Jason for that"    — thanks/appreciate X
//   "great point Lon"          — adjective + X at end
//   "...alright Alex"          — alright/ok/yeah/so + X at end
//   "back to you, Jason"       — back to you X
//   "..., Oliver."             — comma + X + sentence-end
const ADDRESS_RE = /\b([A-Z][a-z]{2,})[,\s]+(?:what|how|do|did|can|could|would|are|is|I|yeah|right|so|but|tell|talk|take)\b/
const THANKS_RE  = /\b(?:thanks|thank you|appreciate|appreciate it|love it|good one|nice|great|awesome|exactly|amen)[,\s]+([A-Z][a-z]{2,})\b/
const ALRIGHT_RE = /\b(?:alright|alrighty|okay|ok|so|now|hey|yo|um|uh|well|listen)[,\s]+([A-Z][a-z]{2,})\b/i
const BACKTOYOU_RE = /\b(?:back to you|over to you|take it away|go ahead)[,\s]+([A-Z][a-z]{2,})\b/i
const TAIL_RE    = /,\s+([A-Z][a-z]{2,})\s*[.!?]?$/   // "...., Jason." / "...., Oliver?"

function detectSpeakerName(text: string): string | null {
  // Try the strongest patterns first
  for (const re of [SELF_INTRO_RE, JOINING_RE, HERE_INTRO_RE]) {
    const m = text.match(re)
    if (m) {
      const candidate = m[1].toLowerCase()
      if (KNOWN_SPEAKER_NAMES[candidate]) return KNOWN_SPEAKER_NAMES[candidate]
    }
  }
  return null
}

function resolveAddressedName(text: string): string | null {
  for (const re of [BACKTOYOU_RE, THANKS_RE, ALRIGHT_RE, ADDRESS_RE, TAIL_RE]) {
    const m = text.match(re)
    if (m) {
      const candidate = m[1].toLowerCase()
      if (KNOWN_SPEAKER_NAMES[candidate]) return KNOWN_SPEAKER_NAMES[candidate]
    }
  }
  return null
}

// Scan first 6 words for a known name (sentence-initial position = likely the speaking host)
function scanInitialTokens(text: string): string | null {
  const tokens = text.trim().split(/\s+/).slice(0, 6)
  for (const token of tokens) {
    const clean = token.toLowerCase().replace(/[^a-z]/g, '')
    if (clean.length >= 3 && KNOWN_SPEAKER_NAMES[clean]) {
      return KNOWN_SPEAKER_NAMES[clean]
    }
  }
  return null
}

function formatElapsed(sessionStart: number): string {
  const s = Math.floor((Date.now() - sessionStart) / 1000)
  const h = Math.floor(s / 3600).toString().padStart(2, '0')
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${h}:${m}:${sec}`
}

function OverlayInner() {
  const searchParams = useSearchParams()
  const isOBS = searchParams.get('obs') === 'true'

  // ── UI state ────────────────────────────────────────────────────────────
  const [lines, setLines] = useState<TranscriptLine[]>([])
  // True briefly while firePersonas is in flight — drives the "thinking…"
  // indicator so the user sees the system is attentive even when both FC
  // and Cynic LLMs return empty.
  const [isThinking, setIsThinking] = useState(false)
  const [cards, setCards] = useState<Record<string, Card>>({})
  const [interimText, setInterimText] = useState('')
  const [interimSpeaker, setInterimSpeaker] = useState('')
  // True for ~1.5s after the most recent Speechmatics partial. Drives a
  // small "● Listening" dot so the user knows the system is hearing them
  // during long monologues where finals don't commit until a pause.
  const [isHearingAudio, setIsHearingAudio] = useState(false)
  const hearingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pulsingId, setPulsingId] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [speaker, setSpeaker] = useState('')
  const [topic] = useState('')
  const [sessionMode, setSessionMode] = useState<SessionMode>('idle')

  // ── Refs ────────────────────────────────────────────────────────────────
  const sessionStartTime = useRef(Date.now())
  const lineIdCounter = useRef(0)

  // Hard cap on transcript lines retained in renderer state. 500 is plenty for
  // a multi-hour session of visible scroll-back; older lines roll off to keep
  // memory bounded. (Each line + card structure is a few hundred bytes;
  // unbounded growth was responsible for >1GB renderer footprint over time.)
  const MAX_LINES = 500

  // Utterance coalescer: Speechmatics emits short partial-finals every few
  // words. Without buffering, the fact-checker fires on each fragment ("WHY
  // omitting personnel costs") instead of the complete thought. We accumulate
  // consecutive same-speaker finals and fire FC on the FIRST trigger that
  // hits any of: (a) sentence end + ≥12 words, (b) 2s of silence after the
  // last final, (c) buffer is older than 7s — whichever comes first.
  // Was 25 words + 5s silence, which made cards fire 15-20s late on live
  // podcast speech where speakers ramble before a sentence end.
  const utteranceBufferRef = useRef<{
    speakerId: number
    text: string
    lineIds: string[]
    flushTimer: ReturnType<typeof setTimeout> | null
    firstStartedAt: number
  } | null>(null)
  // Reduced from (2000ms, 7000ms, 12 words) to fire FC more often. The model
  // can absorb shorter triggers because the rolling buffer carries the prior
  // 5-min context. Cards arrive ~3x faster at the cost of slightly more
  // ~ (silence) outputs on borderline fragments — net win for "live" feel.
  const FC_FLUSH_MS = 1200
  const FC_MAX_BUFFER_AGE_MS = 4500
  const FC_MIN_WORDS = 7
  const cardIdCounter = useRef(0)
  const supabaseSessionId = useRef<string | null>(null)
  // map cardId → supabaseId for subsequent updates
  const cardSupabaseIds = useRef<Record<string, string>>({})
  // Recent FC card entity signatures — used to suppress redundant cards on
  // the same topic cluster. The trigger-based dedupe in silenceGate misses
  // these because the speaker keeps rephrasing ("the famous episode" →
  // "the tariff debate" → "where Chamath was caught"), but the model
  // converges on the same claim every time. Track multi-word proper nouns
  // from the parsed CLAIM and suppress new cards that share any with a
  // recent fired card.
  const recentCardClaimEntities = useRef<Array<{ ts: number; entities: Set<string>; words?: Set<string> }>>([])
  // Speaker diarization: speakerId (number) → resolved display name
  const speakerNameMap = useRef<Record<number, string>>({})
  // Track who was last speaking to help resolve addressed names
  const lastSpeakerId = useRef<number | null>(null)

  const resolveSpeaker = useCallback((speakerId: number, text: string): string => {
    // ONLY auto-name from self-intro patterns ("I'm Jason"). The addressed-name
    // and initial-token heuristics caused Jason to be mislabeled "Oliver"
    // whenever Jason addressed Oliver. Voice biometrics (pyannote) is the real
    // source of truth and overrides via the 'speaker-identified' IPC.
    const selfName = detectSpeakerName(text)
    if (selfName) {
      speakerNameMap.current[speakerId] = selfName
    }

    lastSpeakerId.current = speakerId
    if (speakerNameMap.current[speakerId]) return speakerNameMap.current[speakerId]
    // Show "Speaker 1" for the mic until voice biometrics matches it to an
    // enrolled voiceprint. "Me" is too presumptuous — Jason wants his own
    // transcript labeled like everyone else's.
    if (speakerId === 0) return 'Speaker 1'
    if (speakerId === 1) return 'Speaker 2'
    return `Speaker ${speakerId - 8}`
  }, [])

  // ── Session lifecycle ───────────────────────────────────────────────────
  const onConnected = useCallback(async (spkLabel: string) => {
    setSessionMode('live')
    const sid = await createSession(spkLabel)
    supabaseSessionId.current = sid
  }, [])

  const onDisconnected = useCallback(async () => {
    setSessionMode('ended')
    if (supabaseSessionId.current) {
      await endSession(supabaseSessionId.current)
    }
  }, [])

  // Reset the in-memory transcript + cards. Same shape as the 'new-session'
  // tray action — wipes lines, cards, interim state, counters, and keeps
  // the listen session running so a fresh stream lands cleanly.
  const handleResetTranscript = useCallback(() => {
    setLines([])
    setCards({})
    setInterimText('')
    setInterimSpeaker('')
    setSpeaker('')
    cardSupabaseIds.current = {}
    lineIdCounter.current = 0
    cardIdCounter.current = 0
    sessionStartTime.current = Date.now()
    utteranceBufferRef.current = null
    dbg('[overlay] transcript + cards reset by user')
  }, [])

  const handleTogglePrivacy = useCallback(async () => {
    setIsPublic(prev => {
      const next = !prev
      if (supabaseSessionId.current) {
        setSessionPublic(supabaseSessionId.current, next).catch(() => {})
      }
      // PRIVATE means the overlay should be hidden from screen capture.
      // setContentProtection(true) prevents the window from showing in
      // shared screens / recordings on Windows + macOS.
      try {
        const api = (window as any).api?.annotated
        api?.setContentProtection?.(!next) // private (next=false) → protect=true
      } catch (_) { /* no-op */ }
      return next
    })
  }, [])

  // ── Transcript callbacks ─────────────────────────────────────────────────
  // Partial transcripts no longer render word-by-word — too choppy. Instead we
  // tick the "isHearingAudio" pulse so the user sees the system is listening
  // during long monologues. The full text appears as a clean solid block
  // when Speechmatics finalizes the utterance in handleFinal().
  const handleInterim = useCallback((_text: string, _speakerId: number) => {
    setIsHearingAudio(true)
    if (hearingTimer.current) clearTimeout(hearingTimer.current)
    hearingTimer.current = setTimeout(() => setIsHearingAudio(false), 1500)
  }, [])

  const handleFinal = useCallback(async (text: string, speakerId: number) => {
    setInterimText('')
    setInterimSpeaker('')

    // Skip pure noise / ultra-short fragments — feed buffer but don't display
    const wordCount = text.trim().split(/\s+/).length
    if (wordCount <= 4) {
      appendToBuffer(text)
      return
    }

    const spkLabel = resolveSpeaker(speakerId, text)
    const lineId = `line-${++lineIdCounter.current}`
    const newLine: TranscriptLine = {
      id: lineId,
      speaker: spkLabel,
      speakerId,
      text,
      isFinal: true,
      isFCTrigger: false,
      isCynicTrigger: false,
      cardIds: [],
      timestamp: Date.now(),
    }

    // First final → start session
    if (sessionMode === 'idle') {
      onConnected(spkLabel)
    }

    setSpeaker(spkLabel)
    appendToBuffer(text)

    // ── Always render the line immediately (no UX delay) ──
    // Cap line history at MAX_LINES to prevent unbounded memory growth across
    // long sessions. Older lines drop off; cards anchored to those lines are
    // also cleaned up below.
    setLines(prev => {
      const next = [...prev, newLine]
      if (next.length <= MAX_LINES) return next
      const dropCount = next.length - MAX_LINES
      const dropped = next.slice(0, dropCount)
      // Remove cards anchored to dropped lines so we don't leak in `cards`
      const droppedCardIds: string[] = []
      dropped.forEach(l => (l.cardIds || []).forEach(id => droppedCardIds.push(id)))
      if (droppedCardIds.length > 0) {
        setCards(prevCards => {
          const out = { ...prevCards }
          droppedCardIds.forEach(id => { delete out[id] })
          return out
        })
      }
      return next.slice(dropCount)
    })

    // ── Coalesce utterances before firing FC ──
    const buf = utteranceBufferRef.current
    const now = Date.now()
    const firstStartedAt = (buf && buf.speakerId === speakerId) ? buf.firstStartedAt : now
    const merged = (buf && buf.speakerId === speakerId)
      ? { speakerId, text: (buf.text + ' ' + text).replace(/\s+/g, ' ').trim(), lineIds: [...buf.lineIds, lineId], firstStartedAt }
      : { speakerId, text, lineIds: [lineId], firstStartedAt: now }
    if (buf?.flushTimer) clearTimeout(buf.flushTimer)
    if (buf && buf.speakerId !== speakerId) {
      // Speaker changed — fire on the previous speaker's full utterance now,
      // then start a new buffer for the new speaker.
      flushUtteranceForFC(buf.text, buf.lineIds[buf.lineIds.length - 1])
    }
    const flushTimer = setTimeout(() => {
      const cur = utteranceBufferRef.current
      if (cur === merged || (cur && cur.speakerId === speakerId)) {
        flushUtteranceForFC(merged.text, merged.lineIds[merged.lineIds.length - 1])
        utteranceBufferRef.current = null
      }
    }, FC_FLUSH_MS)
    utteranceBufferRef.current = { ...merged, flushTimer: flushTimer as ReturnType<typeof setTimeout> }

    // Three immediate-flush conditions — fire on whichever hits first:
    //   (a) sentence end + ≥ FC_MIN_WORDS (12) — natural complete thought
    //   (b) buffer ≥ 25 words even mid-sentence — speaker is rambling
    //   (c) buffer age ≥ FC_MAX_BUFFER_AGE_MS (7s) — don't sit on it
    const trimmedText = merged.text.trim()
    const bufWordCount = trimmedText.split(/\s+/).length
    const ageMs = now - firstStartedAt
    const sentenceEnd = /[.!?]$/.test(trimmedText)
    if ((sentenceEnd && bufWordCount >= FC_MIN_WORDS)
        || bufWordCount >= 16  // mid-sentence backstop (was 25 — too patient for live)
        || ageMs >= FC_MAX_BUFFER_AGE_MS) {
      clearTimeout(flushTimer)
      flushUtteranceForFC(merged.text, merged.lineIds[merged.lineIds.length - 1])
      utteranceBufferRef.current = null
      return
    }
    return
  }, [sessionMode, onConnected])

  // Inner helper: actually run gate / FC / Cynic on the coalesced utterance
  // and attach any resulting cards to the anchor line in the transcript.
  const flushUtteranceForFC = useCallback(async (text: string, anchorLineId: string) => {
    const gate = shouldFire(text)
    const fcOk = canFireFC(text)
    const cynicOk = canFireCynic(text)
    dbg(`[overlay] flushFC gate=${gate} fcOk=${fcOk} cynicOk=${cynicOk} words=${text.trim().split(/\s+/).length} text="${text.slice(0, 80)}"`)
    if (gate && (fcOk || cynicOk)) {
      // Mark the anchor line (the LAST line in the coalesced utterance) as
      // the FC/Cynic trigger so the highlight + card-anchor renders correctly.
      setLines(prev => prev.map(l =>
        l.id === anchorLineId ? { ...l, isFCTrigger: fcOk, isCynicTrigger: cynicOk } : l
      ))
      if (fcOk) recordFCFire(text)
      if (cynicOk) recordCynicFire(text)
      const lineId = anchorLineId

      try {
        dbg(`[overlay] firePersonas START text="${text.slice(0,60)}"`)
        setIsThinking(true)
        const results = await firePersonas(text)
        setIsThinking(false)
        dbg(`[overlay] firePersonas DONE fc=${!!results.fc} cynic=${!!results.cynic}`)
        if (results.fc) dbg(`[overlay] FC raw="${results.fc.slice(0, 200)}"`)
        if (results.cynic) dbg(`[overlay] CY raw="${results.cynic.slice(0, 200)}"`)
        const newCardIds: string[] = []

        // ── FC card ───────────────────────────────────────────────────────
        if (results.fc) {
          const parsed = parseFCResponse(results.fc)
          if (!parsed) {
            dbg(`[overlay] FC parse REJECTED — no card`)
          }
          if (parsed) {
            // ── Hallucination guard: skip FC when CLAIM drifts off-topic ─
            // Gemini occasionally picks a tangentially-related fact-checkable
            // claim (e.g. transcript says "I'm trying to remember" → CLAIM
            // becomes "Chicago Merchandise Mart had ZIP code 60654"). Compare
            // the model's CLAIM (or comment) against the actual trigger text;
            // if word overlap is below 25%, skip the FC card as off-topic
            // hallucination. (Cynic processing below still runs — the same
            // trigger may legitimately surface a framing fallacy.)
            const tokensOf = (s: string) => new Set(
              s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
                .filter(w => w.length >= 4)
            )
            const triggerTokens = tokensOf(text)
            const claimTokens = tokensOf((parsed.claim || '') + ' ' + (parsed.comment || ''))
            let overlap = 1
            if (triggerTokens.size >= 4 && claimTokens.size >= 4) {
              let common = 0
              claimTokens.forEach(w => { if (triggerTokens.has(w)) common++ })
              overlap = common / Math.min(triggerTokens.size, claimTokens.size)
            }

            // ── Proper-noun analysis ─────────────────────────────────────
            // The guard's job is to catch the "Chicago Merchandise Mart"
            // hallucination case (model fabricates unrelated context for a
            // garbled fragment) without killing legit cards where the model
            // expands on what the speaker actually said.
            //
            // The strongest discriminator is shared proper nouns. When the
            // trigger contains "Kolbrugge" and the claim contains
            // "Mark Kolbrugge", the model is clearly on-topic — overall word
            // overlap ratio is misleading because the claim/comment are
            // verbose by design. The previous overlap-only check was killing
            // these (Mark Kolbrugge: 15% rejected, Larry Summers: 21%
            // rejected — both correct cards).
            const haystack = (text + ' ' + (getBuffer() ?? '')).toLowerCase()
            const properNouns = (s: string): Set<string> => {
              const out = new Set<string>()
              // Single capitalized words ≥ 4 chars (Cloudflare, Kolbrugge, Chamath)
              const single = s.match(/\b[A-Z][a-z]{3,}\b/g) ?? []
              for (const m of single) out.add(m.toLowerCase())
              // Multi-word capitalized phrases (Larry Summers, Great Tariff Debate)
              const multi = s.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g) ?? []
              for (const m of multi) out.add(m.toLowerCase())
              return out
            }
            const triggerNouns = properNouns(text)
            const allClaimNouns = new Set<string>()
            properNouns(parsed.claim || '').forEach(n => allClaimNouns.add(n))
            properNouns(parsed.comment || '').forEach(n => allClaimNouns.add(n))

            // Shared proper nouns: claim noun appears verbatim in trigger,
            // OR is a substring/superstring of a trigger noun (catches
            // "Mark Kolbrugge" in claim ↔ "Kolbrugge" in trigger).
            let sharedNounCount = 0
            const triggerNounArr = Array.from(triggerNouns)
            allClaimNouns.forEach(cn => {
              if (triggerNouns.has(cn)) { sharedNounCount++; return }
              for (const tn of triggerNounArr) {
                if (tn.includes(cn) || cn.includes(tn)) { sharedNounCount++; return }
              }
            })

            // Invented nouns: claim names that don't appear in trigger OR
            // rolling buffer (5 min of prior transcript context).
            const inventedNouns: string[] = []
            allClaimNouns.forEach(n => {
              if (!haystack.includes(n)) inventedNouns.push(n)
            })

            // Reject ONLY when the model is clearly off the rails:
            //   • Zero shared proper nouns (claim doesn't reference any
            //     named entity from the trigger) AND word overlap < 20%
            //     (content barely overlaps either) — that's the
            //     "Chicago Merchandise Mart" hallucination signature.
            //
            // If trigger and claim share at least one named entity, OR
            // overlap is decent, the model is anchored to the speaker's
            // topic — let it through even if it expands with new entities.
            // The "Mark Kolbrugge" case (trigger has "Kolbrugge", claim
            // expands to "Mark Kolbrugge created Armchair") and the
            // "Chamath/Chermaff" case (trigger has ASR-mangled "Chermaff",
            // claim correctly resolves to Chamath/Larry Summers) both
            // need to pass — those are good expansions.
            //
            // The previous version added a "≥3 invented entities + low
            // overlap" rule that killed legitimate ASR-resolution cards.
            // The gate (shouldFire) + prompt's silence rules + parser's
            // meta-pattern filter already catch most fabrications upstream.
            let offTopic = false
            let offTopicReason = ''
            if (sharedNounCount === 0 && overlap < 0.20) {
              offTopic = true
              offTopicReason = `no shared entities + overlap ${(overlap*100).toFixed(0)}%`
            }
            if (offTopic) {
              dbg(`[overlay] FC REJECTED (${offTopicReason}) claim="${(parsed.claim || parsed.comment).slice(0, 80)}"`)
            } else {
              dbg(`[overlay] FC pass overlap=${(overlap*100).toFixed(0)}% sharedNouns=${sharedNounCount} invented=${inventedNouns.length}`)
            }
            if (offTopic) {
              // skip FC card creation but continue to cynic
            } else {
            // ── Anti-hallucination reconciliation ────────────────────────
            // Only trust SOURCE URLs that match what Google Search actually
            // returned (groundingMetadata). Drop any URL the model typed
            // that wasn't grounded — those are fabrications.
            const grounded = (results.groundedUrls ?? []).map(u => {
              try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase() } catch { return null }
            }).filter(Boolean) as string[]
            const groundedHostSet = new Set(grounded)

            const verifiedUrls = grounded.length
              ? parsed.urls.filter(u => {
                  try { return groundedHostSet.has(new URL(u).hostname.replace(/^www\./, '').toLowerCase()) } catch { return false }
                })
              : parsed.urls // if grounding info absent (no useSearch), keep whatever was returned

            // ── Primary-source gate ──────────────────────────────────────
            // CONFIRMED / CORRECTED verdicts MUST be backed by at least one
            // authoritative primary source. If the only citations are blogs,
            // aggregators, or random search results, downgrade to UNCONFIRMED.
            const PRIMARY_HOSTS = [
              // Wire services + national broadcasters
              'apnews.com', 'ap.org', 'reuters.com', 'afp.com',
              'bbc.com', 'bbc.co.uk', 'npr.org', 'pbs.org',
              'cnn.com', 'cbsnews.com', 'nbcnews.com', 'abcnews.go.com',
              'foxnews.com', 'cbc.ca', 'aljazeera.com',
              // Reference
              'wikipedia.org', 'britannica.com',
              // Government / legal
              'sec.gov', 'pacer.gov', 'courtlistener.com', 'law.justia.com', 'oyez.org',
              // Business / financial journalism
              'wsj.com', 'ft.com', 'bloomberg.com', 'reuters.com',
              'theinformation.com', 'forbes.com', 'businessinsider.com',
              'cnbc.com', 'fortune.com', 'economist.com',
              'marketwatch.com', 'barrons.com', 'finance.yahoo.com',
              // Tech journalism (real reporting)
              'techcrunch.com', 'theverge.com', 'arstechnica.com',
              'wired.com', 'engadget.com', 'protocol.com',
              '404media.co', 'theregister.com', 'venturebeat.com',
              'restofworld.org', 'platformer.news',
              // Newspapers of record + national news
              'nytimes.com', 'washingtonpost.com', 'theguardian.com',
              'latimes.com', 'usatoday.com', 'chicagotribune.com',
              'bostonglobe.com', 'sfchronicle.com',
              // Magazines / longform with editorial standards
              'thedailybeast.com', 'politico.com', 'axios.com',
              'vox.com', 'slate.com', 'theatlantic.com',
              'newyorker.com', 'time.com', 'newsweek.com',
              'rollingstone.com', 'vanityfair.com',
              'variety.com', 'hollywoodreporter.com', 'deadline.com',
              'thedailyupside.com', 'semafor.com', 'thedispatch.com',
              // Social — first-party utterance (host says it themselves)
              'twitter.com', 'x.com',
            ]
            const isPrimaryUrl = (u: string) => {
              try {
                const host = new URL(u).hostname.replace(/^www\./, '').toLowerCase()
                if (host.endsWith('.gov')) return true                       // any .gov
                if (host.endsWith('.edu')) return true                       // .edu
                if (PRIMARY_HOSTS.some(p => host === p || host.endsWith('.' + p))) return true
                return false
              } catch { return false }
            }

            // Community-tier sources — high-signal but not authoritative.
            // Citations get the ✱ marker and the verdict caps at UNCONFIRMED.
            const COMMUNITY_HOSTS = [
              'reddit.com', 'old.reddit.com',
              'github.com', 'npmjs.com',
              'stackoverflow.com',
              'substack.com', 'medium.com',
              'producthunt.com',
              'ycombinator.com', 'news.ycombinator.com',
              'youtube.com', 'youtu.be',
              'crunchbase.com', // pricing/funding data — community-tier because crowd-edited
            ]
            const isCommunityUrl = (u: string) => {
              try {
                const host = new URL(u).hostname.replace(/^www\./, '').toLowerCase()
                return COMMUNITY_HOSTS.some(p => host === p || host.endsWith('.' + p))
              } catch { return false }
            }

            // If grounding returned URLs but NONE of the model's typed URLs match,
            // the model fabricated. Treat as no real citations.
            const candidateUrls = verifiedUrls.length > 0 ? verifiedUrls
              : grounded.length > 0 ? (results.groundedUrls ?? []).slice(0, 5)
              : parsed.urls

            const primaryUrls = candidateUrls.filter(isPrimaryUrl)
            const communityUrls = candidateUrls.filter(u => !isPrimaryUrl(u) && isCommunityUrl(u))
            const hasPrimary = primaryUrls.length > 0
            const hasCommunity = communityUrls.length > 0

            // Verdict logic — trust the model's verdict when it's seeing
            // real grounded sources, even if those sources aren't in our
            // PRIMARY_HOSTS list. The previous "no primary → force
            // UNCONFIRMED" rule was wrong: it demoted CONFIRMED cards backed
            // by allinpodcast.co (first-party!), shortform.com, etc.
            // Now we only force UNCONFIRMED in one case:
            //   • All-fabricated: grounding returned URLs but the model's
            //     typed URLs don't match any of them — model invented citations.
            const forceUnconfirmed =
              grounded.length > 0 && verifiedUrls.length === 0 && parsed.urls.length > 0
            const finalVerdict = forceUnconfirmed ? 'UNCONFIRMED' : parsed.verdict

            // Final URL list: primary first, community second, then anything
            // else (grounded). Card always renders something usable.
            // Per-host dedupe so cards don't show "AP News, AP News, AP News".
            const seenHosts = new Set<string>()
            const dedupeByHost = (urls: string[]): string[] => {
              const out: string[] = []
              for (const u of urls) {
                try {
                  const host = new URL(u).hostname.replace(/^www\./, '').toLowerCase()
                  if (seenHosts.has(host)) continue
                  seenHosts.add(host)
                  out.push(u)
                } catch {
                  out.push(u)
                }
              }
              return out
            }
            const finalUrls = [
              ...dedupeByHost(primaryUrls),
              ...dedupeByHost(communityUrls),
              ...(seenHosts.size === 0 ? dedupeByHost(candidateUrls) : []),
            ].slice(0, 4)

            // Build the per-URL tier map for the renderer.
            const citationTiers: Record<string, 'primary' | 'community'> = {}
            for (const u of finalUrls) {
              citationTiers[u] = isPrimaryUrl(u) ? 'primary' : 'community'
            }

            // ── Claim-entity dedup (last-mile suppression) ───────────────
            // Speakers rephrase ("the famous episode" → "the tariff debate"
            // → "where Chamath was caught looking up") and the trigger-based
            // dedupe in silenceGate misses it. But the model's CLAIM
            // converges on the same proper nouns. If a recently-fired card
            // shares ≥1 multi-word proper noun with this one, it's the same
            // topic — suppress.
            const claimEntities = (s: string): Set<string> => {
              const out = new Set<string>()
              const multi = s.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g) ?? []
              for (const m of multi) out.add(m.toLowerCase())
              return out
            }
            const newClaimEnts = new Set<string>()
            claimEntities(parsed.claim || '').forEach(e => newClaimEnts.add(e))
            claimEntities(parsed.comment || '').forEach(e => newClaimEnts.add(e))

            // Prune: drop entries older than 3 minutes; cap to last 12
            const RECENT_CARD_WINDOW_MS = 3 * 60 * 1000
            const cutoff = Date.now() - RECENT_CARD_WINDOW_MS
            recentCardClaimEntities.current = recentCardClaimEntities.current
              .filter(r => r.ts > cutoff)
              .slice(-12)

            // Require shared entities AND high claim-content word overlap
            // (>55%) to suppress. Live political talk threads the same two
            // names (e.g. "Joe Biden", "Hunter Biden") through every
            // distinct incident — Burisma board, Shokin firing, pardon
            // timing, Ukraine money. Two shared names alone are NOT a
            // duplicate; the content words distinguish events. Only
            // suppress if the same names AND mostly the same content
            // re-appear.
            const claimWords = new Set<string>()
            const newClaimText = ((parsed.claim || '') + ' ' + (parsed.comment || '')).toLowerCase()
            newClaimText.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).forEach(w => {
              if (w.length >= 5) claimWords.add(w)
            })
            const dupeOverlap = recentCardClaimEntities.current.find(rec => {
              let sharedEnts = 0
              const arr = Array.from(newClaimEnts)
              for (const e of arr) if (rec.entities.has(e)) sharedEnts++
              if (sharedEnts < 2) return false
              // Now check claim-content similarity. rec.words is the same
              // 5+-letter-word set we stored on the prior card. If <55% of
              // the new card's content words overlap, treat as a distinct
              // event despite shared names.
              if (!rec.words || rec.words.size === 0) return true  // legacy entries — fall back to entity-only
              let sharedWords = 0
              const cArr = Array.from(claimWords)
              for (const w of cArr) if (rec.words.has(w)) sharedWords++
              const denom = Math.min(claimWords.size, rec.words.size) || 1
              return sharedWords / denom > 0.55
            })
            const suppressedAsDupe = !!(dupeOverlap && newClaimEnts.size > 0)
            if (suppressedAsDupe) {
              const shared = Array.from(newClaimEnts).filter(e => dupeOverlap!.entities.has(e))
              dbg(`[overlay] FC SUPPRESSED (claim-entity dupe) shared=${shared.slice(0, 3).join(',')} claim="${(parsed.claim || '').slice(0, 80)}"`)
            }

            // Wrap remaining card creation in a non-suppressed gate. Cynic
            // processing below stays unaffected (separate block after the
            // outer `if (parsed)` close).
            if (!suppressedAsDupe) {
            const cardId = `card-${++cardIdCounter.current}`
            newCardIds.push(cardId)
            // Record this card's entities for future dedup
            if (newClaimEnts.size > 0) {
              recentCardClaimEntities.current.push({ ts: Date.now(), entities: newClaimEnts, words: claimWords })
            }
            const elapsed = formatElapsed(sessionStartTime.current)

            const fcCard: Card = {
              id: cardId,
              type: 'fc',
              verdict: finalVerdict,
              comment: parsed.comment,
              citations: finalUrls,
              citationTiers,
              elapsed,
              timestamp: Date.now(),
              // Prefer the resolved CLAIM from the model over raw transcript text
              triggerSentence: (parsed.claim || text).slice(0, 120),
              triggerLineId: lineId,
              reactionsAgree: 0,
              reactionsQuestion: 0,
              citationPassages: {},
              isBookmarked: false,
            }

            dbg(`[overlay] FC CARD created id=${cardId} verdict=${finalVerdict} primary=${primaryUrls.length} community=${communityUrls.length}`)
            setCards(prev => ({ ...prev, [cardId]: fcCard }))
            setPulsingId(cardId)
            setTimeout(() => setPulsingId(null), 700)

            // Write to Supabase (non-blocking)
            writeCard(supabaseSessionId.current, fcCard).then(sid => {
              if (sid) cardSupabaseIds.current[cardId] = sid
            }).catch(() => {})

            // Hydrate citations (non-blocking)
            // Keep model URLs even if passage fetch fails — never wipe to empty.
            // Pass FACT + CLAIM + transcript so passage matching has the literal
            // phrases the LLM resolved (e.g. "economic royalists") — those exact
            // tokens are what we want to find quoted in the source page.
            const passageQuery = [parsed.comment, parsed.claim, text].filter(Boolean).join(' ')
            fetchCitations(finalUrls, passageQuery).then(({ citations, passages }) => {
              setCards(prev => {
                const existing = prev[cardId]
                if (!existing) return prev
                // Fall back to grounded URLs (real, never fabricated) if passage fetch failed
                const finalCitations = citations.length > 0 ? citations : finalUrls
                return { ...prev, [cardId]: { ...existing, citations: finalCitations, citationPassages: passages } }
              })
            }).catch(() => {})
            // (parsed.urls.length > 0 is guaranteed by guard above)
            } // end if (!suppressedAsDupe)
            } // end else (!offTopic)
          }
        }

        // ── Cynic card ────────────────────────────────────────────────────
        if (results.cynic) {
          const parsedCY = parseCYResponse(results.cynic)
          if (parsedCY) {
          // Dedupe: suppress if punch + label match a recent Cynic card.
          // Same logic as the FC claim-entity dedupe, applied to the
          // (label + punch) signature since Cynic cards don't have entity
          // claims. 3-min window, last 12 cards.
          const cySig = `${parsedCY.fallacyLabel}|${parsedCY.punchLine}`.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
          const cyCutoff = Date.now() - 3 * 60 * 1000
          recentCardClaimEntities.current = recentCardClaimEntities.current.filter(r => r.ts > cyCutoff).slice(-12)
          const cyDupe = recentCardClaimEntities.current.some(r => r.entities.has(`cy:${cySig}`))
          if (cyDupe) {
            dbg(`[overlay] CYNIC SUPPRESSED (dupe) sig="${cySig.slice(0, 60)}"`)
          } else {
          recentCardClaimEntities.current.push({ ts: Date.now(), entities: new Set([`cy:${cySig}`]) })
          const cardId = `card-${++cardIdCounter.current}`
          newCardIds.push(cardId)
          const elapsed = formatElapsed(sessionStartTime.current)

          const cyCard: Card = {
            id: cardId,
            type: 'cynic',
            verdict: 'FRAMING',
            comment: parsedCY.punchLine,
            fallacyLabel: parsedCY.fallacyLabel,
            counter: parsedCY.counter,
            citations: [],
            elapsed,
            timestamp: Date.now(),
            triggerSentence: text.slice(0, 120),
            triggerLineId: lineId,
            reactionsAgree: 0,
            reactionsQuestion: 0,
            citationPassages: {},
            isBookmarked: false,
          }

          setCards(prev => ({ ...prev, [cardId]: cyCard }))
          setPulsingId(cardId)
          setTimeout(() => setPulsingId(null), 700)

          // Write to Supabase (non-blocking)
          writeCard(supabaseSessionId.current, cyCard).then(sid => {
            if (sid) cardSupabaseIds.current[cardId] = sid
          }).catch(() => {})
          } // end else (!cyDupe)
          } // end if (parsedCY)
        }

        if (newCardIds.length > 0) {
          setLines(prev => prev.map(l =>
            l.id === lineId
              ? { ...l, cardIds: [...l.cardIds, ...newCardIds] }
              : l
          ))
        }
      } catch (err) {
        setIsThinking(false)
        dbg(`[overlay] firePersonas ERROR: ${String(err)}`)
      }
    }
    // No-op when gate didn't pass — the line was already added in handleFinal.
  }, [])

  const [isConnected, setIsConnected] = useState(false)
  const [isListening, setIsListening] = useState(true)  // default STOP — overlay only shows when trigger app detected

  // True for one IPC tick after the user clicks START in the header. The
  // capture-state listener checks this to decide whether to clear the
  // transcript: a manual restart (Stop→Start in the same meeting) should
  // PRESERVE existing lines/cards. Only fresh app-detected starts (new
  // Zoom meeting opened) reset.
  const manualRestartRef = useRef(false)

  // Debounce ref — STOP and START buttons share the same DOM button (label
  // toggles on isListening). React state flips between clicks, so a fast
  // double-click on STOP fires STOP-then-START. The flag is set on either
  // action and blocks the OPPOSITE action for 750ms, preserving the user's
  // most recent intent.
  const lastListenActionAt = useRef(0)
  const LISTEN_DEBOUNCE_MS = 750

  // Manual listen control — used by the Start/Stop button in Header
  const handleStartListening = useCallback(async () => {
    if (Date.now() - lastListenActionAt.current < LISTEN_DEBOUNCE_MS) {
      console.log('[overlay] ▶ ignored — debounce after recent stop/start')
      return
    }
    lastListenActionAt.current = Date.now()
    const api = (window as any).api?.annotated
    if (!api?.startListening) return
    try {
      // Mark this as a manual restart BEFORE the start IPC fires, so the
      // capture-state listener sees the flag when it processes the event.
      manualRestartRef.current = true
      // Clear the detector's manual-stop flag so it stays running
      api.setManualStop?.(false)
      await api.startListening()
      setIsListening(true)
      console.log('[overlay] ▶ Manual listen started (transcript preserved)')
    } catch (err) {
      console.error('[overlay] Failed to start listening:', err)
    }
  }, [])

  const handleStopListening = useCallback(async () => {
    if (Date.now() - lastListenActionAt.current < LISTEN_DEBOUNCE_MS) {
      console.log('[overlay] ■ ignored — debounce after recent stop/start')
      return
    }
    lastListenActionAt.current = Date.now()
    const api = (window as any).api?.annotated
    if (!api?.stopListening) return
    try {
      // Tell the detector NOT to auto-restart while the trigger app is still running
      api.setManualStop?.(true)
      await api.stopListening()
      setIsListening(false)
      setIsConnected(false)
      console.log('[overlay] ■ Manual listen stopped')
    } catch (err) {
      console.error('[overlay] Failed to stop listening:', err)
    }
  }, [])

  // Keep stable refs so the IPC handler never closes over stale callbacks
  const handleFinalRef = useRef(handleFinal)
  const handleInterimRef = useRef(handleInterim)
  useEffect(() => { handleFinalRef.current = handleFinal }, [handleFinal])
  useEffect(() => { handleInterimRef.current = handleInterim }, [handleInterim])

  // ── IPC transcript bridge (uses same audio pipeline as listen window) ──
  useEffect(() => {
    const api = (window as any).api?.sttView
    dbg(`[overlay] IPC bridge init — api.sttView=${!!api}`)
    if (!api) {
      dbg('[overlay] window.api.sttView NOT available — FC/Cynic disabled')
      return
    }
    dbg('[overlay] Registering onSttUpdate handler')
    // Speaker label → numeric ID. Me=0; Them (single)=1; "Them:S0", "Them:S1"
    // (diarized) get unique IDs starting at 10 so they don't collide with Me/Them.
    // Persist across re-renders via the ref so IDs stay stable per speaker.
    const speakerIdMap: Record<string, number> = { Me: 0, Them: 1 }
    let nextDiarizedId = 10
    const resolveSpeakerId = (label: string): number => {
      if (label in speakerIdMap) return speakerIdMap[label]
      const id = nextDiarizedId++
      speakerIdMap[label] = id
      return id
    }
    const onUpdate = (_evt: unknown, data: { speaker: string; text: string; isPartial: boolean; isFinal: boolean }) => {
      if (data.isFinal) dbg(`[overlay] stt-update FINAL speaker=${data.speaker} text="${data.text?.slice(0, 60)}"`);
      if (!data?.text?.trim()) return
      // Mic ('Me') events are kept — Jason needs to see his own transcripts.
      // sttService already runs bidirectional echo suppression so we don't
      // double-render the same audio when the user listens through speakers.
      const speakerId = resolveSpeakerId(data.speaker)
      if (data.isFinal) {
        setIsConnected(true)
        handleFinalRef.current(data.text, speakerId)
      } else {
        handleInterimRef.current(data.text, speakerId)
      }
    }
    api.onSttUpdate(onUpdate)

    // ── Voice-biometric identification (pyannote) ──
    // When the main process matches a diarized speaker to an enrolled voiceprint,
    // it fires this event with { speakerLabel, name, score }. We use the same
    // resolveSpeakerId mapping to find the numeric id and lock the name.
    //
    // CRITICAL: only retroactively rename past lines on the FIRST identify
    // for this speakerId. If pyannote later returns a DIFFERENT name (e.g.
    // Speechmatics reused S0 for a different real speaker), don't rewrite
    // history — that mis-attributes Jason's earlier monologue to the guest
    // who just started speaking. Only future lines pick up the new name.
    const annotatedApi = (window as any).api?.annotated
    const onIdentified = (
      _e: unknown,
      data: { speakerLabel: string; name: string; score: number }
    ) => {
      if (!data?.speakerLabel || !data?.name) return
      const id = resolveSpeakerId(data.speakerLabel)
      const prevName = speakerNameMap.current[id]
      dbg(`[overlay] voice identified ${data.speakerLabel} → ${data.name} (${data.score}) prev=${prevName || 'none'}`)
      speakerNameMap.current[id] = data.name
      if (!prevName || prevName === data.name) {
        // First lock OR refresh of same identity — safe to rewrite history.
        setLines(prev => prev.map(l => l.speakerId === id ? { ...l, speaker: data.name } : l))
      } else {
        // Identity changed (Speechmatics reused S-label for a new speaker).
        // Leave past lines alone — they keep the prior owner's name. Future
        // lines created after this point will resolve to the new name via
        // resolveSpeaker reading speakerNameMap.current.
        dbg(`[overlay] speaker ${id} identity switched ${prevName} → ${data.name}; past lines preserved`)
      }
    }
    annotatedApi?.onSpeakerIdentified?.(onIdentified)

    return () => {
      api.removeOnSttUpdate(onUpdate)
      annotatedApi?.removeOnSpeakerIdentified?.(onIdentified)
      onDisconnected()
    }
  }, [onDisconnected])

  // ── Transparent body for Electron acrylic glass ─────────────────────────
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.style.background = 'transparent'
    body.style.background = 'transparent'
    return () => {
      html.style.background = ''
      body.style.background = ''
    }
  }, [])

  // ── Electron IPC shortcuts ───────────────────────────────────────────────
  useEffect(() => {
    const api = (window as any).api?.annotated
    if (!api) return

    const handleAction = (_event: unknown, { type }: { type: string }) => {
      switch (type) {
        case 'bookmark-last': {
          setCards(prev => {
            const entries = Object.values(prev)
            if (entries.length === 0) return prev
            const last = entries.reduce((a, b) => a.timestamp > b.timestamp ? a : b)
            const next = !last.isBookmarked
            const supabaseId = cardSupabaseIds.current[last.id]
            if (supabaseId) updateCardBookmark(supabaseId, next).catch(() => {})
            return { ...prev, [last.id]: { ...last, isBookmarked: next } }
          })
          break
        }
        case 'end-session': {
          if (supabaseSessionId.current) {
            endSession(supabaseSessionId.current).catch(() => {})
          }
          setSessionMode('ended')
          break
        }
        case 'new-session': {
          // End current session
          if (supabaseSessionId.current) {
            endSession(supabaseSessionId.current).catch(() => {})
          }
          // Reset all state
          setLines([])
          setCards({})
          setInterimText('')
          setInterimSpeaker('')
          setSessionMode('idle')
          setSpeaker('')
          // Reset refs
          supabaseSessionId.current = null
          cardSupabaseIds.current = {}
          lineIdCounter.current = 0
          cardIdCounter.current = 0
          sessionStartTime.current = Date.now()
          break
        }
      }
    }

    api.onAction(handleAction)

    // ── Auto-clear stale transcript on session (re)start ──
    // Without this, when the listen session restarts (e.g. user closes Zoom →
    // overlay hides → user re-opens → overlay re-shows), old transcript content
    // remains visible until manually cleared. Treat status='start' as a fresh
    // session start and reset all transient state.
    const rendererApi = (window as any).api?.renderer
    let lastStatus: string | null = null
    const onCaptureState = (_e: unknown, payload: { status: string }) => {
      const status = payload?.status
      if (!status) return
      // Sync the START/STOP button label with the actual listen session
      // state. Without this, the detector can auto-restart the session after
      // the user clicked Stop (snooze expiry) but the button stays on START
      // even though we're transcribing.
      if (status === 'start') setIsListening(true)
      else if (status === 'stop') setIsListening(false)
      // Only reset when transitioning into a 'start' from a non-start state.
      // This avoids wiping content if the IPC fires twice in a row.
      // EXCEPTION: a manual restart (user clicked STOP then START in the same
      // meeting) preserves the transcript — they're pausing, not starting a
      // new session. Fresh app-detected starts (Zoom just opened, etc.) still
      // reset to avoid bleeding stale content into a new meeting.
      if (status === 'start' && lastStatus !== 'start') {
        if (manualRestartRef.current) {
          manualRestartRef.current = false
          dbg('[overlay] manual restart — transcript preserved')
        } else {
          setLines([])
          setCards({})
          setInterimText('')
          setInterimSpeaker('')
          setSpeaker('')
          cardSupabaseIds.current = {}
          lineIdCounter.current = 0
          cardIdCounter.current = 0
          sessionStartTime.current = Date.now()
        }
      }
      lastStatus = status
    }
    rendererApi?.onChangeListenCaptureState?.(onCaptureState)

    return () => {
      api.removeOnAction(handleAction)
      rendererApi?.removeOnChangeListenCaptureState?.(onCaptureState)
    }
  }, [])

  // ── Speaker rename — manual override that locks the diarization id to the name ──
  const handleRenameSpeaker = useCallback((speakerId: number, newName: string) => {
    speakerNameMap.current[speakerId] = newName
    // Re-flow the existing transcript so older lines from this speaker show the new name
    setLines(prev => prev.map(l => l.speakerId === speakerId ? { ...l, speaker: newName } : l))
    // Persist for future sessions if pyannote enrollment is available
    try { (window as any).api?.annotated?.enrollVoiceprint?.(speakerId, newName) } catch (_) {}
  }, [])

  // ── Card actions ─────────────────────────────────────────────────────────
  const handleBookmark = useCallback((id: string) => {
    setCards(prev => {
      const card = prev[id]
      if (!card) return prev
      const next = !card.isBookmarked
      const supabaseId = cardSupabaseIds.current[id]
      if (supabaseId) updateCardBookmark(supabaseId, next).catch(() => {})
      return { ...prev, [id]: { ...card, isBookmarked: next } }
    })
  }, [])

  const handleReact = useCallback((id: string, type: 'agree' | 'question' | 'comment') => {
    setCards(prev => {
      const card = prev[id]
      if (!card) return prev
      const nextAgree    = type === 'agree'    ? card.reactionsAgree + 1    : card.reactionsAgree
      const nextQ        = type === 'question' ? card.reactionsQuestion + 1 : card.reactionsQuestion
      const nextComment  = type === 'comment'  ? (card.reactionsComment ?? 0) + 1 : (card.reactionsComment ?? 0)
      const supabaseId = cardSupabaseIds.current[id]
      if (supabaseId) updateCardReactions(supabaseId, nextAgree, nextQ).catch(() => {})
      return {
        ...prev,
        [id]: { ...card, reactionsAgree: nextAgree, reactionsQuestion: nextQ, reactionsComment: nextComment },
      }
    })
  }, [])

  const handlePublish = useCallback((id: string) => {
    setCards(prev => {
      const card = prev[id]
      if (!card) return prev
      const supabaseId = cardSupabaseIds.current[id]
      if (supabaseId) publishCard(supabaseId).catch(() => {})
      return { ...prev, [id]: { ...card, isPublished: true } }
    })
  }, [])

  const isLive = isConnected && sessionMode === 'live'

  return (
    <OverlayPanel
      speaker={speaker}
      topic={topic}
      isLive={isLive}
      isPublic={isPublic}
      isListening={isListening}
      onTogglePrivacy={handleTogglePrivacy}
      onStartListening={handleStartListening}
      onStopListening={handleStopListening}
      onResetTranscript={handleResetTranscript}
      lines={lines}
      cards={cards}
      interimText={interimText}
      interimSpeaker={interimSpeaker}
      pulsingId={pulsingId}
      isThinking={isThinking}
      isHearingAudio={isHearingAudio}
      onBookmark={handleBookmark}
      onReact={handleReact}
      onPublish={handlePublish}
      onRenameSpeaker={handleRenameSpeaker}
      isOBS={isOBS}
    />
  )
}

export default function OverlayPage() {
  return (
    <Suspense fallback={null}>
      <OverlayInner />
    </Suspense>
  )
}
