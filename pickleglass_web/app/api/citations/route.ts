// edge runtime removed — deployed via Electron backend proxy, not Vercel edge
import type { CitationPassage } from '@/types/overlay'

const FETCH_TIMEOUT_MS = 6000
const CDX_TIMEOUT_MS = 8000
const TINYFISH_TIMEOUT_MS = 8000

// ── fetch with abort timeout ──────────────────────────────────────────────
async function fetchWithTimeout(url: string, ms: number, opts?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, {
      ...opts,
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

// ── Markdown / plain-text → best passage ─────────────────────────────────
function findPassage(text: string, claim: string, maxLen = 280): string {
  const keywords = claim.toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 4)

  const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) ?? []

  let best = { score: -1, text: '' }
  for (const s of sentences) {
    const trimmed = s.trim()
    if (trimmed.length < 40 || trimmed.length > 600) continue
    const lower = trimmed.toLowerCase()
    const score = keywords.filter(k => lower.includes(k)).length
    if (score > best.score) best = { score, text: trimmed }
  }

  const passage = best.text || text.slice(0, maxLen)
  return passage.length > maxLen ? passage.slice(0, maxLen) + '…' : passage
}

// ── Strip Markdown heading/link syntax for cleaner passage display ────────
function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~`]+/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    // Decode common HTML entities that TinyFish passes through
    .replace(/&nbsp;/gi, ' ').replace(/&#160;/g, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ── TinyFish fetch: POST → clean Markdown per URL ────────────────────────
interface TinyFishResult {
  url: string
  title?: string
  content?: string
  markdown?: string
  text?: string
  error?: string
}

async function fetchViaTinyFish(
  urls: string[],
  apiKey: string
): Promise<TinyFishResult[]> {
  const res = await fetchWithTimeout(
    'https://api.fetch.tinyfish.ai',
    TINYFISH_TIMEOUT_MS,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ urls }),
    }
  )
  if (!res.ok) throw new Error(`TinyFish ${res.status}`)
  const data = await res.json()
  // API may return array or object keyed by URL
  if (Array.isArray(data)) return data
  // object shape: { "https://...": { content, title } }
  return urls.map(u => ({ url: u, ...(data[u] ?? {}) }))
}

// ── HTML → plain text fallback ────────────────────────────────────────────
function extractText(html: string): string {
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
    .trim()
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return m ? m[1].replace(/\s+/g, ' ').trim() : ''
}

// ── Wayback CDX lookup ───────────────────────────────────────────────────
async function waybackSnapshot(url: string): Promise<{ snapshotUrl: string; ts: string } | null> {
  try {
    const cdx = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=1&filter=statuscode:200&fl=timestamp,original&collapse=urlkey`
    const res = await fetchWithTimeout(cdx, CDX_TIMEOUT_MS)
    if (!res.ok) return null
    const rows: string[][] = await res.json()
    if (!rows[1]) return null
    const [ts, original] = rows[1]
    return { snapshotUrl: `https://web.archive.org/web/${ts}/${original}`, ts }
  } catch {
    return null
  }
}

// ── Wayback fallback for one URL ──────────────────────────────────────────
async function resolveViaWayback(url: string, claim: string): Promise<CitationPassage | null> {
  let html: string | null = null
  let type: CitationPassage['type'] = 'direct'
  let archiveUrl: string | undefined
  let archiveDate: string | undefined

  try {
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS, {
      headers: { 'User-Agent': 'Annotated/1.0 fact-checker-bot' },
    })
    if (res.ok) html = await res.text()
  } catch { /* timeout */ }

  if (!html) {
    const snap = await waybackSnapshot(url)
    if (snap) {
      try {
        const res = await fetchWithTimeout(snap.snapshotUrl, FETCH_TIMEOUT_MS, {
          headers: { 'User-Agent': 'Annotated/1.0 fact-checker-bot' },
        })
        if (res.ok) {
          html = await res.text()
          type = 'wayback'
          archiveUrl = snap.snapshotUrl
          archiveDate = snap.ts.replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3')
        }
      } catch { /* snap also failed */ }
    }
  }

  if (!html) return null

  return {
    passage: findPassage(extractText(html), claim),
    title: extractTitle(html).slice(0, 120) || undefined,
    archiveUrl,
    archiveDate,
    type,
  }
}

// ── Reject generic/homepage URLs — must point to a specific article ─────────
function isSpecificUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/$/, '') // strip trailing slash
    // Must have a non-trivial path (not just '' or '/section')
    if (path.length < 12) return false
    const segments = path.split('/').filter(Boolean)
    // At least 2 path segments, or 1 segment that looks like an article slug (>8 chars with hyphens/numbers)
    if (segments.length >= 2) return true
    if (segments.length === 1 && segments[0].length > 10 && /[-_\d]/.test(segments[0])) return true
    return false
  } catch {
    return false
  }
}

// ── Route handler ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
  let body: { urls?: string[]; claim?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const { urls = [], claim = '' } = body
  if (!urls.length || !claim) {
    return Response.json({ error: 'urls[] and claim required' }, { status: 400 })
  }

  // Reject generic homepage URLs immediately — only specific article URLs allowed
  const targets = urls.slice(0, 5).filter(isSpecificUrl).slice(0, 3)
  if (!targets.length) {
    return Response.json({ citations: [], passages: {} })
  }

  const tinyfishKey = process.env.TINYFISH_API_KEY?.trim()

  const passages: Record<string, CitationPassage> = {}
  const citations: string[] = []

  // ── Fetch content via TinyFish + always get Wayback archive URL ──────────
  if (tinyfishKey) {
    try {
      // Kick off TinyFish fetch and Wayback archive lookups in parallel
      const [tfResults, waybackResults] = await Promise.all([
        fetchViaTinyFish(targets, tinyfishKey),
        Promise.all(targets.map(u => waybackSnapshot(u))),
      ])

      for (let i = 0; i < targets.length; i++) {
        const r = tfResults[i]
        const snap = waybackResults[i]
        if (!r || r.error || (!r.content && !r.markdown && !r.text)) continue
        const rawMd = r.content ?? r.markdown ?? r.text ?? ''
        const plain = stripMarkdown(rawMd)
        const archiveUrl = snap?.snapshotUrl
        const archiveDate = snap?.ts.replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3')
        passages[targets[i]] = {
          passage: findPassage(plain, claim),
          title: r.title?.slice(0, 120) || undefined,
          // Always expose archiveUrl so the link opens the archived version
          archiveUrl,
          archiveDate,
          type: archiveUrl ? 'wayback' : 'direct',
        }
        citations.push(targets[i])
      }
      if (citations.length) return Response.json({ citations, passages })
    } catch (err) {
      console.warn('[citations] TinyFish failed, falling back to Wayback:', err)
    }
  }

  // ── Wayback-only fallback ────────────────────────────────────────────────
  const settled = await Promise.allSettled(targets.map(u => resolveViaWayback(u, claim)))
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      passages[targets[i]] = r.value
      citations.push(targets[i])
    }
  })

  return Response.json({ citations, passages })
}
