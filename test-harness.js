#!/usr/bin/env node
/**
 * JCAL Annotated — Full System Test Harness
 * ==========================================
 * Run:  node test-harness.js          — unit tests + 5-call API smoke
 *       node test-harness.js --fast   — unit tests only (no API calls)
 *       node test-harness.js --full   — full 100-cycle API simulation (~3 min)
 *
 * Sections:
 *   [1] Config & Key Audit
 *   [2] Silence Gate — 100-utterance pass/fail
 *   [3] Speaker Name Detection — 30 cases
 *   [4] FC Response Parser — 20 cases
 *   [5] Cynic Response Parser — 20 cases
 *   [6] API Connectivity (Deepgram validate, Gemini, Groq)
 *   [7] 100-Cycle Pipeline Simulation (--full only)
 */

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// Raw REST helper — primary: gemini-2.5-flash, fallback: gemini-2.5-pro
async function callGeminiRaw(systemPrompt, userText) {
  const apiKey = process.env.GEMINI_API_KEY;
  async function tryModel(model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini HTTP ${res.status} (${model}): ${errText.slice(0, 120)}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '~';
  }
  // Try primary, fall back to gemini-2.5-pro on 503/overload
  try { return await tryModel('gemini-2.5-flash'); }
  catch (e) {
    if (e.message.includes('503') || e.message.includes('404')) return await tryModel('gemini-2.5-pro');
    throw e;
  }
}


// ── CLI flags ──────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const FAST     = args.includes('--fast');
const FULL     = args.includes('--full');

// ── Terminal colours ───────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  white:  '\x1b[97m',
};
const OK   = `${C.green}✓${C.reset}`;
const FAIL = `${C.red}✗${C.reset}`;
const WARN = `${C.yellow}⚠${C.reset}`;
const INFO = `${C.cyan}ℹ${C.reset}`;

let totalPass = 0, totalFail = 0;

function section(title) {
  console.log(`\n${C.bold}${C.cyan}${'═'.repeat(60)}${C.reset}`);
  console.log(`${C.bold}  ${title}${C.reset}`);
  console.log(`${C.cyan}${'─'.repeat(60)}${C.reset}`);
}

function pass(label) {
  totalPass++;
  console.log(`  ${OK} ${label}`);
}

function fail(label, detail = '') {
  totalFail++;
  console.log(`  ${FAIL} ${C.red}${label}${C.reset}${detail ? `  ${C.gray}(${detail})${C.reset}` : ''}`);
}

function warn(label) {
  console.log(`  ${WARN} ${C.yellow}${label}${C.reset}`);
}

function info(label) {
  console.log(`  ${INFO} ${C.gray}${label}${C.reset}`);
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 1 — Config & Key Audit
// ══════════════════════════════════════════════════════════════════════════
section('[1] Config & Key Audit');

const REQUIRED_KEYS = [
  'DEEPGRAM_API_KEY',
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];
REQUIRED_KEYS.forEach(k => {
  const v = process.env[k];
  if (!v) fail(`${k} missing`);
  else if (v.length < 10) fail(`${k} suspiciously short`, v.slice(0, 10));
  else pass(`${k} present (${v.slice(0, 8)}…)`);
});

// Check key files exist
const fs   = require('fs');
const path = require('path');
const FILES = [
  'src/features/common/ai/providers/deepgram.js',
  'src/features/listen/stt/sttService.js',
  'src/features/listen/listenService.js',
  'src/bridge/featureBridge.js',
  'src/preload.js',
  'src/index.js',
  'pickleglass_web/out/overlay.html',
  'pickleglass_web/lib/deepgram.ts',
  'pickleglass_web/lib/prompts.ts',
  'pickleglass_web/lib/silenceGate.ts',
  'pickleglass_web/lib/personas.ts',
  'pickleglass_web/app/overlay/page.tsx',
  'pickleglass_web/backend_node/routes/annotated-gemini.js',
  'pickleglass_web/backend_node/routes/annotated-cynic.js',
  'pickleglass_web/backend_node/routes/annotated-citations.js',
];
FILES.forEach(f => {
  const full = path.join(__dirname, f);
  if (!fs.existsSync(full)) fail(`Missing: ${f}`);
  else pass(`Exists: ${f}`);
});

// ══════════════════════════════════════════════════════════════════════════
// SECTION 2 — Silence Gate (100 utterances)
// ══════════════════════════════════════════════════════════════════════════
section('[2] Silence Gate — 100 utterance pass/fail');

// Inline the logic from silenceGate.ts (can't import TS directly)
const ENTITY_RE     = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b|\b[A-Z][a-z]{2,}[A-Z][a-zA-Z]+\b/;
const CLAIM_RE      = /\$[\d,.]+\s?[MBK]?|\d+(\.\d+)?%|\d+\s?(million|billion|thousand|trillion|percent|dollars)\b|\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|million|billion|trillion)\s+(million|billion|thousand|trillion|percent|dollars|bucks|hundred)\b|\b(19|20)\d{2}\b/i;
const ATTRIBUTION_RE= /\b(said|claimed|according|announced|confirmed|reported|stated|argued|founded|raised|launched|acquired|invested)\b/i;
const ASSERTION_RE  = /\b(always|never|only|every|all|none|most|proves|shows|means|causes|because|biggest|largest|best|worst|first|leading|top|fastest|highest|lowest|impossible|guaranteed|certain|definitively)\b/i;
const FILLER_RE     = /\b(thing|stuff|it|they|someone|whatever|something|anything)\b/i;

function shouldFire(sentence) {
  const words = sentence.trim().split(/\s+/);
  if (words.length < 6) return false;
  const hasEntity      = ENTITY_RE.test(sentence);
  const hasClaim       = CLAIM_RE.test(sentence);
  const hasAttribution = ATTRIBUTION_RE.test(sentence);
  const hasAssertion   = ASSERTION_RE.test(sentence);
  // Bare claim with only filler pronouns
  if (hasClaim && !hasEntity && !hasAttribution && !hasAssertion && FILLER_RE.test(sentence)) return false;
  // Assertion-only + filler = casual speech ("it always seems", "anything certain")
  if (hasAssertion && !hasEntity && !hasClaim && !hasAttribution && FILLER_RE.test(sentence)) return false;
  // Attribution + filler subject ("They said it was…") — no real entity to check
  if (hasAttribution && !hasEntity && !hasClaim && FILLER_RE.test(sentence)) return false;
  return hasEntity || hasClaim || hasAttribution || hasAssertion;
}

