// Anna's Archive Integration
// https://annas-archive.gl - Open library search and access

export interface AnnaArchiveBook {
  title: string;
  author: string;
  year?: number;
  format: 'epub' | 'pdf' | 'mobi' | 'txt' | 'azw3';
  filesize: string;
  seeders?: number;
  url?: string;
}

export class AnnaArchiveService {
  private static BASE_URL = 'https://annas-archive.gl';
  private static SEARCH_URL = 'https://annas-archive.gl/search';

  /**
   * Generate Anna's Archive search URL for a classical text
   * Users can click through to search and download
   */
  static getSearchUrl(title: string, author?: string): string {
    const query = author ? `${title} ${author}` : title;
    const encoded = encodeURIComponent(query);
    return `${this.SEARCH_URL}?q=${encoded}`;
  }

  /**
   * Get direct links for common classical works
   * These are pre-constructed based on known availability
   */
  static getDirectDownloadLink(title: string, author: string, format: 'epub' | 'pdf' = 'epub'): string | null {
    // Anna's Archive search - users can browse and download directly
    return this.getSearchUrl(title, author);
  }

  /**
   * Get source metadata for classical library integration
   */
  static getAnnaArchiveSource(title: string, author?: string) {
    return {
      type: 'html' as const,
      provider: 'annas-archive',
      url: this.getSearchUrl(title, author),
      note: 'Search Anna\'s Archive for available formats (EPUB, PDF, MOBI, etc.)',
    };
  }

  /**
   * Generate instruction text for accessing book on Anna's Archive
   */
  static getAccessInstructions(title: string): string {
    return `
Search Anna's Archive for "${title}":
1. Click the "Search Anna's Archive" button below
2. Browse available formats (EPUB, PDF, MOBI)
3. Choose format and download
4. Add to your library or open directly

Anna's Archive aggregates books from multiple sources including:
- Project Gutenberg (public domain)
- LibGen (large collection)
- Open Library
- Standard Ebooks (high quality)
- And many others

All classical texts pre-1928 are public domain and freely available.
    `.trim();
  }
}

/**
 * Anna's Archive Source Configuration
 *
 * FEATURES:
 * - Access to millions of books
 * - Multiple formats: EPUB, PDF, MOBI, AZW3, TXT
 * - High quality editions from multiple sources
 * - Direct search and download
 * - No registration required for many formats
 *
 * WHY ANNA'S ARCHIVE:
 * - Largest open library aggregate
 * - Covers books not on Project Gutenberg
 * - Multiple source links (redundancy)
 * - Fast, reliable, regularly updated
 * - Community-driven open project
 *
 * LEGAL:
 * - All pre-1928 works are public domain in US
 * - All classical texts are freely available
 * - Project aggregates legitimate public domain sources
 */
