import { SILENCE_GATE } from './deepgram'

// Multi-word proper noun (Jason Calacanis), CamelCase compound (MicroStrategy),
// OR a single capitalized 4+ char word in mid-sentence position (Sequoia, Anthropic).
// Mid-sentence lookbehind avoids matching sentence-initial "The", "I", "You".
const ENTITY_RE = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b|\b[A-Z][a-z]{2,}[A-Z][a-zA-Z]+\b|(?<=\S\s+)[A-Z][a-z]{3,}\b/

// Money/percent in digits OR words (Deepgram spells "two billion" not "$2B").
// Also catches bare 4-digit years (1976, 2015) which often mark factual claims.
const CLAIM_RE =
  /\$[\d,.]+\s?[MBK]?|\d+(\.\d+)?%|\d+\s?(million|billion|thousand|trillion|percent|dollars)\b|\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|million|billion|trillion)\s+(million|billion|thousand|trillion|percent|dollars|bucks|hundred)\b|\b(19|20)\d{2}\b/i

// Verbs that attribute a statement OR an action to someone — both kinds are
// fact-checkable when paired with a subject ("Trump signed an EO", "Chamath
// said tariffs would crash", "OpenAI released GPT-5"). Expanded from the
// original speech-only verbs to cover deeds, transactions, hires/fires, legal
// actions, and political moves.
const ATTRIBUTION_RE =
  /\b(said|claimed|according|announced|confirmed|reported|stated|argued|denied|admitted|alleged|accused|criticized|praised|endorsed|told|tells|wrote|writes|tweeted|posted|told|warned|threatened|promised|pledged|predicted|estimated|suggested|believed|expected|thought|knew|founded|raised|launched|released|shipped|acquired|bought|sold|merged|spun|invested|funded|backed|valued|priced|signed|approved|rejected|vetoed|passed|voted|appointed|named|elected|won|lost|beat|defeated|fired|hired|laid|cut|joined|left|quit|resigned|stepped|sued|banned|charged|indicted|convicted|sentenced|ruled|dismissed|settled|filed|leaked|revealed|exposed|reported|disclosed|invented|developed|built|created|started|founded|killed|attacked|defended|backed|opposed|supported)\b/i

const ASSERTION_RE =
  /\b(always|never|only|every|all|none|most|proves|shows|means|causes|because|biggest|largest|best|worst|first|leading|top|fastest|highest|lowest|impossible|guaranteed|certain|definitively|actually|literally|basically|exactly|honestly|clearly|obviously|definitely|probably|likely|unlikely|more|less|better|worse|bigger|smaller|earlier|later|already|still|yet|now|today|currently|recently|soon|quickly|slowly)\b/i

// Vague pronouns with no resolvable entity — bare claim with these has no checkable subject
const FILLER_RE = /\b(thing|stuff|it|someone|whatever|something|anything)\b/i

// Third-party pronouns. When paired with an attribution verb, this is a claim
// ABOUT another person — the highest-value fact-check moment. ("He said X",
// "She announced Y", "They raised $40M".) The FC model resolves the pronoun
// from the rolling buffer; if it can't, it outputs ~. Note: "I"/"we"/"you" are
// excluded — first/second-person attribution is opinion or self-narration,
// not a third-party claim.
const THIRD_PARTY_RE = /\b(he|she|they|him|her|them|his|hers|their|theirs)\b/i

export function shouldFire(sentence: string): boolean {
  const words = sentence.trim().split(/\s+/)
  if (words.length < 6) return false  // raised from 5 — fragments rarely fact-checkable

  const hasEntity = ENTITY_RE.test(sentence)
  const hasClaim = CLAIM_RE.test(sentence)
  const hasAttribution = ATTRIBUTION_RE.test(sentence)
  const hasAssertion = ASSERTION_RE.test(sentence)
  const hasFiller = FILLER_RE.test(sentence)
  const hasThirdParty = THIRD_PARTY_RE.test(sentence)

  // ── Highest-priority fire: third-party attribution ─────────────────────────
  // "He said tariffs would crash", "She raised $40M", "They acquired Stripe".
  // ALWAYS fires — even with filler words like "stuff" or "something" — because
  // the FC model can resolve the pronoun via the rolling buffer and either
  // produce a real fact-check or silence with ~. This is the user's primary
  // request: claims about other people MUST get checked.
  if (hasAttribution && (hasEntity || hasThirdParty)) return true

  // Strong positive: an entity or numeric claim is always checkable
  if (hasEntity || hasClaim) return true

  // ── Pure noise patterns — silence them outright ────────────────────────────
  // No entity, no number, no attribution → just opinion/mid-thought.
  if (!hasAttribution) {
    // Assertion adverb alone ("only", "every", "more") with filler is too vague
    if (hasAssertion && hasFiller) return false
  }

  // Attribution or assertion alone fires only if there's no filler — i.e. a
  // real noun is being discussed even without proper-noun capitalization.
  if ((hasAttribution || hasAssertion) && !hasFiller) return true

  return false
}

