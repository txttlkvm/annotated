// Real-narration Read Aloud for one specific book: the Lattimore Iliad,
// narrated by a professional voice actor and pre-aligned (phrase-level,
// forced alignment against the actual translation text) rather than
// synthesized live by Kokoro. Everything here is scoped to that one edition
// -- there's no generic "narrated book" system, because there's only one
// narrated book. Kokoro remains the Read Aloud engine for every other title.
import cuesByBook from '../assets/iliad/cues.json';

/** The exact sourceUrl the Lattimore catalog entry resolves to (see
 * gutenbergIds.ts's 'lit-homer-iliad-lattimore' entry) -- how ReaderScreen
 * tells "this is that edition" apart from the free Gutenberg Iliad, which
 * has its own, different sourceUrl and is a completely different
 * (public-domain prose) translation of the poem. */
export const LATTIMORE_TEXT_URL =
  'https://xowrit6wi1heskze.public.blob.vercel-storage.com/iliad/text/full.txt';

/** One phrase of the aligned narration. */
export interface NarrationCue {
  /** Start, seconds from the start of this BOOK's audio file. */
  s: number;
  /** End, seconds. */
  e: number;
  /** The phrase itself, as actually narrated. */
  t: string;
  /** Paragraph index (0-based) within this book's chapter text that this
   * phrase falls in -- the sync key back to what's on screen. */
  p: number;
}

// All 24 books' audio uploaded (scripts/upload_iliad_blob.py) at a
// predictable pathname (no random suffix -- the raw PUT REST API, unlike
// the `vercel blob` CLI, actually honors that), so the URL is just this
// pattern rather than a hardcoded per-book table.
const AUDIO_BASE = 'https://xowrit6wi1heskze.public.blob.vercel-storage.com/iliad/audio';
const TOTAL_BOOKS = 24;

export const LattimoreNarrationService = {
  /** Is this THE Lattimore Iliad, not any other book (including the free
   * Gutenberg Iliad already in the catalog)? */
  isLattimoreIliad(book: { sourceUrl?: string }): boolean {
    return book.sourceUrl === LATTIMORE_TEXT_URL;
  },

  hasAudio(bookNum: number): boolean {
    return bookNum >= 1 && bookNum <= TOTAL_BOOKS;
  },

  getAudioUrl(bookNum: number): string | undefined {
    if (!this.hasAudio(bookNum)) return undefined;
    return `${AUDIO_BASE}/book${String(bookNum).padStart(2, '0')}.m4a`;
  },

  getCues(bookNum: number): NarrationCue[] {
    return (cuesByBook as Record<string, NarrationCue[]>)[String(bookNum)] ?? [];
  },

  /** The cue whose range contains `position` (seconds), or the nearest
   * upcoming one if playback is between cues (natural narration pauses). */
  findActiveCue(cues: NarrationCue[], position: number): NarrationCue | null {
    for (const cue of cues) {
      if (position >= cue.s && position < cue.e) return cue;
    }
    // Between cues: the next one that hasn't started yet reads as "about
    // to be spoken", closer to what the ear expects than staying on the
    // one that just finished.
    return cues.find((c) => c.s >= position) ?? cues[cues.length - 1] ?? null;
  },
};
