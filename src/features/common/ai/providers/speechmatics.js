// providers/speechmatics.js
// Real-time transcription via Speechmatics RT WebSocket API

const WebSocket = require('ws');

// ── TWiST-specific vocabulary — boosts accuracy for Jason Calacanis podcast context ──
const TWIST_VOCAB = [
  // Context-specific / easily mangled
  { content: 'openclaw', sounds_like: ['open claw', 'open clue'] },
  { content: 'vibecoding', sounds_like: ['vibe coding', 'vibe code'] },
  { content: 'vibe-coding' },
  { content: 'agentic' },
  { content: 'prorate', sounds_like: ['pro rata', 'pro-rata'] },

  // ── TWiST / LAUNCH ecosystem ──
  { content: 'TWiST' },
  { content: 'LAUNCH' },
  { content: 'LAUNCH Festival' },
  { content: 'LAUNCH Accelerator' },
  { content: 'This Week in Startups' },
  { content: 'All-In Summit' },
  { content: 'All-In Podcast' },
  { content: 'bestie' },  // how All-In hosts address each other

  // ── Hosts ──
  { content: 'Calacanis', sounds_like: ['cuh-LAH-kuh-nis'] },
  { content: 'Jason Calacanis' },
  { content: 'Lon Harris' },
  { content: 'Alex Wilhelm' },
  { content: 'Oliver Korzen' },

  // ── Frequent guests ──
  { content: 'Coffeezilla' },
  { content: 'Chamath', sounds_like: ['sha-MATH', 'shuh-math'] },
  { content: 'Palihapitiya' },
  { content: 'Sacks', sounds_like: ['sax', 'sacks'] },
  { content: 'Friedberg' },
  { content: 'Garry Tan' },
  { content: 'Naval', sounds_like: ['NAY-val'] },
  { content: 'Ravikant' },
  { content: 'Doug Leone' },
  { content: 'Deedy Das' },
  { content: 'Tyler Denk' },
  { content: 'Anton Osika' },
  { content: 'Anastasis Germanidis' },
  { content: 'Ankur Nagpal' },

  // ── AI / product companies ──
  { content: 'Lovable' },
  { content: 'Beehiiv', sounds_like: ['bee hive', 'B hive'] },
  { content: 'OpenRouter' },
  { content: 'Perplexity' },
  { content: 'Anthropic' },
  { content: 'Replit', sounds_like: ['REP-lit', 'rep-LIT'] },
  { content: 'Magnific' },
  { content: 'Freepik' },
  { content: 'Superhuman' },
  { content: 'Harvey AI' },
  { content: 'Grok' },
  { content: 'Mistral' },
  { content: 'Palantir' },
  { content: 'Robinhood' },
  { content: 'Venice AI' },
  { content: 'Runway' },

  // ── VC firms ──
  { content: 'Sequoia' },
  { content: 'Andreessen Horowitz' },
  { content: 'a16z' },
  { content: 'YCombinator', sounds_like: ['Y Combinator', 'why combinator'] },
  { content: 'Menlo Ventures' },
  { content: 'Founders Fund' },
  { content: 'Benchmark Capital' },

  // ── Startup jargon ASR mangles ──
  { content: 'SAFE note' },
  { content: 'ARR', sounds_like: ['A R R'] },
  { content: 'MRR', sounds_like: ['M R R'] },
  { content: 'SPV', sounds_like: ['S P V'] },
  { content: 'AGI', sounds_like: ['A G I'] },
  { content: 'LLM', sounds_like: ['L L M'] },
  { content: 'RAG', sounds_like: ['rag'] },
  { content: 'pre-seed' },
  { content: 'tokenomics' },
  { content: 'stablecoin' },
  { content: 'on-chain' },

  // ── Other tech ──
  { content: 'Supabase' },
  { content: 'Vercel' },
  { content: 'GitHub' },
  { content: 'Substack' },
  { content: 'Notion' },
  { content: 'Figma' },
  { content: 'Neuralink' },
  { content: 'Techcrunch' },
];

// ── Get short-lived JWT from Speechmatics management platform ──
async function getJwt(apiKey) {
  const res = await fetch('https://mp.speechmatics.com/v1/api_keys?type=rt', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ttl: 3600 }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Speechmatics JWT ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.key_value;
}

// ── Extract plain text from a Speechmatics results array ──
function resultsToText(results = []) {
  return results
    .map(r => r.alternatives?.[0]?.content ?? '')
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Group consecutive words by speaker (diarization output) ──
// Returns: [{ speaker: 'S1', text: '...' }, { speaker: 'S2', text: '...' }, ...]
// If the same speaker holds the floor for many words, they end up in one segment.
function resultsToSpeakerSegments(results = []) {
  const segments = [];
  let current = null;
  for (const r of results) {
    const alt = r.alternatives?.[0] ?? {};
    const word = alt.content ?? '';
    if (!word) continue;
    const speaker = alt.speaker || 'UU'; // UU = unknown/unassigned
    const isPunct = /^[.,!?;:'"\)\]]/.test(word);
    if (!current || current.speaker !== speaker) {
      if (current) segments.push(current);
      current = { speaker, text: word };
    } else {
      current.text += (isPunct ? '' : ' ') + word;
    }
  }
  if (current) segments.push(current);
  return segments.map(s => ({ ...s, text: s.text.replace(/\s{2,}/g, ' ').trim() }));
}

// ── Create a real-time STT session ──
function createSTT({ apiKey, language = 'en', sampleRate = 16000, callbacks = {} }) {
  return new Promise(async (resolve, reject) => {
    let jwt;
    try {
      jwt = await getJwt(apiKey);
    } catch (err) {
      return reject(err);
    }

    const url = `wss://eu2.rt.speechmatics.com/v2?jwt=${encodeURIComponent(jwt)}`;
    const ws = new WebSocket(url);

    const to = setTimeout(() => {
      ws.terminate();
      reject(new Error('Speechmatics open timeout (10s)'));
    }, 10_000);

    ws.on('open', () => {
      clearTimeout(to);

      ws.send(JSON.stringify({
        message: 'StartRecognition',
        audio_format: {
          type: 'raw',
          encoding: 'pcm_s16le',
          sample_rate: sampleRate,
        },
        transcription_config: {
          language,
          operating_point: 'enhanced',
          enable_partials: true,
          diarization: 'speaker',
          additional_vocab: TWIST_VOCAB,
        },
      }));

      resolve({
        sendRealtimeInput: (buf) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(buf);
        },
        close: () => {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ message: 'EndOfStream', last_seq_no: 0 }));
            }
          } catch {}
          ws.close(1000, 'client');
        },
      });
    });

    ws.on('message', raw => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      callbacks.onmessage?.({ provider: 'speechmatics', ...msg });
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

class SpeechmaticsProvider {
  static async validateApiKey(key) {
    if (!key?.trim()) return { success: false, error: 'API key required' };
    try {
      await getJwt(key);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

function createLLM() { throw new Error('Speechmatics does not support LLM'); }
function createStreamingLLM() { throw new Error('Speechmatics does not support streaming LLM'); }

module.exports = { SpeechmaticsProvider, createSTT, createLLM, createStreamingLLM, resultsToText, resultsToSpeakerSegments };
