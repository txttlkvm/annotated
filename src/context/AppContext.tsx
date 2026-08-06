import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { DatabaseService } from '../services/DatabaseService';
import { Book, Bookmark, Highlight, ReadingSession, ReaderSettings, DEFAULT_READER_SETTINGS, Collection, WordLookup, BookProgress } from '../types';
import { classicalLibrary, getClassicalLibraryWithSources, ClassicalLibraryItem, classicalLibraryByCategory, tier1Texts, tier2Texts, grammarStageMaterial, logicStageMaterial, rhetoricStageMaterial } from '../data/classicalLibrary';
import { gutenbergIds, GutenbergRef, coverFor } from '../data/gutenbergIds';
import { GutenbergService, GutenbergBook, ParsedBook } from '../services/GutenbergService';
import { EbookService } from '../services/EbookService';
import { OpenLibraryService } from '../services/OpenLibraryService';

/* ------------------------------------------------------------------ *
 * BOOK TEXT
 *
 * A Book row carries metadata only. The actual text of a volume (the
 * Iliad is ~1.1MB) is fetched from `sourceUrl` on demand, held in
 * memory for the life of the session, and NEVER written to the store —
 * localStorage caps at ~5MB per origin, so persisting two or three
 * books would blow the quota and silently kill persistence for
 * bookmarks and highlights too.
 *
 * The cache is keyed by URL rather than by book id on purpose: several
 * catalogue entries resolve to the same Gutenberg edition (every
 * scripture entry points at ebook 10), so keying by URL means the Bible
 * is downloaded once no matter which entry opened it.
 * ------------------------------------------------------------------ */

/** sourceUrl -> boilerplate-stripped text. Module scope: survives remounts. */
const textCache = new Map<string, string>();

/** sourceUrl -> in-flight request, so a second open never fires a second fetch. */
const inFlight = new Map<string, Promise<string>>();

export type TextLoadStatus =
  /** Nothing has been asked for yet. */
  | 'idle'
  /** Downloading the full text. */
  | 'loading'
  /** Text is attached to the book and the reader can render it. */
  | 'ready'
  /** The download failed; `error` carries something a reader can act on. */
  | 'error'
  /** Nothing to download — a user import, an artwork, or an unmatched entry. */
  | 'unavailable';

export interface TextLoadState {
  /** The book this status describes. Screens must check it before rendering. */
  bookId: string | null;
  status: TextLoadStatus;
  error: string | null;
}

const IDLE_TEXT_LOAD: TextLoadState = { bookId: null, status: 'idle', error: null };

/**
 * Characters per page. MUST stay in step with PAGE_BUDGET in ReaderScreen —
 * the reader paginates independently, and a Book.totalPages derived from a
 * different budget would make the library disagree with the page indicator.
 */
const PAGE_BUDGET = { paginated: 1500, scroll: 3200 };

/**
 * Count pages the way ReaderScreen lays them out: whole paragraphs only,
 * a fresh page at every chapter break, and a character budget per page.
 * Mirrors the `pages` memo in ReaderScreen.tsx.
 */
function countPages(parsed: ParsedBook, budget: number): number {
  if (!parsed.paragraphs.length) return 0;

  let pages = 0;
  let inBucket = 0;
  let chars = 0;
  let chapter = parsed.paragraphs[0].chapter;

  const flush = () => {
    if (!inBucket) return;
    pages += 1;
    inBucket = 0;
    chars = 0;
  };

  for (const paragraph of parsed.paragraphs) {
    if (paragraph.chapter !== chapter) {
      flush();
      chapter = paragraph.chapter;
    } else if (chars > 0 && chars + paragraph.text.length > budget) {
      flush();
    }
    inBucket += 1;
    chars += paragraph.text.length + 1;
  }
  flush();

  return pages;
}

/** In local Expo dev there is no /api route, so the proxy returns the app shell. */
function looksLikeHtml(text: string): boolean {
  return /^\s*(<!doctype html|<html\b)/i.test(text.slice(0, 200));
}