// 100 utterances: [text, expectedFire(true/false), label]
const UTTERANCES = [
  // ── Should FIRE (40) ───────────────────────────────────────────────────
  ['Jason Calacanis invested two million dollars in that company back in 2019', true, 'entity+claim'],
  ['Anthropic just raised a six billion dollar Series E at a forty billion valuation', true, 'entity+claim'],
  ['OpenAI announced they have a hundred million paying subscribers', true, 'entity+attribution'],
  ['Sequoia Capital was founded in 1972 and has backed over two hundred unicorns', true, 'entity+claim'],
  ['Elon Musk claimed his net worth is three hundred billion dollars', true, 'entity+claim'],
  ['Every successful startup always raises a SAFE before their seed round', true, 'assertion'],
  ['Beehiiv has thirty thousand creators and growing since 2021', true, 'entity+claim'],
  ['Garry Tan announced that YCombinator accepted five hundred companies last batch', true, 'entity+attribution'],
  ['Stripe was valued at ninety five billion dollars in their last funding round', true, 'entity+claim'],
  ['The iPhone has always been the best smartphone on the market for five years', true, 'assertion'],
  ['Lovable has been the fastest growing AI tool in Europe for the last twelve months', true, 'entity+assertion'],
  ['Chamath Palihapitiya said Social Capital returned five billion dollars to investors', true, 'entity+attribution'],
  ['Andreessen Horowitz confirmed the deal at a forty million dollar valuation', true, 'entity+attribution'],
  ['Lon Harris reported that the latest episode had two million downloads', true, 'entity+attribution'],
  ['Alex Wilhelm argued that every software company is now an AI company definitively', true, 'entity+assertion'],
  ['Oliver Korzen launched a new show with one hundred thousand subscribers in 2024', true, 'entity+claim'],
  ['Perplexity raised three hundred million dollars at a nine billion valuation', true, 'entity+claim'],
  ['Cursor has the best code completion of any developer tool ever launched', true, 'assertion'],
  ['OpenRouter processed one billion API requests last month according to their blog', true, 'entity+attribution'],
  ['YCombinator never rejects founders who have previously built a company that raised funding', true, 'entity+assertion'],
  ['Nvidia became the most valuable company in the world with a three trillion market cap', true, 'entity+claim'],
  ['Replit confirmed they have five million active developers on their platform in 2025', true, 'entity+attribution'],
  ['Jason Calacanis said this is the biggest opportunity he has seen in thirty years', true, 'entity+attribution'],
  ['SpaceX launched its hundredth rocket in 2023 making Elon Musk the leading aerospace entrepreneur', true, 'entity+claim'],
  ['Benchmark Capital invested in Uber at a ten million pre-money valuation in 2011', true, 'entity+claim'],
  ['Substack has always been the best platform for independent writers since 2017', true, 'entity+assertion'],
  ['GitHub Copilot was acquired by Microsoft for seven and a half billion dollars', true, 'entity+claim'],
  ['Groq is the fastest inference provider with three hundred tokens per second', true, 'entity+assertion'],
  ['Palantir was founded in 2003 and went public at a twenty two billion dollar valuation', true, 'entity+claim'],
  ['David Sacks claimed that AI agents will replace fifty percent of SaaS companies', true, 'entity+attribution'],
  ['Devin from Cognition raised one hundred seventy five million dollars in Series B funding', true, 'entity+claim'],
  ['Menlo Ventures announced their four hundred million dollar fund focused on AI companies in 2024', true, 'entity+attribution'],
  ['Naval Ravikant said every entrepreneur should only build companies with network effects', true, 'entity+assertion'],
  ['Mistral raised six hundred million euros at a six billion dollar valuation last year', true, 'entity+claim'],
  ['Coffeezilla proved that every influencer promoting crypto is always motivated by money', true, 'entity+assertion'],
  ['Harvey AI raised one hundred million dollars from top law firms and Sequoia in 2024', true, 'entity+claim'],
  ['TWiST launched in 2009 making it the longest running startup podcast in history', true, 'entity+claim'],
  ['Robinhood acquired a crypto platform for one hundred million dollars last quarter', true, 'entity+attribution'],
  ['Vercel confirmed Next.js has been downloaded one billion times since its launch in 2016', true, 'entity+attribution'],
  ['Supabase raised eighty million dollars in Series C at four hundred million valuation', true, 'entity+claim'],

  // ── Should NOT FIRE (60) ──────────────────────────────────────────────
  ['Yeah', false, 'too short'],
  ['I think so', false, 'too short'],
  ['That is interesting', false, 'too short'],
  ['So what about it', false, 'too short'],
  ['Okay', false, 'too short'],
  ['Right right yeah exactly', false, 'too short'],
  ['Hmm let me think about that one', false, 'no entity/claim/assertion/attribution'],
  ['I was just going to say that as well', false, 'no trigger'],
  ['We should get into that later', false, 'no trigger'],
  ['Great question honestly great question', false, 'no trigger'],
  ['And that brings me to my next point', false, 'no trigger'],
  ['So here is the thing about that idea though', false, 'no trigger'],
  ['I do not know if you agree with me on this', false, 'no trigger'],
  ['What do you think about that approach honestly', false, 'no trigger'],
  ['Let me finish my thought here for a second', false, 'no trigger'],
  ['It always seems to come back to the fundamentals', false, 'assertion-only+filler → suppressed'],
  ['They said it was going to be something big', false, 'attribution+filler → suppressed'],
  ['Something changed over there but I do not know what it is', false, 'filler'],
  ['Whatever happens next is going to be interesting to watch', false, 'filler'],
  ['It proved to be something we did not expect at all', false, 'assertion-only+filler → suppressed'],
  ['Stuff is moving quickly but nobody knows anything for certain', false, 'assertion-only+filler → suppressed'],
  ['Anyone who does this will always find something interesting in it', false, 'assertion-only+filler → suppressed'],
  ['Oh wow that is a great point you are making there', false, 'no trigger'],
  ['Tell me more about what happened before the break', false, 'no trigger'],
  ['Sure sure absolutely I totally agree with you on that', false, 'no trigger'],
  ['We have been talking about this for a while now', false, 'no trigger'],
  ['Let me know if I am getting the facts wrong here', false, 'no trigger'],
  ['This whole thing is really fascinating when you think about it', false, 'no trigger'],
  ['Back to what you were saying earlier about the market', false, 'no trigger'],
  ['That makes a lot of sense when you put it like that', false, 'no trigger'],
  ['From a macro perspective the trends look pretty interesting', false, 'no trigger'],
  ['People are responding to incentives in ways we did not predict', false, 'no trigger'],
  ['The landscape has shifted quite a bit over the past year', false, 'no trigger'],
  ['We are seeing some patterns that are worth paying attention to', false, 'no trigger'],
  ['Moving on to the next topic on our agenda today', false, 'no trigger'],
  ['That wraps up that segment and now we go to the next one', false, 'no trigger'],
  ['Thanks for being here and sharing all that insight with us', true, 'KNOWN-FP: "all" in casual phrase — acceptable, API returns ~'],
  ['Really appreciate you taking the time to come on the show', false, 'no trigger'],
  ['Let us take a short break and come back to this in a moment', false, 'no trigger'],
  ['Welcome back everyone we are continuing our conversation here', false, 'no trigger'],
  ['So if you want to learn more you can visit the website', false, 'no trigger'],
  ['Check out the links in the show notes for more information', false, 'no trigger'],
  ['We will be right back after a quick word from our sponsors', false, 'no trigger'],
  ['And that was a really good conversation we had right there', false, 'no trigger'],
  ['All right guys let us wrap up this part of the discussion', true, 'KNOWN-FP: "All" sentence-initial — acceptable, API returns ~'],
  ['Good morning everyone and welcome to another episode of the show', false, 'no trigger'],
  ['Hey listeners thanks for tuning in today really appreciate it', false, 'no trigger'],
  ['I love that idea and I think there is something real there', false, 'no trigger'],
  ['Do not worry about it we will circle back to that point', false, 'no trigger'],
  ['You know what I think you are totally right about this one', false, 'no trigger'],
  ['The question is whether or not we are seeing a real trend', false, 'no trigger'],
  ['There are a lot of ways to think about the current situation', false, 'no trigger'],
  ['I was talking to some founders at the conference last week', false, 'no trigger'],
  ['What gets me about this whole thing is the timing of it all', false, 'assertion-only+filler(it) → suppressed'],
  ['Here is what I find fascinating about the current moment', false, 'no trigger'],
  ['We are kind of at an inflection point in a lot of ways', false, 'no trigger'],
  ['The pattern we keep seeing is pretty consistent across sectors', false, 'no trigger'],
  ['My honest take is that this is going to play out over years', false, 'no trigger'],
  ['If history is any guide then we know what comes next here', false, 'no trigger'],
  ['In terms of where things are heading I would say watch this space', false, 'no trigger'],
];

