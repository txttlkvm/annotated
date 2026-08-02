// Open Library API Integration
// https://openlibrary.org - Free, legal API access to millions of books
// No registration required, public domain books have direct download links

export interface OpenLibraryBook {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_id?: number;
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
  private static API_BASE = 'https://openlibrary.org/api';
  private static COVERS_URL = 'https://covers.openlibrary.org/b';
  private static IA_DOWNLOAD_BASE = 'https://archive.org/download';

  /**
   * Search for a book by title and author
   */
  static async searchBook(title: string, author?: string): Promise<OpenLibraryBook[]> {
    try {
      const query = author ? `${title} ${author}` : title;
      const response = await fetch(
        `${this.API_BASE}/search.json?title=${encodeURIComponent(query)}&limit=10`
      );
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
}
