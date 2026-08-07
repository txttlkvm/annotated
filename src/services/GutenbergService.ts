// Project Gutenberg integration via the Gutendex API.
//
// Network shape (verified against live endpoints):
//   - gutendex.com sends `access-control-allow-origin: *`  -> fetch directly
//   - www.gutenberg.org sends NO CORS headers              -> must go via /api/text
//   - cover JPEGs are loaded as <img src>, which needs no CORS at all

export interface GutenbergBook {
  id: number;
  title: string;
  authors: string[];
  downloadCount: number;
  textUrl: string | null;
  epubUrl: string | null;
  coverUrl: string | null;
}

/** A paragraph is the unit of text-to-audio sync. */
export interface Paragraph {
  /** Stable index across the whole book — used as the audio sync key. */
  index: number;
  text: string;
  /** Chapter this paragraph belongs to, by index into the chapter list. */
  chapter: number;
}

export interface Chapter {
  index: number;
  title: string;
  /** Index of the first paragraph belonging to this chapter. */
  startParagraph: number;
}

export interface ParsedBook {
  paragraphs: Paragraph[];
  chapters: Chapter[];
  wordCount: number;
}

const GUTENDEX = 'https://gutendex.com/books';

/**
 * Google Cloud TTS rejects input over 5000 chars per request. Real Gutenberg
 * texts do contain occasional monster paragraphs (the Iliad has one), so
 * oversized blocks are split on sentence boundaries before they ever reach
 * synthesis. Kept under the hard limit to leave room for SSML wrapping.
 */
const MAX_TTS_CHARS = 4500;

/** Split an oversized block on sentence boundaries, never mid-sentence. */
function splitOversized(text: string): string[] {
  if (text.length <= MAX_TTS_CHARS) return [text];

  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*/g) || [text];
  const out: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > MAX_TTS_CHARS && current.length > 0) {
      out.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) out.push(current.trim());

  // A single sentence longer than the limit still has to be broken somewhere.
  return out.flatMap((chunk) =>
    chunk.length <= MAX_TTS_CHARS
      ? [chunk]
      : (chunk.match(new RegExp(`.{1,${MAX_TTS_CHARS}}(\\s|$)`, 'g')) || [chunk]).map((s) => s.trim())
  );
}

/**
 * Route a gutenberg.org URL through our own serverless proxy.
 * In local Expo dev there is no /api route, so this is relative-only —
 * it resolves against whatever origin is serving the app.
 */
function viaProxy(url: string): string {
  return `/api/text?url=${encodeURIComponent(url)}`;
}

function pickFormat(formats: Record<string, string>, ...keys: string[]): string | null {
  for (const key of keys) {
    // Gutendex mime keys carry charset suffixes, so match on prefix.
    const found = Object.keys(formats).find((k) => k.startsWith(key));
    if (found && formats[found] && !formats[found].endsWith('.zip')) {
      return formats[found];
    }
  }
  return null;
}

function toBook(raw: any): GutenbergBook {
  const formats: Record<string, string> = raw.formats || {};
  return {
    id: raw.id,
    title: raw.title,
    authors: (raw.authors || []).map((a: any) => a.name),
    downloadCount: raw.download_count || 0,
    textUrl: pickFormat(formats, 'text/plain; charset=utf-8', 'text/plain'),
    epubUrl: pickFormat(formats, 'application/epub+zip'),
    coverUrl: pickFormat(formats, 'image/jpeg'),
  };
}

