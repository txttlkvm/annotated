// Open Library API Integration
// https://openlibrary.org - Free, legal API access to millions of books
// No registration required, public domain books have direct download links

export interface OpenLibraryBook {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  // The search API's real field is cover_i, not cover_id -- a previous
  // version of this interface had the wrong name, so getCoverUrl below was
  // never reachable from a live search result.
  cover_i?: number;
  has_fulltext?: boolean;
  ia?: string[]; // Internet Archive IDs - these have actual files
}

export interface OpenLibraryEdition {
  key: string;
  title: string;
  isbn_10?: string[];
  isbn_13?: string[];
  covers?: number[];
  ia?: string[]; // Internet Archive identifier - use this to get files
  ocaids?: string[];
}

export class OpenLibraryService {
  // NOT https://openlibrary.org/api -- that path 404s (confirmed live: an
  // empty 404 body was silently swallowed as "Search error: Unexpected end
  // of JSON input" and every search from here on returned zero results, so
  // every cover/edition lookup that needed this fallback always failed).
  // Open Library's real search endpoint has no /api/ prefix at all.
  private static API_BASE = 'https://openlibrary.org';
  private static COVERS_URL = 'https://covers.openlibrary.org/b';
  private static IA_DOWNLOAD_BASE = 'https://archive.org/download';

  /**
   * Search for a book by title and author
   */
  static async searchBook(title: string, author?: string): Promise<OpenLibraryBook[]> {
    try {
      // Separate title/author params rank far better than jamming both into
      // the title field — a combined query buried real matches (with covers)
      // under unrelated results with no cover at all, confirmed live for
      // several titles before this fix.
      const params = new URLSearchParams({ title, limit: '20' });
      if (author) params.set('author', author);
      const response = await fetch(`${this.API_BASE}/search.json?${params.toString()}`);
      if (!response.ok) {
        // Surfaces the real cause (404, 429 rate-limit, etc.) instead of
        // whatever cryptic message response.json() throws on a non-JSON
        // error body -- exactly how the /api/ URL bug above went unnoticed
        // ("Unexpected end of JSON input" doesn't say "wrong URL").
        console.error(`[OpenLibrary] search failed: HTTP ${response.status}`);
        return [];
      }
      const data = await response.json();
      return data.docs || [];
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  /**
   * Get available editions of a book
   * Returns formats: EPUB, PDF, etc.
   */
  static async getEditions(title: string, author?: string): Promise<string[]> {
    try {
      const books = await this.searchBook(title, author);
      if (books.length === 0) return [];

      const book = books[0];
      const workKey = book.key;

      // Get editions for this work
      const response = await fetch(
        `https://openlibrary.org${workKey}/editions.json`
      );
      const data = await response.json();

      const downloadLinks: string[] = [];

      // Extract Internet Archive IDs (these have actual downloadable files)
      if (data.entries) {
        for (const edition of data.entries) {
          if (edition.ia) {
            // Internet Archive has EPUB, PDF, and other formats
            for (const iaId of Array.isArray(edition.ia) ? edition.ia : [edition.ia]) {
              downloadLinks.push(
                `https://archive.org/download/${iaId}/${iaId}_epub.epub`,
                `https://archive.org/download/${iaId}/${iaId}_pdf.pdf`
              );
            }
          }
        }
      }

      return downloadLinks;
    } catch (error) {
      console.error('Editions error:', error);
      return [];
    }
  }

  /**
   * Get direct download link from Internet Archive
   * Open Library links to Internet Archive for actual files
   */
  static async getDirectDownloadLinks(
    title: string,
    author?: string
  ): Promise<{ epub?: string; pdf?: string; txt?: string }> {
    try {
      const books = await this.searchBook(title, author);
      if (books.length === 0) return {};

      const book = books[0];

      // Get work editions
      const workKey = book.key;
      const response = await fetch(
        `https://openlibrary.org${workKey}/editions.json`
      );
      const data = await response.json();

      const formats: { epub?: string; pdf?: string; txt?: string } = {};

      if (data.entries && data.entries.length > 0) {
        const edition = data.entries[0];

        // Use Internet Archive identifier if available
        if (edition.ia) {
          const iaId = Array.isArray(edition.ia) ? edition.ia[0] : edition.ia;
          formats.epub = `https://archive.org/download/${iaId}/${iaId}_epub.epub`;
          formats.pdf = `https://archive.org/download/${iaId}/${iaId}_pdf.pdf`;
          formats.txt = `https://archive.org/download/${iaId}/${iaId}_txt.txt`;
        }
      }

      return formats;
    } catch (error) {
      console.error('Download links error:', error);
      return {};
    }
  }

  /**
   * Get book cover
   */
  static getCoverUrl(coverId: number, size: 'S' | 'M' | 'L' = 'M'): string {
    return `${this.COVERS_URL}/id/${coverId}-${size}.jpg`;
  }

  /**
   * Resolves a real cover image for a title/author with no Gutenberg match.
   * Open Library indexes cover art for editions Gutenberg never digitized
   * (e.g. modern reprints of Plutarch, Aquinas, Tolkien), so this catches
   * a large share of what the static Gutenberg map misses.
   */
  static async getCoverByTitle(title: string, author?: string): Promise<string | null> {
    try {
      const books = await this.searchBook(title, author);
      // Same discipline as gutenbergIds.ts: require the author's surname to
      // actually appear before trusting a cover, so a mismatched edition
      // (a study guide, an unrelated book that shares a title) never gets
      // shown as this book's cover. No match -> the typographic fallback,
      // not a guess.
      const surname = author?.trim().split(/\s+/).pop()?.toLowerCase();
      const match = books.find((b) => {
        if (!b.cover_i) return false;
        if (!surname) return true;
        return b.author_name?.some((a) => a.toLowerCase().includes(surname));
      });
      return match?.cover_i ? this.getCoverUrl(match.cover_i, 'L') : null;
    } catch (error) {
      console.error('Cover lookup error:', error);
      return null;
    }
  }
}
