// POST /api/gemini — Gemini with optional Google Search grounding
// Returns { text, groundedUrls } where groundedUrls is the AUTHORITATIVE list
// of URLs Google actually returned for this query. URLs typed in the model's
// text response are unreliable (it hallucinates); only groundedUrls are real.
const router = require('express').Router();

const PRIMARY_MODEL  = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-pro';

// Gemini's groundingChunks[].web.uri returns Vertex AI redirect URLs:
//   https://vertexaisearch.cloud.google.com/grounding-api-redirect/<token>
// They redirect (302) to the actual source domain. We need the *resolved* URL
// for source labeling and primary-host gating. HEAD with redirect:'follow'
// resolves them quickly. Best effort — fall back to the redirect URL.
async function resolveRedirect(url, ms = 2500) {
  if (!url || !url.includes('vertexaisearch.cloud.google.com')) return url;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    let res;
    try {
      res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
    } catch {
      // Some endpoints reject HEAD — retry with GET, but cancel body to free socket.
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
      try { await res.body?.cancel?.(); } catch {}
    }
    return (res && res.url) ? res.url : url;
  } catch {
    return url;
  } finally {
    clearTimeout(timer);
  }
}

async function geminiRest(apiKey, modelName, prompt, maxTokens, useSearch) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: maxTokens,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (useSearch) body.tools = [{ googleSearch: {} }];
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();

  const candidate = data.candidates?.[0] ?? {};
  const parts = candidate.content?.parts ?? [];
  const text = parts.map(p => p.text ?? '').join('').trim();

  // Extract REAL URLs from groundingMetadata.groundingChunks[].web.uri.
  // These are the URLs Google Search actually returned — what the model
  // *typed* in its text is hallucination-prone and must NOT be trusted.
  const chunks = candidate.groundingMetadata?.groundingChunks ?? [];
  const rawGroundedUrls = chunks
    .map(c => c?.web?.uri)
    .filter(u => typeof u === 'string' && /^https?:\/\//i.test(u));

  // Resolve Vertex redirect URLs in parallel so downstream code sees real
  // hostnames (apnews.com, thedailybeast.com, etc.) instead of the opaque
  // redirect host. De-dupe afterward in case multiple chunks redirect to
  // the same destination.
  const resolved = await Promise.all(rawGroundedUrls.map(u => resolveRedirect(u)));
  const seen = new Set();
  const groundedUrls = [];
  for (const u of resolved) {
    if (!u) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    groundedUrls.push(u);
  }

  return { text: text || '~', groundedUrls };
}

router.post('/', async (req, res) => {
  const { prompt, maxTokens = 300, useSearch = false } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set', text: '~', groundedUrls: [] });

  async function tryModel(modelName) {
    try {
      return await geminiRest(apiKey, modelName, prompt, maxTokens, useSearch);
    } catch (err) {
      console.warn(`[annotated-gemini] ${modelName} failed: ${String(err).slice(0, 200)}`);
      return null;
    }
  }

  try {
    const result = await tryModel(PRIMARY_MODEL) ?? await tryModel(FALLBACK_MODEL);
    if (!result) return res.status(500).json({ error: 'all Gemini models failed', text: '~', groundedUrls: [] });
    return res.json(result);
  } catch (err) {
    console.error('[annotated-gemini] unexpected:', err);
    return res.status(500).json({ error: String(err), text: '~', groundedUrls: [] });
  }
});

module.exports = router;
