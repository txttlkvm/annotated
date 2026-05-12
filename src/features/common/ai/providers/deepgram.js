// providers/deepgram.js

const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const WebSocket = require('ws');

/**
 * Deepgram Provider 클래스. API 키 유효성 검사를 담당합니다.
 */
class DeepgramProvider {
    /**
     * Deepgram API 키의 유효성을 검사합니다.
     * @param {string} key - 검사할 Deepgram API 키
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    static async validateApiKey(key) {
        if (!key || typeof key !== 'string') {
            return { success: false, error: 'Invalid Deepgram API key format.' };
        }
        try {
            // ✨ 변경점: SDK 대신 직접 fetch로 API를 호출하여 안정성 확보 (openai.js 방식)
            const response = await fetch('https://api.deepgram.com/v1/projects', {
                headers: { 'Authorization': `Token ${key}` }
            });

            if (response.ok) {
                return { success: true };
            } else {
                const errorData = await response.json().catch(() => ({}));
                const message = errorData.err_msg || `Validation failed with status: ${response.status}`;
                return { success: false, error: message };
            }
        } catch (error) {
            console.error(`[DeepgramProvider] Network error during key validation:`, error);
            return { success: false, error: error.message || 'A network error occurred during validation.' };
        }
    }
}

// TWiST keyword list — boosts proper noun accuracy for podcast transcription
const TWIST_KEYWORDS = [
  // Hosts
  'Jason:2', 'Calacanis:2', 'Lon:2', 'Harris:1.5',
  'Alex:2', 'Wilhelm:2', 'Oliver:1.5', 'Korzen:2', 'Nick:1.5',
  // Frequent guests 2025
  'Anton:2', 'Osika:2', 'Anastasis:2', 'Germanidis:2',
  'Deedy:2', 'Das:1.5', 'Tyler:1.5', 'Denk:2',
  'Coffeezilla:2', 'Garry:1.5', 'Tan:1.5',
  'Chamath:2', 'Palihapitiya:2', 'Sacks:1.5', 'Friedberg:1.5',
  'Ankur:2', 'Nagpal:2', 'Naval:2', 'Ravikant:1.5',
  'Doug:1.5', 'Leone:2',
  // AI / product companies
  'Lovable:2', 'Cursor:1.5', 'Replit:1.5', 'Bolt:1.5', 'Devin:1.5',
  'Runway:1.5', 'Magnific:2', 'Freepik:2', 'Beehiiv:2',
  'Superhuman:1.5', 'OpenRouter:2', 'Venice:1.5',
  'Perplexity:1.5', 'Anthropic:1.5', 'OpenAI:1.5', 'xAI:1.5',
  'Grok:1.5', 'Mistral:1.5', 'Gemini:1.5', 'Harvey:1.5',
  'Palantir:1.5', 'Robinhood:1.5',
  // VC firms
  'Sequoia:1.5', 'Andreessen:2', 'Horowitz:2',
  'Benchmark:1.5', 'YCombinator:1.5', 'Menlo:1.5',
  // LAUNCH ecosystem / show-specific
  'LAUNCH:2', 'TWiST:2', 'Founder:1.5',
  'openclaw:2',        // Jason Calacanis podcast-specific
  'bestie:1.5',        // All-In hosts
  'All-In:2',          // All-In Podcast / Summit
  // VC / startup jargon
  'SAFE:1.5', 'prorate:1.5', 'ARR:1.5', 'MRR:1.5', 'SPV:1.5',
  'pre-seed:1.5', 'preseed:1.5',
  // Tech terms ASR mangles
  'agentic:1.5', 'vibecoding:2', 'vibe-coding:2',
  'RAG:1.5', 'LLM:1.5', 'AGI:1.5', 'tokenomics:1.5', 'stablecoin:1.5',
  // Other tech
  'Figma:1.5', 'Notion:1.5', 'Stripe:1.5', 'Substack:1.5',
  'Nvidia:1.5', 'SpaceX:1.5', 'Neuralink:1.5',
  'GitHub:1.5', 'Vercel:1.5', 'Supabase:1.5',
];

function createSTT({
    apiKey,
    model = 'nova-3',
    language = 'en-US',
    sampleRate = 24000,
    callbacks = {},
  }) {
    const qs = new URLSearchParams({
      model,
      encoding: 'linear16',
      sample_rate: sampleRate.toString(),
      language,
      smart_format: 'true',
      interim_results: 'true',
      channels: '1',
      diarize: 'true',
      utterance_end_ms: '1500',
      endpointing: '1000',
      filler_words: 'false',
    });

    // keyterms boosts accuracy for Nova-3 (Nova-3 deprecated the legacy
    // weighted-keywords syntax). Strip any :weight suffix that may be left
    // over from older configs — keyterms are unweighted.
    TWIST_KEYWORDS.forEach(kw => qs.append('keyterms', kw.replace(/:\d+(\.\d+)?$/, '')));

    const url = `wss://api.deepgram.com/v1/listen?${qs}`;
  
    const ws = new WebSocket(url, {
      headers: { Authorization: `Token ${apiKey}` },
    });
    ws.binaryType = 'arraybuffer';
  
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => {
        ws.terminate();
        reject(new Error('DG open timeout (10 s)'));
      }, 10_000);
  
      ws.on('open', () => {
        clearTimeout(to);
        resolve({
          sendRealtimeInput: (buf) => ws.send(buf),
          close: () => ws.close(1000, 'client'),
        });
      });
  
      ws.on('message', raw => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        if (msg.channel?.alternatives?.[0]?.transcript !== undefined) {
          callbacks.onmessage?.({ provider: 'deepgram', ...msg });
        }
      });
  
      ws.on('close', (code, reason) =>
        callbacks.onclose?.({ code, reason: reason.toString() })
      );
  
      ws.on('error', err => {
        clearTimeout(to);
        callbacks.onerror?.(err);
        reject(err);
      });
    });
  }

// ... (LLM 관련 Placeholder 함수들은 그대로 유지) ...
function createLLM(opts) {
  console.warn("[Deepgram] LLM not supported.");
  return { generateContent: async () => { throw new Error("Deepgram does not support LLM functionality."); } };
}
function createStreamingLLM(opts) {
  console.warn("[Deepgram] Streaming LLM not supported.");
  return { streamChat: async () => { throw new Error("Deepgram does not support Streaming LLM functionality."); } };
}

// ── Group consecutive Deepgram words by speaker ID ──
// Returns: [{ speaker: 'S0', text: '...' }, { speaker: 'S1', text: '...' }, ...]
function wordsToSpeakerSegments(words = []) {
  const segments = [];
  let current = null;
  for (const w of words) {
    const word = w.punctuated_word || w.word || '';
    if (!word) continue;
    const speaker = 'S' + (w.speaker ?? 0);
    if (!current || current.speaker !== speaker) {
      if (current) segments.push(current);
      current = { speaker, text: word };
    } else {
      current.text += ' ' + word;
    }
  }
  if (current) segments.push(current);
  return segments.map(s => ({ ...s, text: s.text.replace(/\s{2,}/g, ' ').trim() }));
}

module.exports = {
    DeepgramProvider,
    createSTT,
    createLLM,
    createStreamingLLM,
    wordsToSpeakerSegments,
};