export class GutenbergService {
  /** Free-text search against Gutendex. Safe to call directly from the browser. */
  static async search(query: string): Promise<GutenbergBook[]> {
    const res = await fetch(`${GUTENDEX}?search=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`Gutendex search failed: ${res.status}`);
    const data = await res.json();
    return (data.results || []).map(toBook);
  }

  /**
   * Best single match for a catalog entry.
   *
   * Ranking is by download_count, which is a decent proxy for "the edition
   * people actually read" — for Homer it surfaces the standard Butler/Pope
   * translations rather than abridged children's retellings.
   */
  static async findBest(title: string, author?: string): Promise<GutenbergBook | null> {
    const query = author ? `${title} ${author}` : title;
    const results = await this.search(query);
    const usable = results.filter((b) => b.textUrl);
    if (!usable.length) return null;

    const wanted = title.toLowerCase();
    // Prefer a close title match; fall back to most-downloaded overall.
    const exact = usable.filter((b) => b.title.toLowerCase().includes(wanted));
    const pool = exact.length ? exact : usable;
    return pool.sort((a, b) => b.downloadCount - a.downloadCount)[0];
  }

  /** Fetch the full plain text, routed through the CORS proxy. */
  static async fetchText(book: GutenbergBook): Promise<string> {
    if (!book.textUrl) throw new Error(`No plain-text edition for "${book.title}"`);
    const res = await fetch(viaProxy(book.textUrl));
    if (!res.ok) throw new Error(`Text fetch failed: ${res.status}`);
    return res.text();
  }

  /**
   * Strip Project Gutenberg's license header and footer, plus two
   * transcription artifacts that leak into the reading experience: a
   * leading "Transcriber's Note" (meta-commentary about the transcription,
   * not the book) and underscore italics (`_word_`), Gutenberg's plain-text
   * convention for italic markup, which otherwise render as literal
   * underscores. The markers have shifted wording over the years, so match
   * loosely.
   */
  static stripBoilerplate(raw: string): string {
    let text = raw.replace(/\r\n/g, '\n');

    const start = text.match(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i);
    if (start && start.index !== undefined) {
      text = text.slice(start.index + start[0].length);
    }

    const end = text.match(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i);
    if (end && end.index !== undefined) {
      text = text.slice(0, end.index);
    }

    text = text.trim();

    // A Transcriber's Note (when present) always sits right after the
    // START marker, and always ends before a much bigger gap than its own
    // internal line spacing -- the real title page/body follows a run of
    // 3+ newlines, never seen *within* the note itself.
    text = text.replace(/^\s*Transcribers?'?s?\s+Notes?:?[\s\S]*?\n{3,}/i, '');

    // `_word_` or `_a short phrase_` -> plain text. Bounded to 120 chars and
    // excluding newlines so it can never span a paragraph break.
    text = text.replace(/_([^_\n]{1,120}?)_/g, '$1');

    return text.trim();
  }

  /**
   * Split cleaned text into paragraphs and chapters.
   *
   * Paragraphs are the sync unit: synthesize audio per paragraph and the
   * text/audio alignment is exact by construction — no forced alignment needed.
   */
  static parse(cleaned: string): ParsedBook {
    // Gutenberg wraps lines at ~72 chars; blank lines separate paragraphs.
    const blocks = cleaned
      .split(/\n\s*\n/)
      .map((b) => b.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((b) => b.length > 0);

    const chapterPattern =
      /^(chapter|book|canto|part|act|scene|letter|psalm)\s+([ivxlcdm\d]+)\b/i;

    const rawChapters: { title: string; startParagraph: number }[] = [];
    const paragraphTexts: string[] = [];
    let wordCount = 0;

    for (const block of blocks) {
      const isHeading = chapterPattern.test(block) && block.length < 120;

      if (isHeading) {
        rawChapters.push({ title: block, startParagraph: paragraphTexts.length });
        continue;
      }

      // One source block may yield several sync units if it is very long.
      for (const piece of splitOversized(block)) {
        paragraphTexts.push(piece);
      }
      wordCount += block.split(/\s+/).length;
    }

    // A front-matter table of contents produces a run of heading-pattern
    // blocks with nothing but blank lines between them ("BOOK I. / BOOK II.
    // / ..."), before the real chapters -- which always have body text --
    // start over from the beginning. A real chapter heading is never
    // immediately followed by another heading with zero paragraphs between
    // them except in that listing, so any heading sharing its
    // startParagraph with another one is TOC noise, not real structure.
    const startCounts = new Map<number, number>();
    for (const c of rawChapters) {
      startCounts.set(c.startParagraph, (startCounts.get(c.startParagraph) ?? 0) + 1);
    }
    const chapters: Chapter[] = rawChapters
      .filter((c) => startCounts.get(c.startParagraph) === 1)
      .map((c, index) => ({ index, title: c.title, startParagraph: c.startParagraph }));

    // Books with no detectable headings still need one container chapter.
    if (!chapters.length) {
      chapters.push({ index: 0, title: 'Full Text', startParagraph: 0 });
    }

    // Assign each paragraph to the chapter whose range contains it. Done as
    // its own pass (rather than during the block loop above) because
    // filtering TOC noise out of rawChapters shifts which chapter a given
    // paragraph actually falls under.
    const paragraphs: Paragraph[] = [];
    let chapterCursor = 0;
    for (let i = 0; i < paragraphTexts.length; i++) {
      while (
        chapterCursor + 1 < chapters.length &&
        chapters[chapterCursor + 1].startParagraph <= i
      ) {
        chapterCursor++;
      }
      paragraphs.push({ index: i, text: paragraphTexts[i], chapter: chapterCursor });
    }

    return { paragraphs, chapters, wordCount };
  }

  /** Convenience: find, fetch, clean, and parse in one call. */
  static async load(title: string, author?: string): Promise<{
    book: GutenbergBook;
    parsed: ParsedBook;
  } | null> {
    const book = await this.findBest(title, author);
    if (!book) return null;
    const raw = await this.fetchText(book);
    const parsed = this.parse(this.stripBoilerplate(raw));
    return { book, parsed };
  }
}