/** Turn a fetch failure into a sentence a reader can act on. */
function describeTextError(error: unknown, title: string): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw === 'PROXY_UNAVAILABLE') {
    return 'The text service is not running on this build, so the full edition cannot be downloaded here.';
  }
  if (raw === 'EMPTY_TEXT') {
    return `The archive returned an empty file for “${title}”. The edition may have been withdrawn.`;
  }
  if (/\b404\b/.test(raw)) {
    return `Project Gutenberg no longer serves this edition of “${title}”.`;
  }
  if (/\b403\b/.test(raw)) {
    return 'That source is not on the list of archives this app is allowed to fetch from.';
  }
  if (/\b413\b/.test(raw)) {
    return `“${title}” is too large to download in the browser.`;
  }
  if (/\b(429|5\d\d)\b/.test(raw)) {
    return 'Project Gutenberg is not responding just now. Please try again in a moment.';
  }
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(raw)) {
    return 'No connection to the archive. Check your network and try again.';
  }
  return `Could not download “${title}”. ${raw}`;
}

/**
 * Fetch, clean, and cache one edition. Concurrent callers for the same URL
 * share a single request; a completed download is never fetched twice.
 */
async function fetchBookText(sourceUrl: string, title: string): Promise<string> {
  const cached = textCache.get(sourceUrl);
  if (cached) return cached;

  const pending = inFlight.get(sourceUrl);
  if (pending) return pending;

  const request = (async () => {
    // GutenbergService.fetchText routes through /api/text — gutenberg.org
    // sends no CORS headers, so the browser cannot fetch it directly.
    const stub: GutenbergBook = {
      id: 0,
      title,
      authors: [],
      downloadCount: 0,
      textUrl: sourceUrl,
      epubUrl: null,
      coverUrl: null,
    };
    const raw = await GutenbergService.fetchText(stub);
    if (looksLikeHtml(raw)) throw new Error('PROXY_UNAVAILABLE');

    const cleaned = GutenbergService.stripBoilerplate(raw);
    if (!cleaned.trim()) throw new Error('EMPTY_TEXT');

    textCache.set(sourceUrl, cleaned);
    return cleaned;
  })();

  inFlight.set(sourceUrl, request);
  try {
    return await request;
  } finally {
    inFlight.delete(sourceUrl);
  }
}

/* ------------------------------------------------------------------ *
 * CATALOGUE BACKFILL
 *
 * Books added before `sourceUrl` was recorded are stranded — nothing on
 * the row says where the text lives, and the catalogue id is not stored.
 * Title+author is a safe re-key: those fields are copied verbatim from
 * the catalogue entry when the book is added.
 * ------------------------------------------------------------------ */

function catalogKey(title: string, author?: string): string {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `${normalize(title || '')}|${normalize(author || '')}`;
}

const CATALOG_REFS: Map<string, GutenbergRef> = (() => {
  const index = new Map<string, GutenbergRef>();
  for (const item of classicalLibrary) {
    const ref = gutenbergIds[item.id];
    if (!ref?.textUrl) continue;
    index.set(catalogKey(item.title, item.author), ref);
  }
  return index;
})();

// Indexed by catalogKey so loadBooks's migration below can look up the
// original catalogue item (and its resolved sources) for a stored Book row
// that only has title/author, not the catalogue id.
const CATALOG_ITEMS: Map<string, ClassicalLibraryItem> = (() => {
  const index = new Map<string, ClassicalLibraryItem>();
  for (const item of getClassicalLibraryWithSources()) {
    index.set(catalogKey(item.title, item.author), item);
  }
  return index;
})();

/**
 * Cover fallback chain: a confident Gutenberg match first, then the piece's
 * own art/image source for art-type items (the artwork itself makes a far
 * better cover than a generic placeholder), then a verified Wikimedia
 * composer portrait (or period artifact) for music-type items, which have
 * no Gutenberg entry and nothing an Open Library book search could ever
 * match, then a live Open Library lookup, which catches everything
 * Gutenberg never digitized (modern Tolkien/Lewis reprints, Aquinas,
 * Plutarch, etc). BookCover only draws its typographic fallback once all
 * four miss. Shared by addClassicalLibraryItem (new items) and loadBooks's
 * migration (items already in the library before this chain existed, or
 * before a given step in it did).
 */