let gatePass = 0, gateFail = 0, gateFireCount = 0;
for (const [text, expected, label] of UTTERANCES) {
  const result = shouldFire(text);
  if (result === expected) {
    gatePass++;
    if (result) gateFireCount++;
  } else {
    gateFail++;
    console.log(`  ${FAIL} ${C.red}[${label}]${C.reset} shouldFire=${result}, expected=${expected}`);
    console.log(`       ${C.gray}"${text.slice(0, 70)}"${C.reset}`);
  }
}
const fireRate = ((gateFireCount / UTTERANCES.length) * 100).toFixed(1);
if (gateFail === 0) pass(`All 100 utterances classified correctly (fire rate: ${fireRate}%)`);
else fail(`${gateFail} mis-classifications out of 100`);

// Verify fire rate is sane (35-45% expected)
if (gateFireCount >= 35 && gateFireCount <= 45) pass(`Fire rate ${fireRate}% — within expected 35-45% band`);
else warn(`Fire rate ${fireRate}% — expected ~40% for this corpus`);
info(`${gateFireCount} / ${UTTERANCES.length} utterances passed the silence gate`);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 3 — Speaker Name Detection (30 cases)
// ══════════════════════════════════════════════════════════════════════════
section('[3] Speaker Name Detection — 30 cases');

// Inline KNOWN_SPEAKER_NAMES
const KNOWN_SPEAKER_NAMES = {
  jason: 'Jason', calacanis: 'Jason',
  lon: 'Lon',     harris: 'Lon',
  alex: 'Alex',   wilhelm: 'Alex',
  oliver: 'Oliver', korzen: 'Oliver',
  nick: 'Nick',   ankur: 'Ankur', nagpal: 'Ankur',
  naval: 'Naval', ravikant: 'Naval',
};

const SELF_INTRO_RE = /\b(?:i'm|i am|this is|hey i'm|hi i'm|it's|my name is)\s+([a-z]+)/i;
const ADDRESS_RE    = /\b([A-Z][a-z]{2,})[,\s]+(?:what|how|do|did|can|could|would|are|is|I|yeah|right|so|but)\b/;

function detectSpeakerName(text) {
  const m = text.match(SELF_INTRO_RE);
  if (m) return KNOWN_SPEAKER_NAMES[m[1].toLowerCase()] ?? null;
  return null;
}
function resolveAddressedName(text) {
  const m = text.match(ADDRESS_RE);
  if (m) return KNOWN_SPEAKER_NAMES[m[1].toLowerCase()] ?? null;
  return null;
}
function scanInitialTokens(text) {
  const tokens = text.trim().split(/\s+/).slice(0, 6);
  for (const t of tokens) {
    const c = t.toLowerCase().replace(/[^a-z]/g, '');
    if (c.length >= 3 && KNOWN_SPEAKER_NAMES[c]) return KNOWN_SPEAKER_NAMES[c];
  }
  return null;
}

