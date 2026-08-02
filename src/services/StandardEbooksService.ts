// Standard Ebooks Integration
// https://standardebooks.org - High-quality public domain ebooks
// Every book is carefully formatted, proofread, and optimized for reading
// All books are free to download in multiple formats

export interface StandardEbook {
  title: string;
  author: string;
  url: string;
  coverUrl: string;
  description: string;
  downloadUrl: string;
}

export class StandardEbooksService {
  private static API_BASE = 'https://standardebooks.org/api';

  /**
   * Search Standard Ebooks catalog
   * These are all high-quality public domain texts
   */
  static async searchBook(query: string): Promise<StandardEbook[]> {
    try {
      const response = await fetch(
        `${this.API_BASE}/v1/ebooks/?query=${encodeURIComponent(query)}`
      );
      const data = await response.json();

      return data.ebooks.map((ebook: any) => ({
        title: ebook.title,
        author: ebook.author,
        url: `https://standardebooks.org/ebooks/${ebook.identifier}`,
        coverUrl: `https://standardebooks.org/images/covers/${ebook.identifier}.jpg`,
        description: ebook.description || '',
        downloadUrl: `https://standardebooks.org/ebooks/${ebook.identifier}/downloads/${ebook.identifier}.epub`,
      }));
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  /**
   * Get all available formats for a book
   */
  static async getDownloadFormats(identifier: string): Promise<{
    epub: string;
    epub3: string;
    kepub: string;
    azw3: string;
    pdf: string;
  }> {
    const base = `https://standardebooks.org/ebooks/${identifier}/downloads`;
    return {
      epub: `${base}/${identifier}.epub`,
      epub3: `${base}/${identifier}.epub3`,
      kepub: `${base}/${identifier}.kepub.epub`,
      azw3: `${base}/${identifier}.azw3`,
      pdf: `${base}/${identifier}.pdf`,
    };
  }

  /**
   * Known classical texts on Standard Ebooks
   * Pre-mapped for quick access
   */
  static getKnownClassical(): Record<string, string> {
    return {
      'Iliad': 'homer--iliad--samuel-butler',
      'Odyssey': 'homer--odyssey--samuel-butler',
      'Divine Comedy': 'dante-alighieri--the-divine-comedy--henry-wadsworth-longfellow',
      'Republic': 'plato--republic--benjamin-jowett',
      'Metaphysics': 'aristotle--metaphysics--john-henry-mcmahon',
      'Ethics': 'aristotle--nicomachean-ethics--wentworth-thompson',
      'Politics': 'aristotle--politics--benjamin-jowett',
      'Hamlet': 'william-shakespeare--hamlet',
      'King Lear': 'william-shakespeare--king-lear',
      'Macbeth': 'william-shakespeare--macbeth',
      'Othello': 'william-shakespeare--othello',
      'Midsummer Night\'s Dream': 'william-shakespeare--a-midsummer-nights-dream',
      'Beowulf': 'unknown--beowulf--seamus-heaney',
      'Confessions': 'augustine--confessions--william-watts',
      'City of God': 'augustine--the-city-of-god--marcus-dods',
      'Meditations': 'marcus-aurelius--meditations--george-long',
      'Leviathan': 'thomas-hobbes--leviathan',
      'The Prince': 'niccolo-machiavelli--the-prince--william-k-marriott',
      'Decline and Fall of the Roman Empire': 'edward-gibbon--the-decline-and-fall-of-the-roman-empire',
      'Democracy in America': 'alexis-de-tocqueville--democracy-in-america--henry-reeve',
      'Pilgrim\'s Progress': 'john-bunyan--the-pilgrims-progress',
      'The Man Who Was Thursday': 'g-k-chesterton--the-man-who-was-thursday',
    };
  }

  /**
   * Direct download URL for known classical text
   */
  static getDirectDownload(title: string, format: 'epub' | 'pdf' | 'azw3' = 'epub'): string | null {
    const known = this.getKnownClassical();
    const identifier = known[title];

    if (!identifier) return null;

    const base = `https://standardebooks.org/ebooks/${identifier}/downloads`;
    const ext = format === 'azw3' ? 'azw3' : format;
    return `${base}/${identifier}.${ext}`;
  }
}