async function resolveCatalogCover(item: ClassicalLibraryItem): Promise<string | undefined> {
  // coverFor() covers every synchronous step in one call (Gutenberg, the
  // art piece's own image, a music item's composer portrait, and the
  // curated Open Library cover_i matches) -- same logic the Catalog browse
  // cards use, so the library and the browse view never disagree about
  // what an item's cover is. A live Open Library search is the last resort,
  // for anything none of those hand-verified sources cover.
  let cover = coverFor(item.id);
  if (!cover && item.type === 'art') {
    // coverFor's art step only knows wikimediaArtwork by title; this item's
    // OWN resolved sources (item.sources, from getClassicalLibraryWithSources)
    // is the more authoritative copy of the same thing, so try it too.
    cover = item.sources?.find((s) => s.type === 'image')?.url;
  }
  if (!cover) {
    cover = (await OpenLibraryService.getCoverByTitle(item.title, item.author)) || undefined;
  }
  return cover;
}

interface AppContextType {
  books: Book[];
  currentBook: Book | null;
  bookmarks: Bookmark[];
  highlights: Highlight[];
  settings: ReaderSettings;
  isLoading: boolean;
  collections: Collection[];
  wordLookups: WordLookup[];
  bookProgress: Map<string, BookProgress>;

  // Book operations
  addBook: (book: Omit<Book, 'id'>) => Promise<string>;
  updateBook: (id: string, updates: Partial<Book>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  setCurrentBook: (book: Book | null) => void;

  // Book text (downloaded on demand, held in memory only)
  textLoad: TextLoadState;
  isTextLoading: boolean;
  /** Put a book on the desk and make sure its text is there. */
  openBook: (book: Book) => Promise<Book>;
  /** Download the text if it is missing. Resolves with the book as it now stands. */
  ensureBookText: (book: Book) => Promise<Book>;
  /** Re-attempt the download for the book currently on the desk. */
  retryTextLoad: () => Promise<void>;
  clearTextError: () => void;

  // Bookmark operations
  addBookmark: (bookmark: Omit<Bookmark, 'id'>) => Promise<string>;
  removeBookmark: (id: string) => Promise<void>;
  loadBookmarks: (bookId: string) => Promise<void>;

  // Highlight operations
  addHighlight: (highlight: Omit<Highlight, 'id'>) => Promise<string>;
  updateHighlight: (id: string, updates: Partial<Highlight>) => Promise<void>;
  deleteHighlight: (id: string) => Promise<void>;
  loadHighlights: (bookId: string) => Promise<void>;

  // Settings
  updateSettings: (updates: Partial<ReaderSettings>) => void;

  // Reading sessions
  addReadingSession: (session: Omit<ReadingSession, 'id'>) => Promise<void>;

  // Collections
  createCollection: (collection: Omit<Collection, 'id'>) => Promise<string>;
  updateCollection: (id: string, updates: Partial<Collection>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addBookToCollection: (collectionId: string, bookId: string) => Promise<void>;
  removeBookFromCollection: (collectionId: string, bookId: string) => Promise<void>;

  // Dictionary/Word lookups
  addWordLookup: (lookup: Omit<WordLookup, 'id' | 'timestamp'>) => Promise<string>;
  getWordLookups: () => WordLookup[];
  getWordLookupHistory: (word: string) => WordLookup[];
  deleteWordLookup: (id: string) => Promise<void>;

  // Book progress
  updateBookProgress: (bookId: string, progress: BookProgress) => Promise<void>;
  getBookProgress: (bookId: string) => BookProgress | undefined;
  calculateEstimatedTimeRemaining: (bookId: string) => number;

  // Classical library
  getClassicalLibrary: () => ClassicalLibraryItem[];
  getClassicalLibraryByCategory: (category: string) => ClassicalLibraryItem[];
  getClassicalLibraryByTier: (tier: 1 | 2) => ClassicalLibraryItem[];
  getClassicalLibraryByStage: (stage: 'grammar' | 'logic' | 'rhetoric') => ClassicalLibraryItem[];
  addClassicalLibraryItem: (item: ClassicalLibraryItem) => Promise<string>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_READER_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [wordLookups, setWordLookups] = useState<WordLookup[]>([]);
  const [bookProgress, setBookProgress] = useState<Map<string, BookProgress>>(new Map());
  const [textLoad, setTextLoad] = useState<TextLoadState>(IDLE_TEXT_LOAD);

  /** Latest book on the desk, readable from effects without re-subscribing. */
  const currentBookRef = useRef<Book | null>(null);
  /** Pagination budget in force, kept in a ref so the loader never reads stale state. */
  const budgetRef = useRef(
    DEFAULT_READER_SETTINGS.pageMode === 'paginated' ? PAGE_BUDGET.paginated : PAGE_BUDGET.scroll
  );
  /** Monotonic request id — only the newest download may own the status. */
  const requestSeq = useRef(0);

  useEffect(() => {
    currentBookRef.current = currentBook;
  }, [currentBook]);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      const stored = await DatabaseService.getBooks();

      // Re-link volumes saved before sourceUrl was recorded, otherwise they
      // can never be read: nothing on the row says where the text lives.
      const linked = stored.map(book => {
        if (book.sourceUrl || book.itemType === 'music' || book.itemType === 'art') return book;
        const ref = CATALOG_REFS.get(catalogKey(book.title, book.author));
        if (!ref?.textUrl) return book;

        const patch: Partial<Book> = { sourceUrl: ref.textUrl };
        if (!book.cover) patch.cover = ref.coverUrl;
        DatabaseService.updateBook(book.id, patch).catch(error =>
          console.warn('[AppContext] Could not persist source link:', error)
        );
        return { ...book, ...patch };
      });

      setBooks(linked);

      // Backfill covers for library items added before a given step in
      // resolveCatalogCover's fallback chain existed -- most notably
      // art/music items, which had NO cover source at all until today (art
      // covers were then broken a second way: the source that resolves
      // them was mislabeled and matched nothing, see resolveCatalogCover's
      // comment). Existing rows never re-run addClassicalLibraryItem, so
      // without this they'd stay on the typographic fallback forever even
      // after the underlying fix shipped. Runs after the initial paint,
      // one row at a time so a slow/failed lookup for one item can't block
      // the rest.
      for (const book of linked) {
        if (book.cover) continue;
        const item = CATALOG_ITEMS.get(catalogKey(book.title, book.author));
        if (!item) continue;
        resolveCatalogCover(item)
          .then((cover) => {
            if (!cover) return;
            DatabaseService.updateBook(book.id, { cover }).catch((error) =>
              console.warn('[AppContext] Could not persist backfilled cover:', error)
            );
            setBooks((prev) => prev.map((b) => (b.id === book.id ? { ...b, cover } : b)));
          })
          .catch((error) => console.warn('[AppContext] Cover backfill failed:', error));
      }
    } catch (error) {
      console.error('Load books error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addBook = async (book: Omit<Book, 'id'>) => {
    const id = await DatabaseService.addBook(book);
    const newBook = { ...book, id } as Book;
    setBooks(prev => [newBook, ...prev]);
    return id;
  };

  const updateBook = async (id: string, updates: Partial<Book>) => {
    await DatabaseService.updateBook(id, updates);
    setBooks(prev => prev.map(b => (b.id === id ? { ...b, ...updates } : b)));
    setCurrentBook(prev => (prev && prev.id === id ? { ...prev, ...updates } : prev));
  };

  const deleteBook = async (id: string) => {
    await DatabaseService.deleteBook(id);
    setBooks(prev => prev.filter(b => b.id !== id));
    setCurrentBook(prev => (prev && prev.id === id ? null : prev));
  };

  /* ------------------------------------------------------------ text ---- */

  /** Collapse no-op transitions so a status write never forces a render. */
  const setLoadState = useCallback((next: TextLoadState) => {
    setTextLoad(prev =>
      prev.bookId === next.bookId && prev.status === next.status && prev.error === next.error
        ? prev
        : next
    );
  }, []);

  /**
   * Patch a book in memory, persisting only the fields the store accepts.
   * `content` is passed in `memoryOnly` and deliberately never reaches
   * DatabaseService — see the note at the top of this file.
   */
  const applyBookFields = useCallback(
    (id: string, memoryOnly: Partial<Book>, persist: Partial<Book> = {}) => {
      const patch = { ...memoryOnly, ...persist };
      setBooks(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)));
      setCurrentBook(prev => (prev && prev.id === id ? { ...prev, ...patch } : prev));
      if (Object.keys(persist).length > 0) {
        DatabaseService.updateBook(id, persist).catch(error =>
          console.warn('[AppContext] Could not persist book metadata:', error)
        );
      }
    },
    []
  );