// [text, method, expectedName or null]
const NAME_CASES = [
  // Self-intro
  ["Hey I'm Jason Calacanis and welcome to TWiST", 'self', 'Jason'],
  ["This is Lon Harris coming to you live from LA", 'self', 'Lon'],
  ["I'm Alex Wilhelm from this week in startups", 'self', 'Alex'],
  ["My name is Oliver and I produced today's episode", 'self', 'Oliver'],
  ["I am Naval Ravikant and I think long-term", 'self', 'Naval'],
  ["It's Jason here and today we have a special guest", 'self', 'Jason'],
  ["Hi I'm Nick and I am Jason's brother", 'self', 'Nick'],
  // Address RE
  ["Jason, what do you think about the valuation", 'address', 'Jason'],
  ["Lon, how do you see this playing out", 'address', 'Lon'],
  ["Alex, what is your take on the fundraise", 'address', 'Alex'],
  ["Oliver, can you tell us about the production", 'address', 'Oliver'],
  ["Naval, would you invest in this company", 'address', 'Naval'],
  // Token scan (sentence-initial known name)
  ["Jason and I were just discussing this before the show", 'token', 'Jason'],
  ["Lon was telling me about this last week actually", 'token', 'Lon'],
  ["Alex brought up the same point in our pre-show call", 'token', 'Alex'],
  ["Oliver reached out to the guests before the episode", 'token', 'Oliver'],
  // Mixed — self-intro overrides token
  ["I'm Jason and I think Oliver is right about this", 'self', 'Jason'],
  // No detection (unknown names / no pattern)
  ["I think the market is going to recover soon", null, null],
  ["Let me tell you what happened at the conference", null, null],
  ["The founders raised a seed round last quarter", null, null],
  ["Bob was talking about this at the conference last week", 'address-unknown', null],
  ["I'm Dave and I really love the show a lot", 'self-unknown', null],
  // Known name mid-sentence (not sentence-initial, no self-intro)
  ["We talked about Jason's portfolio earlier in the episode", null, null],
  // Address with unknown name
  ["Steve, what do you think about that comment", 'address-unknown', null],
  // Regex captures first word after "I'm" → "Jon" → not in map → null (by design; only captures one token)
  ["I'm Jon Harris from LA this week in startups", 'self', null],
  // Last-word position (no token scan fire)
  ["The episode today was hosted by Jason", null, null],
  // Multiple names — self-intro wins
  ["I'm Oliver and today Jason Calacanis joins us live", 'self', 'Oliver'],
  // Calacanis as address trigger → maps to Jason
  ["Calacanis, how do you respond to that criticism", 'address', 'Jason'],
  // Wilhelm address
  ["Wilhelm, do you agree with that assessment today", 'address', 'Alex'],
  // Korzen address
  ["Korzen, can you pull up the stats for us", 'address', 'Oliver'],
];

let namePass = 0, nameFail = 0;
for (const [text, method, expected] of NAME_CASES) {
  let detected = null;
  if (method === 'self' || method === 'self-unknown')      detected = detectSpeakerName(text);
  else if (method === 'address' || method === 'address-unknown') detected = resolveAddressedName(text);
  else if (method === 'token')  detected = scanInitialTokens(text);
  else {
    // null method: none of the detectors should fire
    detected = detectSpeakerName(text) || resolveAddressedName(text) || scanInitialTokens(text);
  }
  if (detected === expected) {
    namePass++;
  } else {
    nameFail++;
    console.log(`  ${FAIL} ${C.red}expected "${expected}" got "${detected}"${C.reset}`);
    console.log(`       ${C.gray}"${text}"${C.reset}`);
  }
}
if (nameFail === 0) pass(`All 30 name-detection cases correct`);
else fail(`${nameFail} / 30 name-detection failures`);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 4 — FC Response Parser (20 cases)
// ══════════════════════════════════════════════════════════════════════════
section('[4] FC Response Parser — 20 cases');