let lastFCFire = 0
let lastCynicFire = 0

// Rolling history of recent FC-fired text — last N entries within HISTORY_MS.
// Comparing against ALL recent fires (not just the immediately previous one)
// catches the case where a topic recurs after a brief detour: e.g. Jason
// repeats "JetBlue wanted to buy Spirit Airlines" three times across a 2-min
// monologue, with intermediate sentences in between.
const HISTORY_MS = 5 * 60 * 1000
const HISTORY_MAX = 12
type FireRecord = { ts: number; words: Set<string>; entities: Set<string> }
let fcHistory: FireRecord[] = []
let cynicHistory: FireRecord[] = []

function wordSet(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4)
  )
}

// Entity signature: proper nouns (Cloudflare, Jason Calacanis, MicroStrategy)
// + significant numbers (1100, 2024, 50%, $2.3M). When a speaker rephrases
// the same claim three different ways ("Cloudflare laid off 1100 people" →
// "they cut 1100 from Cloudflare" → "Cloudflare fired 1100 employees") the
// 65% word-overlap check misses the repeat because surrounding context
// dilutes the overlap. But the entity signature {cloudflare, 1100} stays
// constant — share 2+ entities/numbers and it's the same claim.
function entitySet(text: string): Set<string> {
  const out = new Set<string>()
  // Multi-word capitalized OR CamelCase compound — matches names + companies
  const properNouns = text.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b|\b[A-Z][a-z]{2,}[A-Z][a-zA-Z]+\b/g) ?? []
  for (const p of properNouns) out.add(p.toLowerCase())
  // Single capitalized 4+ char word in mid-sentence (Sequoia, Cloudflare,
  // Anthropic) — only count if NOT sentence-initial to avoid sentence-start
  // capitalization noise.
  const singleCapInMid = text.match(/(?<=\S\s+)[A-Z][a-z]{3,}\b/g) ?? []
  for (const p of singleCapInMid) out.add(p.toLowerCase())
  // Significant numbers: 2+ digits (skip "1", "5", etc. that are too generic).
  // Strip thousand separators so "1,100" and "1100" hash the same.
  const nums = text.match(/\b\d{2,}(?:[.,]\d+)?\b/g) ?? []
  for (const n of nums) {
    const v = parseFloat(n.replace(/,/g, ''))
    if (v >= 10 && v < 1e12) out.add(String(v))
  }
  return out
}

function pruneHistory(history: FireRecord[]): FireRecord[] {
  const cutoff = Date.now() - HISTORY_MS
  return history.filter(r => r.ts > cutoff).slice(-HISTORY_MAX)
}

// Dedupe if EITHER:
//  (a) >65% of 4+ char words overlap (catches near-verbatim repeats), OR
//  (b) 2+ named entities or numbers are shared (catches paraphrased repeats
//      of the same factual claim — same subject + same number = same claim).
function isSimilarToRecent(text: string, history: FireRecord[]): boolean {
  if (history.length === 0) return false
  const words = wordSet(text)
  const entities = entitySet(text)
  if (words.size === 0) return false
  for (const rec of history) {
    let wordOverlap = 0
    words.forEach(w => { if (rec.words.has(w)) wordOverlap++ })
    if (wordOverlap / words.size > 0.65) return true
    let entityOverlap = 0
    entities.forEach(e => { if (rec.entities.has(e)) entityOverlap++ })
    if (entityOverlap >= 2) return true
  }
  return false
}

export function canFireFC(text?: string): boolean {
  if (Date.now() - lastFCFire <= SILENCE_GATE.FC_COOLDOWN_MS) return false
  fcHistory = pruneHistory(fcHistory)
  if (text && isSimilarToRecent(text, fcHistory)) return false
  return true
}

export function canFireCynic(text?: string): boolean {
  if (Date.now() - lastCynicFire <= SILENCE_GATE.CYNIC_COOLDOWN_MS) return false
  cynicHistory = pruneHistory(cynicHistory)
  if (text && isSimilarToRecent(text, cynicHistory)) return false
  return true
}

export function recordFCFire(text?: string): void {
  lastFCFire = Date.now()
  if (text) {
    fcHistory.push({ ts: Date.now(), words: wordSet(text), entities: entitySet(text) })
    fcHistory = pruneHistory(fcHistory)
  }
}
export function recordCynicFire(text?: string): void {
  lastCynicFire = Date.now()
  if (text) {
    cynicHistory.push({ ts: Date.now(), words: wordSet(text), entities: entitySet(text) })
    cynicHistory = pruneHistory(cynicHistory)
  }
}
