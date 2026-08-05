// Long-press "Look up" — Wikipedia's own public REST API, no key needed.
// Wikipedia sends CORS headers on this endpoint, so it can be called directly
// from the browser without a proxy (unlike Gutenberg's plain-text downloads).

export interface WikipediaSummary {
  title: string;
  extract: string;
  url: string | null;
  thumbnailUrl: string | null;
}

/** Trims a paragraph-length selection down to something worth searching. */
function toQuery(text: string): string {
  const words = text.trim().split(/\s+/);
  return words.slice(0, 8).join(' ');
}

export class WikipediaService {
  /** Resolves the best-matching article title for arbitrary selected text. */
  static async search(text: string): Promise<string | null> {
    const query = toQuery(text);
    if (!query) return null;
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query
      )}&srlimit=1&format=json&origin=*`
    );
    if (!res.ok) throw new Error(`Wikipedia search failed: ${res.status}`);
    const data = await res.json();
    return data?.query?.search?.[0]?.title ?? null;
  }

  /** Short summary + thumbnail for a resolved article title. */
  static async summary(title: string): Promise<WikipediaSummary> {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!res.ok) throw new Error(`No Wikipedia entry for "${title}"`);
    const data = await res.json();
    return {
      title: data.title,
      extract: data.extract || 'No summary available.',
      url: data.content_urls?.desktop?.page ?? null,
      thumbnailUrl: data.thumbnail?.source ?? null,
    };
  }

  /** Search then summarize in one call — what the reader's "Look up" needs. */
  static async lookup(selectedText: string): Promise<WikipediaSummary | null> {
    const title = await this.search(selectedText);
    if (!title) return null;
    return this.summary(title);
  }
}