  const ensureBookText = useCallback(
    async (book: Book): Promise<Book> => {
      if (!book) return book;

      // Every call claims the status; a slower earlier one may no longer
      // write to it. Guards against a stale download stamping its result
      // over the volume the reader has since moved on to.
      const seq = ++requestSeq.current;
      const claim = (next: TextLoadState) => {
        if (seq === requestSeq.current) setLoadState(next);
      };

      // Already in hand — nothing to do, and no spinner.
      if (typeof book.content === 'string' && book.content.trim().length > 0) {
        claim({ bookId: book.id, status: 'ready', error: null });
        return book;
      }

      // Cached from an earlier open in this session (or from a sibling entry
      // pointing at the same edition): attach without touching the network.
      const cached = book.sourceUrl ? textCache.get(book.sourceUrl) : undefined;
      if (cached) {
        try {
          const totalPages = Math.max(
            1,
            countPages(GutenbergService.parse(cached), budgetRef.current)
          );
          applyBookFields(book.id, { content: cached }, { totalPages, fileSize: cached.length });
          claim({ bookId: book.id, status: 'ready', error: null });
          return { ...book, content: cached, totalPages, fileSize: cached.length };
        } catch (error) {
          console.warn('[AppContext] Could not paginate cached text:', error);
          claim({ bookId: book.id, status: 'error', error: describeTextError(error, book.title) });
          return book;
        }
      }

      // A locally-imported EPUB/TXT has its extracted text sitting in
      // IndexedDB (see EbookService), not behind a remote `sourceUrl`. This
      // branch was missing entirely, so a successfully-imported local book
      // fell straight into the "unavailable" case below and the reader
      // showed the Gutenberg-flavoured "hasn't been downloaded" message for
      // text that was already sitting on the device.
      if (EbookService.hasStoredText(book)) {
        claim({ bookId: book.id, status: 'loading', error: null });
        try {
          const restored = await EbookService.loadStoredText(book);
          if (!restored) throw new Error('LOCAL_TEXT_MISSING');

          const totalPages = Math.max(1, countPages(GutenbergService.parse(restored), budgetRef.current));
          const fileSize = restored.length;
          applyBookFields(book.id, { content: restored }, { totalPages, fileSize });
          claim({ bookId: book.id, status: 'ready', error: null });
          return { ...book, content: restored, totalPages, fileSize };
        } catch (error) {
          console.warn('[AppContext] Could not restore stored text:', error);
          claim({
            bookId: book.id,
            status: 'error',
            error: `Could not restore the text of "${book.title}" from this device. Try importing the file again.`,
          });
          return book;
        }
      }

      // Artwork, music, unmatched catalogue entries, and imports whose text
      // could not be extracted (PDF/MOBI today) have nothing to load. That is
      // a state, not a failure — say nothing alarming.
      const fetchable = book.itemType !== 'music' && book.itemType !== 'art' && !!book.sourceUrl;
      if (!fetchable) {
        claim({ bookId: book.id, status: 'unavailable', error: null });
        return book;
      }

      claim({ bookId: book.id, status: 'loading', error: null });

      try {
        const cleaned = await fetchBookText(book.sourceUrl as string, book.title);
        const totalPages = Math.max(1, countPages(GutenbergService.parse(cleaned), budgetRef.current));
        const fileSize = cleaned.length;

        // The text itself stays in memory; the page count and size are real
        // metadata and do belong in the store.
        applyBookFields(book.id, { content: cleaned }, { totalPages, fileSize });

        claim({ bookId: book.id, status: 'ready', error: null });
        return { ...book, content: cleaned, totalPages, fileSize };
      } catch (error) {
        console.warn('[AppContext] Text download failed:', error);
        claim({
          bookId: book.id,
          status: 'error',
          error: describeTextError(error, book.title),
        });
        return book;
      }
    },
    [applyBookFields, setLoadState]
  );

