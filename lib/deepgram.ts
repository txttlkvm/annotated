// NOTE: this file is a stale duplicate of pickleglass_web/lib/deepgram.ts and
// is not currently imported anywhere. Kept in sync (model: 'nova-3', keyterms)
// to avoid surprises if anything ever requires it.
export const DEEPGRAM_CONFIG = {
  model: 'nova-3',
  encoding: 'linear16',
  sample_rate: 16000,
  diarize: true,
  smart_format: true,
  no_delay: true,
  interim_results: true,
  utterance_end_ms: 1000,
  keyterms: [
    'Chamath Palihapitiya', 'Chamath', 'Palihapitiya', 'Calacanis',
    'Sequoia', 'Benchmark', 'Andreessen Horowitz',
    'Sacks', 'Friedberg', 'Sacca', 'Ackman', 'Weinstein',
    'OpenAI', 'Anthropic', 'Perplexity',
    'Grok', 'Nvidia', 'AngelList',
    'Substack', 'Ramp', 'Brex', 'Figma',
    'TWiST', 'LAUNCH',
  ],
}

export const SILENCE_GATE = {
  FC_COOLDOWN_MS: 15000,
  CYNIC_COOLDOWN_MS: 10000,
  FC_MAX_TOKENS: 80,
  CYNIC_MAX_TOKENS: 60,
}