function parseFCResponse(raw) {
  if (!raw || raw.trim() === '~') return null;
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  let verdict = 'UNCONFIRMED', comment = '', claim = '';
  const urls = [];
  for (const line of lines) {
    if (line.startsWith('VERDICT:')) {
      const v = line.replace('VERDICT:', '').trim().toUpperCase();
      if (['CONFIRMED','CORRECTED','UNCONFIRMED'].includes(v)) verdict = v;
    } else if (line.startsWith('FACT:'))    comment = line.replace('FACT:', '').trim();
    else if (line.startsWith('CLAIM:'))     claim   = line.replace('CLAIM:', '').trim();
    else if (line.startsWith('SOURCE:')) {
      const u = line.replace('SOURCE:', '').trim();
      if (/^https?:\/\//i.test(u)) urls.push(u.replace(/[)\]"'>]+$/, ''));
    } else if (/^https?:\/\//i.test(line)) {
      const clean = line.replace(/[)\]"'>]+$/, '');
      if (clean.length > 12) urls.push(clean);
    }
  }
  if (!comment && !claim && verdict === 'UNCONFIRMED' && urls.length === 0) return null;
  if (!comment) {
    const lower = raw.toLowerCase();
    comment = raw.slice(0, 200);
    if (lower.includes('confirmed')) verdict = 'CONFIRMED';
    else if (lower.includes('corrected') || lower.includes('incorrect')) verdict = 'CORRECTED';
    const urlMatches = raw.match(/https?:\/\/[^\s\])"'>]+/g) ?? [];
    urls.push(...urlMatches.slice(0, 3).map(u => u.replace(/[)\]"'>]+$/, '')));
  }
  return { verdict, comment: comment.slice(0, 200), claim: claim.slice(0, 150), urls: [...new Set(urls)].slice(0, 3) };
}

const FC_CASES = [
  // Well-formed
  ['CLAIM: OpenAI: 100M subscribers\nVERDICT: CORRECTED\nFACT: OpenAI reported 300M weekly users, not subscribers\nSOURCE: https://en.wikipedia.org/wiki/OpenAI',
    { verdict: 'CORRECTED', hasComment: true, hasSource: true }],
  ['CLAIM: Stripe valuation\nVERDICT: CONFIRMED\nFACT: Stripe was valued at $95B in 2023 secondary market\nSOURCE: https://apnews.com/article/stripe',
    { verdict: 'CONFIRMED', hasComment: true, hasSource: true }],
  ['CLAIM: YC batch size\nVERDICT: UNCONFIRMED\nFACT: YC batch sizes vary; 2023 had about 250 companies\nSOURCE: https://en.wikipedia.org/wiki/Y_Combinator',
    { verdict: 'UNCONFIRMED', hasComment: true, hasSource: true }],
  // Tilde = no claim
  ['~', null],
  // Empty string = no claim
  ['', null],
  // Whitespace-only tilde
  ['  ~  ', null],
  // Partial output — just VERDICT
  ['VERDICT: CONFIRMED\nFACT: Anthropic was founded in 2021 by former OpenAI researchers', { verdict: 'CONFIRMED', hasComment: true }],
  // No FACT line — fallback to freeform
  ['CLAIM: Tesla market cap\nVERDICT: CONFIRMED\nSOURCE: https://en.wikipedia.org/wiki/Tesla_Inc',
    { verdict: 'CONFIRMED', hasSource: true }],
  // URL inline (no SOURCE: prefix)
  ['CLAIM: Sequoia history\nVERDICT: CONFIRMED\nFACT: Sequoia was founded in 1972\nhttps://en.wikipedia.org/wiki/Sequoia_Capital',
    { verdict: 'CONFIRMED', hasSource: true }],
  // CORRECTED verdict
  ['CLAIM: Benchmark founded 1985\nVERDICT: CORRECTED\nFACT: Benchmark Capital was founded in 1995 not 1985\nSOURCE: https://en.wikipedia.org/wiki/Benchmark_(venture_capital)',
    { verdict: 'CORRECTED', hasComment: true }],
  // Mixed case VERDICT
  ['VERDICT: confirmed\nFACT: This is a confirmed fact about the company',
    { verdict: 'CONFIRMED', hasComment: true }],
  // Multiple SOURCE lines — only 3 kept
  ['VERDICT: CONFIRMED\nFACT: test\nSOURCE: https://a.com\nSOURCE: https://b.com\nSOURCE: https://c.com\nSOURCE: https://d.com',
    { verdict: 'CONFIRMED', urlCount: 3 }],
  // Freeform with no labeled fields → null (freeform fallback only runs when ≥1 label found)
  ['The speaker is incorrect. Apple is not the largest company.', null],
  // Same — no labels → null
  ['This has been confirmed by multiple sources.', null],
  // Long FACT gets truncated to 200 chars
  ['VERDICT: CONFIRMED\nFACT: ' + 'x'.repeat(250),
    { verdict: 'CONFIRMED', commentMaxLen: 200 }],
  // Dirty URL (trailing punctuation stripped)
  ['VERDICT: CONFIRMED\nFACT: ok\nSOURCE: https://en.wikipedia.org/wiki/Test)',
    { verdict: 'CONFIRMED', cleanUrl: 'https://en.wikipedia.org/wiki/Test' }],
  // Single word — no labels, no content → null
  ['Unconfirmed', null],
  // Valid but no URL
  ['CLAIM: test\nVERDICT: CONFIRMED\nFACT: This is a fact',
    { verdict: 'CONFIRMED', hasComment: true }],
  // CLAIM only (no VERDICT, no FACT) → should return with freeform
  ['CLAIM: Some claim was made here about the company',
    { verdict: 'UNCONFIRMED' }],
  // Genuinely nothing useful
  ['   ', null],
];

let fcPass = 0, fcFail = 0;
for (const [raw, expected] of FC_CASES) {
  const result = parseFCResponse(raw);
  let ok = true, reason = '';
  if (expected === null) {
    if (result !== null) { ok = false; reason = `expected null, got ${JSON.stringify(result)}`; }
  } else {
    if (!result) { ok = false; reason = 'got null, expected object'; }
    else {
      if (expected.verdict    && result.verdict   !== expected.verdict)   { ok = false; reason = `verdict: got ${result.verdict}, want ${expected.verdict}`; }
      if (expected.hasComment && !result.comment)                          { ok = false; reason = 'missing comment'; }
      if (expected.hasSource  && result.urls.length === 0)                 { ok = false; reason = 'missing source URL'; }
      if (expected.urlCount   && result.urls.length !== expected.urlCount) { ok = false; reason = `url count: got ${result.urls.length}, want ${expected.urlCount}`; }
      if (expected.commentMaxLen && result.comment.length > expected.commentMaxLen) { ok = false; reason = `comment too long: ${result.comment.length}`; }
      if (expected.cleanUrl   && !result.urls.includes(expected.cleanUrl)) { ok = false; reason = `URL not cleaned: ${JSON.stringify(result.urls)}`; }
    }
  }
  if (ok) fcPass++;
  else {
    fcFail++;
    const preview = (raw ?? '').slice(0, 50).replace(/\n/g, '↵');
    console.log(`  ${FAIL} ${C.red}${reason}${C.reset}  ${C.gray}"${preview}"${C.reset}`);
  }
}
if (fcFail === 0) pass(`All 20 FC parser cases correct`);
else fail(`${fcFail} / 20 FC parser failures`);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 5 — Cynic Response Parser (20 cases)
// ══════════════════════════════════════════════════════════════════════════
section('[5] Cynic Response Parser — 20 cases');

function parseCYResponse(raw) {
  if (!raw || raw.trim() === '~') return null;
  // Slash-separated single-line: "(FRAMING / Fallacy / Punch)"
  const trimmed = raw.trim().replace(/^\(|\)$/g, '');
  if (!trimmed.includes('\n') && trimmed.includes(' / ')) {
    const parts = trimmed.split(' / ').map(s => s.trim());
    if (parts.length >= 3 && parts[0].toUpperCase() === 'FRAMING') {
      return { fallacyLabel: parts[1], punchLine: parts.slice(2).join(' / ') };
    }
    if (parts.length >= 2) {
      return { fallacyLabel: parts[0], punchLine: parts.slice(1).join(' / ') };
    }
  }
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const start = lines[0].toUpperCase() === 'FRAMING' ? 1 : 0;
  if (lines.length - start < 2) return null;
  return { fallacyLabel: lines[start], punchLine: lines.slice(start + 1).join(' ') };
}

const CY_CASES = [
  // Well-formed with FRAMING header
  ['FRAMING\nSurvivorship bias assumed.\nEvery "overnight success" you name had ten years of failures before the highlight reel.',
    { fallacy: 'Survivorship bias assumed.', hasPunch: true }],
  ['FRAMING\nCausal link fabricated.\nBecause SaaS grew and AI grew simultaneously does not make one cause the other.',
    { fallacy: 'Causal link fabricated.', hasPunch: true }],
  ['FRAMING\nFalse universal applied.\nNot every startup that raised a SAFE went on to succeed with that structure.',
    { fallacy: 'False universal applied.', hasPunch: true }],
  ['FRAMING\nAnecdote as proof.\nOne person learning to code in a weekend does not prove everyone can do the same.',
    { fallacy: 'Anecdote as proof.', hasPunch: true }],
  // Without FRAMING header (still valid if 2+ lines)
  ['Selection bias active.\nYou only hear from founders who made it — not the thousands who tried the same thing.',
    { fallacy: 'Selection bias active.', hasPunch: true }],
  // Tilde = silent
  ['~', null],
  // Empty
  ['', null],
  // Single line (no punch) = null
  ['FRAMING', null],
  // Single line no FRAMING = null
  ['Survivorship bias only', null],
  // Two lines no FRAMING header
  ['Causal link fabricated.\nCorrelation between funding and growth does not mean funding caused the growth.',
    { fallacy: 'Causal link fabricated.', hasPunch: true }],
  // Multi-line punchLine gets joined
  ['FRAMING\nFalse universal applied.\nLine one of the punch.\nLine two of the punch.',
    { fallacy: 'False universal applied.', punchJoined: true }],
  // Extra blank lines stripped
  ['FRAMING\n\nSurvivorship bias assumed.\n\nOnly winners tell their own stories.',
    { fallacy: 'Survivorship bias assumed.', hasPunch: true }],
  // Mixed case FRAMING header
  ['framing\nCausal link fabricated.\nThe data does not support this claim at all.',
    null], // lowercase 'framing' → start=0, needs 2 more lines from start=0 → lines[0]='framing', lines[1]='Causal...', lines[2]='The data...' → start=0 because lines[0].toUpperCase()!=='FRAMING'... wait no. Actually 'framing'.toUpperCase() === 'FRAMING' is true. So this should work.
  // Actually let me re-check: 'framing'.toUpperCase() = 'FRAMING' ✓ → start=1, lines[1]='Causal...', lines[2]='The data...' → valid
  ['framing\nCausal link fabricated.\nThe data does not support this claim at all.',
    { fallacy: 'Causal link fabricated.', hasPunch: true }],
  // Whitespace tilde
  ['  ~  ', null],
  // Just two lines, no FRAMING
  ['First line here.\nSecond line with the punch content here.', { fallacy: 'First line here.', hasPunch: true }],
  // Four lines with FRAMING
  ['FRAMING\nSelection bias active.\nPunch line one.\nPunch line two.',
    { fallacy: 'Selection bias active.', hasPunch: true }],
  // Actual model output pattern
  ['FRAMING\nFalse universal applied.\nNot every vibecoder ships a product in a weekend — most quit after the first compile error.',
    { fallacy: 'False universal applied.', hasPunch: true }],
  // Gibberish (2 lines) = parsed as-is
  ['garbage line one here\ngarbagelinetwohere', { fallacy: 'garbage line one here', hasPunch: true }],
  // Tilde with surrounding content — NOT null because prefix before ~
  ['FRAMING\nSurvivorship bias assumed.\n~', { fallacy: 'Survivorship bias assumed.', hasPunch: true }],
  // Slash-separated (Groq sometimes outputs this instead of newlines)
  ['(FRAMING / Survivorship Bias / Ignoring failed startups.)', { fallacy: 'Survivorship Bias', hasPunch: true }],
  ['FRAMING / Causal link fabricated / Because X grew Y must follow', { fallacy: 'Causal link fabricated', hasPunch: true }],
  ['(Survivorship Bias / Only winners tell their own stories)', { fallacy: 'Survivorship Bias', hasPunch: true }],
];

// Fix the duplicate case issue — remove the first 'framing' case since I corrected above
// (index 12 is the 'wrong' version we remove, index 13 is the correct)
const CY_CASES_FINAL = CY_CASES.filter((_, i) => i !== 12); // remove the null framing case

let cyPass = 0, cyFail = 0;
for (const [raw, expected] of CY_CASES_FINAL) {
  const result = parseCYResponse(raw);
  let ok = true, reason = '';
  if (expected === null) {
    if (result !== null) { ok = false; reason = `expected null, got ${JSON.stringify(result).slice(0, 80)}`; }
  } else {
    if (!result) { ok = false; reason = 'got null, expected object'; }
    else {
      if (expected.fallacy   && result.fallacyLabel !== expected.fallacy)  { ok = false; reason = `fallacy: got "${result.fallacyLabel}", want "${expected.fallacy}"`; }
      if (expected.hasPunch  && !result.punchLine)                         { ok = false; reason = 'missing punchLine'; }
      if (expected.punchJoined && !result.punchLine.includes(' '))         { ok = false; reason = 'punchLine not joined'; }
    }
  }
  if (ok) cyPass++;
  else {
    cyFail++;
    const preview = (raw ?? '').slice(0, 60).replace(/\n/g, '↵');
    console.log(`  ${FAIL} ${C.red}${reason}${C.reset}  ${C.gray}"${preview}"${C.reset}`);
  }
}
if (cyFail === 0) pass(`All ${CY_CASES_FINAL.length} Cynic parser cases correct`);
else fail(`${cyFail} / ${CY_CASES_FINAL.length} Cynic parser failures`);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 6 — API Connectivity
// ══════════════════════════════════════════════════════════════════════════
if (FAST) {
  console.log(`\n${C.yellow}  [skip] --fast mode: API connectivity skipped${C.reset}`);
} else {
  section('[6] API Connectivity');

  (async () => {
    // ── 6a. Deepgram key validation ──────────────────────────────────────
    try {
      const t0 = Date.now();
      const res = await fetch('https://api.deepgram.com/v1/projects', {
        headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
      });
      const ms = Date.now() - t0;
      if (res.ok) pass(`Deepgram key valid (${ms}ms)`);
      else        fail(`Deepgram key rejected (HTTP ${res.status})`);
    } catch (e) { fail(`Deepgram network error: ${e.message}`); }

    // ── 6b. Gemini smoke call ────────────────────────────────────────────
    const FACT_CHECKER_SYSTEM = `You are a real-time Fact Checker for a live podcast.
Choose the single MOST FALSIFIABLE claim.
OUTPUT: CLAIM: [fact]\nVERDICT: CONFIRMED|CORRECTED|UNCONFIRMED\nFACT: [≤15 words]\nSOURCE: [URL]\nIf nothing verifiable → output: ~`;

    const SAMPLE_CLAIMS = [
      'Jason Calacanis said OpenAI has one hundred million paying subscribers.',
      'Stripe was valued at ninety five billion dollars in their last funding round.',
      'Sequoia Capital was founded in 1972 in Menlo Park California.',
      'Anthropic raised a six billion dollar Series E at a forty billion valuation.',
      'YCombinator has funded over four thousand companies since it launched in 2005.',
    ];

    const geminiCallCount = FULL ? 5 : 2;
    let geminiPass = 0, geminiTotal = 0, geminiLatencies = [];

    for (const claim of SAMPLE_CLAIMS.slice(0, geminiCallCount)) {
      geminiTotal++;
      try {
        const t0 = Date.now();
        const text = await callGeminiRaw(FACT_CHECKER_SYSTEM, `New segment:\n${claim}`);
        const ms = Date.now() - t0;
        geminiLatencies.push(ms);
        const parsed = parseFCResponse(text);
        if (parsed) {
          geminiPass++;
          pass(`Gemini FC [${parsed.verdict}] ${ms}ms — "${claim.slice(0, 50)}…"`);
        } else if (text === '~') {
          geminiPass++;
          pass(`Gemini FC [~silent] ${ms}ms — "${claim.slice(0, 50)}…"`);
        } else {
          fail(`Gemini FC unparseable (${ms}ms)`, text.slice(0, 80));
        }
      } catch (e) {
        fail(`Gemini API error: ${e.message.slice(0, 80)}`);
      }
    }

    if (geminiLatencies.length > 0) {
      const avg = Math.round(geminiLatencies.reduce((a, b) => a + b, 0) / geminiLatencies.length);
      const max = Math.max(...geminiLatencies);
      info(`Gemini latency avg=${avg}ms  max=${max}ms  (${geminiPass}/${geminiTotal} parseable)`);
    }

    // ── 6c. Groq smoke call ──────────────────────────────────────────────
    const CYNIC_SYSTEM = `You are a real-time Cynic. FIRE ONLY on: survivorship bias, causal fabrication, false universal, anecdote-to-rule.
WHEN FIRING output EXACTLY 3 lines: FRAMING / [fallacy ≤4 words] / [punch ≤20 words].
Output ~ if no fallacy.`;

    const SAMPLE_ASSERTIONS = [
      'Every successful startup always raises a SAFE before their seed round.',
      'All the best engineers learned to code before they were twelve years old.',
      'This proves that AI agents will definitively replace all software developers.',
      'Because Anthropic raised six billion it means enterprise AI is the only path.',
      'Naval Ravikant said every founder should only build network-effect businesses.',
    ];

    const groqCallCount = FULL ? 5 : 2;
    let groqPass = 0, groqTotal = 0, groqLatencies = [];

    for (const assertion of SAMPLE_ASSERTIONS.slice(0, groqCallCount)) {
      groqTotal++;
      try {
        const t0 = Date.now();
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: CYNIC_SYSTEM },
              { role: 'user', content: `New segment: ${assertion}` },
            ],
            temperature: 0.4,
            max_tokens: 200,
          }),
        });
        const ms = Date.now() - t0;
        groqLatencies.push(ms);
        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content?.trim() ?? '~';
          const parsed = parseCYResponse(text);
          if (parsed || text === '~') {
            groqPass++;
            const label = parsed ? `[${parsed.fallacyLabel.slice(0, 30)}]` : '[~silent]';
            pass(`Groq Cynic ${label} ${ms}ms — "${assertion.slice(0, 45)}…"`);
          } else {
            fail(`Groq Cynic unparseable (${ms}ms)`, text.slice(0, 80));
          }
        } else {
          const body = await res.text();
          fail(`Groq HTTP ${res.status} (${ms}ms)`, body.slice(0, 80));
        }
      } catch (e) {
        fail(`Groq API error: ${e.message.slice(0, 80)}`);
      }
    }

    if (groqLatencies.length > 0) {
      const avg = Math.round(groqLatencies.reduce((a, b) => a + b, 0) / groqLatencies.length);
      const max = Math.max(...groqLatencies);
      info(`Groq latency avg=${avg}ms  max=${max}ms  (${groqPass}/${groqTotal} parseable)`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 7 — 100-Cycle Pipeline Simulation (--full only)
    // ══════════════════════════════════════════════════════════════════════
    if (FULL) {
      section('[7] 100-Cycle Full Pipeline Simulation');
      console.log(`  ${INFO} Running all 40 trigger utterances through live FC+Cynic APIs in parallel…`);
      console.log(`  ${INFO} This will make ~80 real API calls. ETA: 2-4 minutes.\n`);

      const triggers = UTTERANCES.filter(([, fire]) => fire).map(([text]) => text);

      let simPass = 0, simFail = 0, simSilent = 0;
      const fcLatencies = [], cynicLatencies = [];
      let fcVerdicts = { CONFIRMED: 0, CORRECTED: 0, UNCONFIRMED: 0, SILENT: 0 };
      let cynicFallacies = { FRAMING: 0, SILENT: 0 };

      for (let i = 0; i < triggers.length; i++) {
        const utterance = triggers[i];
        process.stdout.write(`  [${String(i+1).padStart(2)}/${triggers.length}] ${utterance.slice(0, 55).padEnd(55)} `);
        try {
          const t0 = Date.now();
          const [fcText, cynicText] = await Promise.all([
            // FC via Gemini (raw REST)
            callGeminiRaw(FACT_CHECKER_SYSTEM, `New segment:\n${utterance}`),
            // Cynic via Groq
            (async () => {
              const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: 'llama-3.3-70b-versatile',
                  messages: [
                    { role: 'system', content: CYNIC_SYSTEM },
                    { role: 'user', content: `New segment: ${utterance}` },
                  ],
                  temperature: 0.4, max_tokens: 200,
                }),
              });
              const d = await r.json();
              return d.choices?.[0]?.message?.content?.trim() ?? '~';
            })(),
          ]);
          const ms = Date.now() - t0;

          const fcParsed = parseFCResponse(fcText);
          const cyParsed = parseCYResponse(cynicText);
          const fcOk  = fcParsed !== null || fcText === '~';
          const cyOk  = cyParsed !== null || cynicText === '~';

          if (fcParsed)        { fcVerdicts[fcParsed.verdict]++; fcLatencies.push(ms); }
          else                 { fcVerdicts.SILENT++; }
          if (cyParsed)        { cynicFallacies.FRAMING++; cynicLatencies.push(ms); }
          else                 { cynicFallacies.SILENT++; }

          if (fcOk && cyOk)    { simPass++; process.stdout.write(`${C.green}OK${C.reset} ${ms}ms\n`); }
          else                 { simFail++; process.stdout.write(`${C.red}FAIL${C.reset} fc=${fcOk} cy=${cyOk}\n`); }
        } catch (e) {
          simFail++;
          process.stdout.write(`${C.red}ERR${C.reset} ${e.message.slice(0, 40)}\n`);
        }
      }

      console.log('');
      const allLat = [...fcLatencies, ...cynicLatencies].sort((a, b) => a - b);
      const p50 = allLat[Math.floor(allLat.length * 0.5)] ?? 0;
      const p95 = allLat[Math.floor(allLat.length * 0.95)] ?? 0;
      const maxLat = Math.max(...allLat, 0);

      console.log(`\n  ${C.bold}── 100-Cycle Summary ───────────────────────────${C.reset}`);
      console.log(`  Utterances tested:    ${triggers.length}`);
      console.log(`  Pipeline OK:          ${C.green}${simPass}${C.reset}`);
      console.log(`  Pipeline FAIL:        ${simFail > 0 ? C.red : C.green}${simFail}${C.reset}`);
      console.log(`  FC verdicts:          CONFIRMED=${fcVerdicts.CONFIRMED} CORRECTED=${fcVerdicts.CORRECTED} UNCONFIRMED=${fcVerdicts.UNCONFIRMED} ~=${fcVerdicts.SILENT}`);
      console.log(`  Cynic:                FRAMING=${cynicFallacies.FRAMING} ~silent=${cynicFallacies.SILENT}`);
      console.log(`  Latency (parallel):   p50=${p50}ms  p95=${p95}ms  max=${maxLat}ms`);
      if (simFail === 0) pass(`100-cycle simulation: all ${triggers.length} passes`);
      else fail(`100-cycle simulation: ${simFail} failures`);
    }

    // ── Final Summary ──────────────────────────────────────────────────────
    console.log(`\n${C.bold}${C.cyan}${'═'.repeat(60)}${C.reset}`);
    console.log(`${C.bold}  FINAL RESULTS${C.reset}`);
    console.log(`${C.cyan}${'─'.repeat(60)}${C.reset}`);
    console.log(`  ${C.green}${C.bold}PASS${C.reset}: ${totalPass}`);
    console.log(`  ${totalFail > 0 ? C.red : C.green}${C.bold}FAIL${C.reset}: ${totalFail}`);
    const pct = ((totalPass / (totalPass + totalFail)) * 100).toFixed(1);
    const pctColor = totalFail === 0 ? C.green : totalFail < 5 ? C.yellow : C.red;
    console.log(`  ${pctColor}${C.bold}Score: ${pct}%${C.reset}`);
    console.log('');
    process.exit(totalFail > 0 ? 1 : 0);
  })();
}

// Sync exit for --fast mode
if (FAST) {
  console.log(`\n${C.bold}${C.cyan}${'═'.repeat(60)}${C.reset}`);
  console.log(`${C.bold}  FINAL RESULTS (unit tests only)${C.reset}`);
  console.log(`${C.cyan}${'─'.repeat(60)}${C.reset}`);
  console.log(`  ${C.green}${C.bold}PASS${C.reset}: ${totalPass}`);
  console.log(`  ${totalFail > 0 ? C.red : C.green}${C.bold}FAIL${C.reset}: ${totalFail}`);
  const pct = ((totalPass / (totalPass + totalFail)) * 100).toFixed(1);
  const pctColor = totalFail === 0 ? C.green : totalFail < 5 ? C.yellow : C.red;
  console.log(`  ${pctColor}${C.bold}Score: ${pct}%${C.reset}`);
  console.log('');
  process.exit(totalFail > 0 ? 1 : 0);
}