  const openBook = useCallback(
    async (book: Book): Promise<Book> => {
      setCurrentBook(book);
      return ensureBookText(book);
    },
    [ensureBookText]
  );

  const retryTextLoad = useCallback(async () => {
    const book = currentBookRef.current;
    if (!book) return;
    setLoadState({ bookId: book.id, status: 'idle', error: null });
    await ensureBookText(book);
  }, [ensureBookText, setLoadState]);

  const clearTextError = useCallback(() => {
    setTextLoad(prev => (prev.status === 'error' ? { ...prev, status: 'idle', error: null } : prev));
  }, []);

  /**
   * Any route into the reader — the library, a home carousel, "Continue
   * Reading" — goes through setCurrentBook, so the download is hung off the
   * book on the desk rather than off one screen's button.
   *
   * Keyed by id and source only: attaching the text mutates neither, so a
   * completed download cannot re-trigger this effect.
   */
  useEffect(() => {
    if (!currentBook) {
      setLoadState(IDLE_TEXT_LOAD);
      return;
    }
    // ensureBookText owns its own failures; this catch is belt-and-braces
    // against an unhandled rejection escaping into the render tree.
    ensureBookText(currentBook).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBook?.id, currentBook?.sourceUrl, ensureBookText, setLoadState]);

  /**
   * Page count depends on the reading mode's character budget, so switching
   * modes must re-paginate the open volume — otherwise the library keeps
   * quoting a page total the reader no longer agrees with.
   */
  useEffect(() => {
    const budget = settings.pageMode === 'paginated' ? PAGE_BUDGET.paginated : PAGE_BUDGET.scroll;
    const previous = budgetRef.current;
    budgetRef.current = budget;
    if (budget === previous) return;

    const book = currentBookRef.current;
    if (!book) return;
    const text = book.content || (book.sourceUrl ? textCache.get(book.sourceUrl) : undefined);
    if (!text) return;

    const totalPages = Math.max(1, countPages(GutenbergService.parse(text), budget));
    if (totalPages === book.totalPages) return;
    applyBookFields(book.id, {}, { totalPages });
  }, [settings.pageMode, applyBookFields]);

