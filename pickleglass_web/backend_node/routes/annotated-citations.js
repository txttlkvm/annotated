// POST /api/citations — fetch URLs, score passages, Wayback fallback
const router = require('express').Router();

const FETCH_TIMEOUT_MS = 6000;
const CDX_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Annotated/1.0 fact-checker-bot' },
    });
  } finally {
    clearTimeout(timer);
  }
}

function extractText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function findPassage(text, claim, maxLen = 280) {
  const claimLower = claim.toLowerCase();
  // 1) Quoted phrases get top priority — they're the exact words the LLM cared about.
  const quoted = [...claimLower.matchAll(/['"“”‘’]([^'"“”‘’]{3,80})['"“”‘’]/g)].map(m => m[1].trim());
  // 2) 2-3 word phrases (capitalized in the original = likely a name/term).
  //    Extract from the original-cased claim, then lowercase for matching.
  const phraseRE = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g;
  const phrases = (claim.match(phraseRE) ?? []).map(p => p.toLowerCase());
  // 3) Significant single keywords (skip stopwords + short fillers).
  const STOP = new Set([
    'about','after','again','against','because','before','below','between','during','further',
    'should','through','under','their','there','these','those','where','which','while','would',
    'could','since','until','being','having','still','some','such','than','that','then','they',
    'them','this','very','what','when','were','will','with','your','statement','during','said',
    'also','more','most','many','much','said','says','told','made','make','using','used','only',
  ]);
  const keywords = claimLower.split(/\W+/).filter(w => w.length > 4 && !STOP.has(w));

  // Phrases combined: quoted (highest weight) + capitalized phrases
  const exactPhrases = [...quoted, ...phrases].map(p => p.toLowerCase());

  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
  let best = { score: -1, text: '', hasExact: false };

  for (const s of sentences) {
    if (s.length < 40 || s.length > 600) continue;
    const lower = s.toLowerCase();
    let score = 0;
    let hasExact = false;
    // Exact phrase match — heavy boost (each quoted phrase = +20, capitalized = +10)
    for (const q of quoted) if (lower.includes(q)) { score += 20; hasExact = true; }
    for (const p of phrases) if (lower.includes(p)) { score += 10; hasExact = true; }
    // Single-keyword overlap
    for (const k of keywords) if (lower.includes(k)) score += 1;
    // Prefer sentences with at least one exact phrase match
    if (score > best.score || (hasExact && !best.hasExact)) {
      best = { score, text: s.trim(), hasExact };
    }
  }

  // If we couldn't find any sentence that mentions an exact phrase but the
  // claim has one, try a wider window (raw text slice) around the first phrase
  // occurrence so the user at least sees the phrase in context.
  if (!best.hasExact && exactPhrases.length > 0) {
    const lowerText = text.toLowerCase();
    for (const p of exactPhrases) {
      const idx = lowerText.indexOf(p);
      if (idx >= 0) {
        const start = Math.max(0, idx - 100);
        const end = Math.min(text.length, idx + p.length + 180);
        const slice = text.slice(start, end).trim();
        if (slice.length >= 40) {
          best = { score: 100, text: (start > 0 ? '…' : '') + slice + (end < text.length ? '…' : ''), hasExact: true };
          break;
        }
      }
    }
  }

  const passage = best.text || text.slice(0, maxLen);
  return passage.length > maxLen ? passage.slice(0, maxLen) + '…' : passage;
}

async function waybackSnapshot(url) {
  try {
    const cdx = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=1&filter=statuscode:200&fl=timestamp,original&collapse=urlkey`;
    const res = await fetchWithTimeout(cdx, CDX_TIMEOUT_MS);
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows[1]) return null;
    const [ts, original] = rows[1];
    return { snapshotUrl: `https://web.archive.org/web/${ts}/${original}`, ts };
  } catch {
    return null;
  }
}

async function resolveOne(url, claim) {
  let html = null;
  let type = 'direct';
  let archiveUrl, archiveDate;

  try {
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (res.ok) html = await res.text();
  } catch {}

  if (!html) {
    const snap = await waybackSnapshot(url);
    if (snap) {
      try {
        const res = await fetchWithTimeout(snap.snapshotUrl, FETCH_TIMEOUT_MS);
        if (res.ok) {
          html = await res.text();
          type = 'wayback';
          archiveUrl = snap.snapshotUrl;
          archiveDate = snap.ts.replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3');
        }
      } catch {}
    }
  }

  if (!html) return null;

  return {
    passage: findPassage(extractText(html), claim),
    title: extractTitle(html).slice(0, 120) || undefined,
    archiveUrl,
    archiveDate,
    type,
  };
}

router.post('/', async (req, res) => {
  const { urls = [], claim = '' } = req.body;
  if (!urls.length || !claim) {
    return res.status(400).json({ error: 'urls[] and claim required' });
  }

  const targets = urls.slice(0, 3);
  const settled = await Promise.allSettled(targets.map(u => resolveOne(u, claim)));

  const passages = {};
  const citations = [];

  settled.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      passages[targets[i]] = r.value;
      citations.push(targets[i]);
    }
  });

  return res.json({ citations, passages });
});

module.exports = router;
