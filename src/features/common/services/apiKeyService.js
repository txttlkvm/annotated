/**
 * apiKeyService.js
 *
 * Hybrid API-key resolver for Annotated. Ships with developer-provided keys
 * baked into `.env` (so the app works out of the box for friends-and-family
 * recipients) but lets each recipient paste their own keys via the settings UI
 * when they're ready to use their own quota.
 *
 * Resolution order (first non-empty wins):
 *   1. user-set override (electron-store)
 *   2. process.env (loaded from bundled .env at runtime)
 *
 * Usage:
 *   const { getApiKey, setApiKey, listApiKeys } = require('./apiKeyService');
 *   const key = getApiKey('PYANNOTE_API_KEY');
 */

const Store = require('electron-store');

// Single shared store. Lives in <userData>/config.json.
const _store = new Store({
  name: 'api-keys',
  schema: {
    overrides: { type: 'object', default: {} },
  },
});

// The full set of provider keys the app reads from process.env. Listing them
// here drives the settings UI and the listApiKeys() snapshot.
const KNOWN_KEYS = [
  { name: 'PYANNOTE_API_KEY',     label: 'Pyannote (voice biometrics)',  required: true,  signupUrl: 'https://pyannote.ai' },
  { name: 'SPEECHMATICS_API_KEY', label: 'Speechmatics (transcription)', required: true,  signupUrl: 'https://www.speechmatics.com' },
  { name: 'DEEPGRAM_API_KEY',     label: 'Deepgram (fallback STT)',      required: false, signupUrl: 'https://deepgram.com' },
  { name: 'GEMINI_API_KEY',       label: 'Google Gemini (fact-checker)', required: true,  signupUrl: 'https://aistudio.google.com/apikey' },
  { name: 'OPENAI_API_KEY',       label: 'OpenAI (optional)',            required: false, signupUrl: 'https://platform.openai.com' },
  { name: 'ANTHROPIC_API_KEY',    label: 'Anthropic (optional)',         required: false, signupUrl: 'https://console.anthropic.com' },
  { name: 'GROQ_API_KEY',         label: 'Groq (optional)',              required: false, signupUrl: 'https://console.groq.com' },
];

function getApiKey(name) {
  const overrides = _store.get('overrides') || {};
  const override = overrides[name];
  if (override && String(override).trim()) return String(override).trim();
  const envVal = process.env[name];
  return envVal && String(envVal).trim() ? String(envVal).trim() : null;
}

function setApiKey(name, value) {
  const overrides = { ...(_store.get('overrides') || {}) };
  if (value && String(value).trim()) {
    overrides[name] = String(value).trim();
  } else {
    delete overrides[name];
  }
  _store.set('overrides', overrides);
}

function clearApiKey(name) {
  const overrides = { ...(_store.get('overrides') || {}) };
  delete overrides[name];
  _store.set('overrides', overrides);
}

/**
 * Returns one row per known key, with masked values, source ("user" | "bundled"
 * | "missing"), and signup info — for the settings UI.
 */
function listApiKeys() {
  const overrides = _store.get('overrides') || {};
  return KNOWN_KEYS.map(meta => {
    const userVal = overrides[meta.name];
    const envVal = process.env[meta.name];
    const effective = (userVal && String(userVal).trim()) ? String(userVal).trim()
                    : (envVal && String(envVal).trim()) ? String(envVal).trim()
                    : null;
    const source = userVal ? 'user' : (envVal ? 'bundled' : 'missing');
    return {
      ...meta,
      source,
      hasValue: !!effective,
      maskedValue: effective ? maskKey(effective) : '',
    };
  });
}

function maskKey(s) {
  if (!s) return '';
  if (s.length <= 8) return '••••••••';
  return s.slice(0, 4) + '••••••••' + s.slice(-4);
}

/**
 * Validate a provider API key with a tiny authenticated probe. Returns
 *   { ok: true, message: 'Connected' }
 *   { ok: false, message: 'Invalid key' | '<HTTP status>' | '<error>' }
 *
 * Uses the cheapest auth-only endpoint per provider so we don't burn quota.
 */
async function testApiKey(name, value) {
  const key = (value && String(value).trim()) || getApiKey(name);
  if (!key) return { ok: false, message: 'No key set' };
  const fetch = global.fetch || require('node-fetch');
  try {
    switch (name) {
      case 'PYANNOTE_API_KEY': {
        const r = await fetch('https://api.pyannote.ai/v1/voiceprint', {
          method: 'GET',
          headers: { Authorization: `Bearer ${key}` },
        });
        if (r.status === 401 || r.status === 403) return { ok: false, message: 'Unauthorized — check key' };
        if (r.status >= 500) return { ok: false, message: `Server ${r.status}` };
        return { ok: true, message: 'Connected' };
      }
      case 'SPEECHMATICS_API_KEY': {
        const r = await fetch('https://asr.api.speechmatics.com/v2/jobs?limit=1', {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (r.status === 401 || r.status === 403) return { ok: false, message: 'Unauthorized — check key' };
        if (!r.ok) return { ok: false, message: `HTTP ${r.status}` };
        return { ok: true, message: 'Connected' };
      }
      case 'DEEPGRAM_API_KEY': {
        const r = await fetch('https://api.deepgram.com/v1/projects', {
          headers: { Authorization: `Token ${key}` },
        });
        if (r.status === 401 || r.status === 403) return { ok: false, message: 'Unauthorized — check key' };
        if (!r.ok) return { ok: false, message: `HTTP ${r.status}` };
        return { ok: true, message: 'Connected' };
      }
      case 'GEMINI_API_KEY': {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
        if (r.status === 401 || r.status === 403) return { ok: false, message: 'Unauthorized — check key' };
        if (!r.ok) return { ok: false, message: `HTTP ${r.status}` };
        return { ok: true, message: 'Connected' };
      }
      case 'OPENAI_API_KEY': {
        const r = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (r.status === 401 || r.status === 403) return { ok: false, message: 'Unauthorized — check key' };
        if (!r.ok) return { ok: false, message: `HTTP ${r.status}` };
        return { ok: true, message: 'Connected' };
      }
      case 'ANTHROPIC_API_KEY': {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
        });
        if (r.status === 401 || r.status === 403) return { ok: false, message: 'Unauthorized — check key' };
        if (r.status === 400) return { ok: true, message: 'Connected' }; // 400 from a real auth still means key is valid
        if (!r.ok) return { ok: false, message: `HTTP ${r.status}` };
        return { ok: true, message: 'Connected' };
      }
      case 'GROQ_API_KEY': {
        const r = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (r.status === 401 || r.status === 403) return { ok: false, message: 'Unauthorized — check key' };
        if (!r.ok) return { ok: false, message: `HTTP ${r.status}` };
        return { ok: true, message: 'Connected' };
      }
      default:
        return { ok: false, message: 'Unknown provider' };
    }
  } catch (e) {
    return { ok: false, message: e?.message || 'Network error' };
  }
}

module.exports = {
  getApiKey,
  setApiKey,
  clearApiKey,
  listApiKeys,
  testApiKey,
  KNOWN_KEYS,
};