  /* ------------------------------------------------------------------- */

  const addBookmark = async (bookmark: Omit<Bookmark, 'id'>) => {
    const id = await DatabaseService.addBookmark(bookmark);
    setBookmarks(prev => [{ ...bookmark, id } as Bookmark, ...prev]);
    return id;
  };

  const removeBookmark = async (id: string) => {
    await DatabaseService.deleteBookmark(id);
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  const loadBookmarks = async (bookId: string) => {
    const bms = await DatabaseService.getBookmarks(bookId);
    setBookmarks(bms);
  };

  const addHighlight = async (highlight: Omit<Highlight, 'id'>) => {
    const id = await DatabaseService.addHighlight(highlight);
    setHighlights(prev => [{ ...highlight, id } as Highlight, ...prev]);
    return id;
  };

  const updateHighlight = async (id: string, updates: Partial<Highlight>) => {
    await DatabaseService.updateHighlight(id, updates);
    setHighlights(prev => prev.map(h => (h.id === id ? { ...h, ...updates } : h)));
  };

  const deleteHighlight = async (id: string) => {
    await DatabaseService.deleteHighlight(id);
    setHighlights(prev => prev.filter(h => h.id !== id));
  };

  const loadHighlights = async (bookId: string) => {
    const hls = await DatabaseService.getHighlights(bookId);
    setHighlights(hls);
  };

  const updateSettings = (updates: Partial<ReaderSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const addReadingSession = async (session: Omit<ReadingSession, 'id'>) => {
    await DatabaseService.addReadingSession(session);
  };

  const getClassicalLibrary = () => {
    try {
      return getClassicalLibraryWithSources();
    } catch (error) {
      console.error('Error loading classical library with sources:', error);
      return classicalLibrary;
    }
  };

  const getClassicalLibraryByCategory = (category: string) => {
    const key = category as keyof typeof classicalLibraryByCategory;
    return classicalLibraryByCategory[key] || [];
  };

  const getClassicalLibraryByTier = (tier: 1 | 2) => {
    return tier === 1 ? tier1Texts : tier2Texts;
  };

  const getClassicalLibraryByStage = (stage: 'grammar' | 'logic' | 'rhetoric') => {
    if (stage === 'grammar') return grammarStageMaterial;
    if (stage === 'logic') return logicStageMaterial;
    return rhetoricStageMaterial;
  };

  const addClassicalLibraryItem = async (item: ClassicalLibraryItem) => {
    const ref = gutenbergIds[item.id];
    const cover = await resolveCatalogCover(item);
    const book: Omit<Book, 'id'> = {
      title: item.title,
      author: item.author,
      currentProgress: 0,
      // Page count is unknown until the text is fetched and paginated.
      totalPages: 0,
      fileSize: 0,
      isFavorite: false,
      isFinished: false,
      cover,
      // Where the text comes from. Persisted (unlike the text itself), so the
      // volume stays readable across reloads.
      sourceUrl: ref?.textUrl ?? undefined,
      coverColor: '#2d1b4e',
      addedDate: new Date().toISOString(),
      itemType: item.type,
      description: item.description,
    };
    return addBook(book);
  };

  // Collection operations
  const createCollection = async (collection: Omit<Collection, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newCollection: Collection = { ...collection, id };
    setCollections(prev => [newCollection, ...prev]);
    return id;
  };

  const updateCollection = async (id: string, updates: Partial<Collection>) => {
    setCollections(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));
  };

  const deleteCollection = async (id: string) => {
    setCollections(prev => prev.filter(c => c.id !== id));
  };

  const addBookToCollection = async (collectionId: string, bookId: string) => {
    setCollections(prev =>
      prev.map(c => {
        if (c.id === collectionId && !c.bookIds.includes(bookId)) {
          return { ...c, bookIds: [...c.bookIds, bookId] };
        }
        return c;
      })
    );
  };

  const removeBookFromCollection = async (collectionId: string, bookId: string) => {
    setCollections(prev =>
      prev.map(c => {
        if (c.id === collectionId) {
          return { ...c, bookIds: c.bookIds.filter(id => id !== bookId) };
        }
        return c;
      })
    );
  };

  // Dictionary/Word lookups
  const addWordLookup = async (lookup: Omit<WordLookup, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newLookup: WordLookup = { ...lookup, id, timestamp: Date.now() };
    setWordLookups(prev => [newLookup, ...prev]);
    return id;
  };

  const getWordLookups = () => wordLookups;

  const getWordLookupHistory = (word: string) => {
    return wordLookups.filter(w => w.word.toLowerCase() === word.toLowerCase());
  };

  const deleteWordLookup = async (id: string) => {
    setWordLookups(prev => prev.filter(w => w.id !== id));
  };

  // Book progress
  const updateBookProgress = async (bookId: string, progress: BookProgress) => {
    setBookProgress(prev => {
      const next = new Map(prev);
      next.set(bookId, progress);
      return next;
    });
  };

  const getBookProgress = (bookId: string) => {
    return bookProgress.get(bookId);
  };

  const calculateEstimatedTimeRemaining = (bookId: string) => {
    const progress = bookProgress.get(bookId);
    if (!progress || progress.totalPages === 0) return 0;

    const pagesRemaining = progress.totalPages - progress.currentPage;
    return Math.ceil((pagesRemaining / progress.wordsPerMinute) / 60); // Hours
  };

  return (
    <AppContext.Provider
      value={{
        books,
        currentBook,
        bookmarks,
        highlights,
        settings,
        isLoading,
        collections,
        wordLookups,
        bookProgress,
        addBook,
        updateBook,
        deleteBook,
        setCurrentBook,
        textLoad,
        isTextLoading: textLoad.status === 'loading',
        openBook,
        ensureBookText,
        retryTextLoad,
        clearTextError,
        addBookmark,
        removeBookmark,
        loadBookmarks,
        addHighlight,
        updateHighlight,
        deleteHighlight,
        loadHighlights,
        updateSettings,
        addReadingSession,
        createCollection,
        updateCollection,
        deleteCollection,
        addBookToCollection,
        removeBookFromCollection,
        addWordLookup,
        getWordLookups,
        getWordLookupHistory,
        deleteWordLookup,
        updateBookProgress,
        getBookProgress,
        calculateEstimatedTimeRemaining,
        getClassicalLibrary,
        getClassicalLibraryByCategory,
        getClassicalLibraryByTier,
        getClassicalLibraryByStage,
        addClassicalLibraryItem,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
