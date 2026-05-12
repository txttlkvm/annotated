// Nova-3 with keyterms. Nova-3 deprecated the :weight syntax; keyterms are
// unweighted but get strong recognition bias. Multi-word terms ("Larry Summers",
// "All-In Podcast") are supported and are stronger than single tokens.
export const DEEPGRAM_CONFIG = {
  model: 'nova-3',
  encoding: 'linear16',
  sample_rate: 16000,
  diarize: true,
  smart_format: true,
  no_delay: true,
  interim_results: true,
  utterance_end_ms: 1500,  // longer window → fewer mid-sentence breaks
  endpointing: 500,         // wait 500ms silence before finalising utterance
  keyterms: [
    // ── TWiST hosts ──
    'Jason Calacanis', 'Jason', 'Calacanis',
    'Lon Harris', 'Lon', 'Harris',
    'Alex Wilhelm', 'Alex', 'Wilhelm',
    'Oliver Korzen', 'Oliver', 'Korzen',
    'Nick Calacanis', 'Nick',

    // ── Frequent guests 2025 ──
    'Anton Osika', 'Osika',                  // Lovable CEO
    'Anastasis Germanidis', 'Germanidis',    // Runway CTO
    'Deedy Das', 'Deedy',                    // Menlo Ventures
    'Tyler Denk',                            // Beehiiv CEO
    'Coffeezilla', 'Stephen Findeisen',
    'Garry Tan',                             // YC President
    'Chamath Palihapitiya', 'Chamath', 'Palihapitiya',  // All-In (ASR mangles to "shut your mom")
    'David Sacks', 'Sacks',
    'David Friedberg', 'Friedberg',
    'Ankur Nagpal', 'Ankur', 'Nagpal',
    'Naval Ravikant', 'Naval', 'Ravikant',
    'Doug Leone',                            // Sequoia
    'Larry Summers',                         // recurring All-In guest
    'Bill Gurley',                           // Benchmark
    'Brad Gerstner',                         // Altimeter
    'Vinod Khosla', 'Khosla',
    'Marc Andreessen', 'Marc',
    'Ben Horowitz',
    'Peter Thiel', 'Thiel',
    'Sam Altman', 'Altman',
    'Dario Amodei', 'Amodei',
    'Elon Musk',

    // ── AI / Product companies ──
    'Lovable', 'Cursor', 'Replit', 'Bolt', 'Devin',
    'Runway', 'Magnific', 'Freepik',
    'Beehiiv', 'Superhuman', 'OpenRouter',
    'Venice AI',
    'Perplexity', 'Anthropic', 'OpenAI', 'xAI', 'Grok',
    'Mistral', 'Gemini', 'Claude',
    'Harvey',
    'Palantir', 'Robinhood',

    // ── VC firms ──
    'Sequoia', 'Andreessen Horowitz', 'a16z',
    'Benchmark', 'Y Combinator', 'YCombinator',
    'Menlo Ventures', 'Founders Fund',

    // ── LAUNCH ecosystem / show-specific ──
    'LAUNCH', 'TWiST',
    'openclaw',
    'bestie', 'besties',                     // All-In hosts self-reference
    'All-In', 'All-In Podcast', 'All-In Summit',
    'LAUNCH Festival',
    'LAUNCH Accelerator',
    'This Week in Startups',

    // ── VC / startup jargon ──
    'SAFE', 'pro-rata', 'prorata',
    'ARR', 'MRR', 'SPV',
    'pre-seed', 'preseed',

    // ── Tech terms ASR mangles ──
    'agentic', 'vibecoding', 'vibe coding',
    'RAG', 'LLM', 'AGI',
    'tokenomics', 'stablecoin',
    'on-chain',

    // ── Other tech ──
    'Figma', 'Notion', 'Stripe', 'Substack',
    'Nvidia', 'SpaceX', 'Tesla', 'Neuralink',
    'GitHub', 'Vercel', 'Supabase',
    'TechCrunch',
  ]
}

// Known host/guest name map — speaker label → display name
// Populated by auto-detection in overlay page; fallback entries here.
// TWiST regular hosts: Jason Calacanis, Lon Harris, Alex Wilhelm, Oliver Korzen
export const KNOWN_SPEAKER_NAMES: Record<string, string> = {
  jason: 'Jason',
  calacanis: 'Jason',
  lon: 'Lon',
  harris: 'Lon',
  alex: 'Alex',
  wilhelm: 'Alex',
  oliver: 'Oliver',
  korzen: 'Oliver',
  nick: 'Nick',
  ankur: 'Ankur',
  nagpal: 'Ankur',
  naval: 'Naval',
  ravikant: 'Naval',
}

export const SILENCE_GATE = {
  // Cooldowns gate how often the same persona can fire on the same speaker.
  // 15s was too tight for dense informational speech (history facts,
  // tutorials, news monologues) — speakers stack 3-5 distinct verifiable
  // claims in a row and only one would surface. The rolling-history vocab
  // dedupe (40% overlap threshold in silenceGate.ts) still catches genuine
  // repeats, so a shorter time-based cooldown is safe.
  FC_COOLDOWN_MS: 1000,
  // Cynic was over-firing relative to FC. Pushed 15s → 30s to enforce a
  // ~50/50 ratio — at most 2 Cynic cards/min while FC can fire every second
  // a real claim lands. Plus prompt below is tightened to top-4 fallacies.
  CYNIC_COOLDOWN_MS: 30000,
  FC_MAX_TOKENS: 700,
  CYNIC_MAX_TOKENS: 250,
}
