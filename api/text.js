// CORS proxy for public-domain text sources.
//
// Project Gutenberg serves no Access-Control-Allow-Origin header, so a browser
// cannot fetch book text directly. Gutendex (search/metadata) DOES send CORS,
// and cover images load fine as <img> — so this proxy exists only for the
// full-text payloads.
//
// Deliberately allowlisted: an open proxy would let anyone route traffic
// through this deployment.

const ALLOWED_HOSTS = new Set([
  'gutenberg.org',
  'www.gutenberg.org',
  'standardebooks.org',
  'www.standardebooks.org',
  // This app's own Vercel Blob store (the Lattimore Iliad's narration text).
  // Not a general "any blob store" allowance -- one specific, first-party
  // store this deployment controls, same trust level as the hosts above.
  'xowrit6wi1heskze.public.blob.vercel-storage.com',
]);

// Largest Gutenberg plain-text files run ~2-3MB; 12MB leaves room for EPUBs.
const MAX_BYTES = 12 * 1024 * 1024;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const raw = req.query && req.query.url;
  if (!raw) {
    res.status(400).json({ error: 'missing ?url=' });
    return;
  }

  let target;
  try {
    target = new URL(raw);
  } catch (e) {
    res.status(400).json({ error: 'malformed url' });
    return;
  }

  if (target.protocol !== 'https:') {
    res.status(400).json({ error: 'https only' });
    return;
  }

  if (!ALLOWED_HOSTS.has(target.hostname)) {
    res.status(403).json({ error: `host not allowed: ${target.hostname}` });
    return;
  }

  try {
    const upstream = await fetch(target.toString(), {
      redirect: 'follow',
      headers: { 'User-Agent': 'annotated-reader/1.0 (+public-domain reader)' },
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `upstream ${upstream.status}` });
      return;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      res.status(413).json({ error: 'file too large' });
      return;
    }

    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') || 'text/plain; charset=utf-8'
    );
    // Public-domain texts never change — cache hard so repeat opens are free.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(buf);
  } catch (err) {
    res.status(502).json({ error: 'fetch failed', detail: String(err && err.message) });
  }
};
