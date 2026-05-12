import type { CitationPassage } from '@/types/overlay'

export interface CitationResult {
  citations: string[]
  passages: Record<string, CitationPassage>
}

export async function fetchCitations(
  urls: string[],
  claim: string
): Promise<CitationResult> {
  if (!urls.length) return { citations: [], passages: {} }

  try {
    const res = await fetch('/api/citations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, claim }),
    })
    if (!res.ok) return { citations: [], passages: {} }
    return await res.json() as CitationResult
  } catch {
    return { citations: [], passages: {} }
  }
}
