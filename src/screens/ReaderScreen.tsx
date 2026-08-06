import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Animated,
  Share,
  Modal,
  TextInput,
  Platform,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { TTSService } from '../services/TTSService';
import { AudioService, PlaybackState } from '../services/AudioService';
import { unlockAudioPlayback } from '../services/WebSound';
import { GutenbergService, Paragraph } from '../services/GutenbergService';
import BookCover from '../components/BookCover';
import Shell, { Column, useColumn } from '../components/Shell';
import {
  BookmarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MenuIcon,
  PauseIcon,
  PlayIcon,
  SearchIcon,
  CloseIcon,
} from '../components/icons';
import { colors, fonts, space, radius, elevation, layout, readerPalettes } from '../theme';
import { DEFAULT_READER_SETTINGS } from '../types';
import type { ReaderSettings } from '../types';

import { Alert } from '../components/Alert';
import { WikipediaService, WikipediaSummary } from '../services/WikipediaService';
import { AudioShareService, AudioShareError } from '../services/AudioShareService';
import { KokoroTTSService, DEFAULT_KOKORO_VOICE } from '../services/KokoroTTSService';
/**
 * The reading surface — the most important screen in the app.
 *
 * Everything here serves one goal: a line of text that is comfortable to read
 * for an hour. That means
 *
 *   PAPER      cream ground, near-black serif. A book is not a terminal; dark
 *              is an option the reader offers, not the state it opens in.
 *   MEASURE    ~34em / 660px, centred. Uncapped, a 1365px desktop window ran
 *              the text edge to edge at ~180 characters a line, which is
 *              unreadable — the eye cannot find the next line's start.
 *   NO CHROME  the page and a whisper of a page number. Header and controls
 *              are hidden until the page is tapped.
 *
 * The chrome, when revealed, is capped to the same column as the text so it
 * cannot spread two buttons across a desktop viewport either.
 */

/** Optical maximum line length. Beyond this the eye loses the line return. */
const MEASURE = layout.readerMaxWidth;

/** Page margins, keyed off the user's marginSize setting. */
const GUTTERS: Record<string, number> = {
  small: space.lg,
  medium: space.xl,
  large: space.xxxl,
};

/**
 * Characters per page. Paginated mode is roughly a printed page; scroll mode
 * is a longer run. Both stay under the 4500-char TTS ceiling so any page can
 * be read aloud in a single synthesis request.
 */
const PAGE_BUDGET = { paginated: 1500, scroll: 3200 };

/** Head margin, and the tail that keeps the last line clear of the controls. */
const HEAD_SPACE = 88;
const TAIL_SPACE = 112;

/* ------------------------------------------------------------------ *
 * READER DEFAULTS
 *
 * The reader opens on PAPER and JUSTIFIED. `DEFAULT_READER_SETTINGS` still
 * ships `theme: 'dark'` / `textAlignment: 'left'` and that file is not this
 * pass's to change, so the reader resolves the two itself — once — and then
 * writes them into the store so the status bar and the Settings previews are
 * describing the same page the reader is drawing.
 *
 * After that single push every value is obeyed verbatim: dark, night, ragged
 * right and centred all stay fully available. The window in which the reader
 * substitutes its own default is the first render of the session, and only for
 * a setting still sitting on the shipped value.
 *
 * If the shipped defaults are later changed to match these, every branch below
 * collapses to a no-op rather than fighting them.
 * ------------------------------------------------------------------ */

const READER_DEFAULTS = {
  theme: 'light' as ReaderSettings['theme'],
  textAlignment: 'justify' as ReaderSettings['textAlignment'],
};

/** Session flag: the reader's defaults are pushed into the store at most once. */
let defaultsPushed = false;

/**
 * Substitute the reader's defaults for any setting still holding the shipped
 * value. Value-based rather than identity-based on purpose: someone who nudges
 * the font size in Settings has not thereby chosen to read on black.
 */
function withReaderDefaults(settings: ReaderSettings): ReaderSettings {
  if (defaultsPushed) return settings;
  const patch: Partial<ReaderSettings> = {};
  if (settings.theme === DEFAULT_READER_SETTINGS.theme) patch.theme = READER_DEFAULTS.theme;
  if (settings.textAlignment === DEFAULT_READER_SETTINGS.textAlignment) {
    patch.textAlignment = READER_DEFAULTS.textAlignment;
  }
  return Object.keys(patch).length ? { ...settings, ...patch } : settings;
}

/** Themes that read as paper — used to label the light/dark toggle. */
const PAPER_THEMES = new Set(['light', 'sepia']);

/**
 * Highlight inks. The VALUE is what gets persisted on Highlight.color, so it
 * must be a real colour string and must stay in the canonical set that
 * HighlightsScreen filters by — storing a semantic key like 'sage' here makes
 * the mark unfilterable and paints an unparseable colour on native.
 * Keep these literals in sync with HIGHLIGHT_COLORS in HighlightsScreen.tsx;
 * they are stored data, so they must not be swapped for theme tokens.
 */
const HIGHLIGHT_SWATCHES = [
  { value: '#c9a961', label: 'Gold' },
  { value: '#d4a574', label: 'Amber' },
  { value: '#8b7355', label: 'Bronze' },
  { value: '#5c4033', label: 'Umber' },
];

const DEFAULT_HIGHLIGHT = HIGHLIGHT_SWATCHES[0].value;

/** A page is a run of whole paragraphs — never a mid-word character slice. */
interface ReaderPage {
  paragraphs: Paragraph[];
  chapterIndex: number;
  /** True when this page opens a chapter, which earns a title block. */
  startsChapter: boolean;
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/** Splits page text into Kokoro-sized pieces for Read Aloud -- one call per
 * paragraph, further split on sentence boundaries if a paragraph alone
 * would still be slow to synthesize. Keeps each chunk fast enough that
 * playback of the page can start almost immediately instead of waiting on
 * the whole page at once (see playPageWithKokoro in ReaderScreen). */
const MAX_CHUNK_CHARS = 350;

/** Hard fallback for a single "sentence" that's still too long on its own --
 * confirmed live as a real case, not theoretical: a long run of book titles
 * with no periods between them (a King James Bible front-matter listing)
 * matched as ONE sentence by the regex below (nothing for it to split on),
 * producing a ~29-second first chunk instead of a short one. Splits on word
 * boundaries so this can never happen regardless of punctuation. */
function splitOnWordBoundary(text: string): string[] {
  const words = text.split(/\s+/);
  const pieces: string[] = [];
  let buffer = '';
  for (const word of words) {
    if (buffer && (buffer + ' ' + word).length > MAX_CHUNK_CHARS) {
      pieces.push(buffer);
      buffer = word;
    } else {
      buffer = buffer ? `${buffer} ${word}` : word;
    }
  }
  if (buffer) pieces.push(buffer);
  return pieces;
}

/** Splits a single over-long paragraph into MAX_CHUNK_CHARS-ish pieces on
 * sentence boundaries (falling back to word boundaries -- see
 * splitOnWordBoundary above). */
function splitParagraph(trimmed: string): string[] {
  const sentences = trimmed.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [trimmed];
  const pieces: string[] = [];
  let buffer = '';
  const flush = () => {
    if (!buffer) return;
    const trimmedBuffer = buffer.trim();
    if (trimmedBuffer.length > MAX_CHUNK_CHARS) {
      pieces.push(...splitOnWordBoundary(trimmedBuffer));
    } else {
      pieces.push(trimmedBuffer);
    }
    buffer = '';
  };
  for (const sentence of sentences) {
    if (buffer && (buffer + sentence).length > MAX_CHUNK_CHARS) flush();
    buffer += sentence;
  }
  flush();
  return pieces;
}

function buildReadAloudChunks(paragraphs: string[]): string[] {
  const chunks: string[] = [];
  // Merge adjacent short paragraphs into one chunk (up to MAX_CHUNK_CHARS)
  // instead of always one chunk per paragraph. Confirmed live as the real
  // cause of long silent gaps mid-Read-Aloud: Kokoro has a real per-call
  // fixed overhead (tokenize, phonemize, etc.) on top of its per-character
  // cost, so a page of short paragraphs -- a book-title listing, short
  // dialogue lines, front matter -- was producing a run of TINY chunks
  // whose own playback (a couple seconds each) finished well before the
  // NEXT tiny chunk's synthesis did, even though synthesis reliably beats
  // playback time for a normal-length chunk. Batching short paragraphs
  // together gives every synthesize() call enough content to amortize that
  // fixed cost against, the same way it already works for ordinary prose.
  let buffer = '';
  const flushBuffer = () => {
    if (buffer) chunks.push(buffer);
    buffer = '';
  };
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_CHUNK_CHARS) {
      flushBuffer();
      chunks.push(...splitParagraph(trimmed));
      continue;
    }
    if (buffer && (buffer + ' ' + trimmed).length > MAX_CHUNK_CHARS) {
      flushBuffer();
    }
    buffer = buffer ? `${buffer} ${trimmed}` : trimmed;
  }
  flushBuffer();
  return chunks;
}

export default function ReaderScreen() {
  const {
    currentBook,
    bookmarks,
    settings: storedSettings,
    updateSettings,
    updateBook,
    addBookmark,
    addHighlight,
    addReadingSession,
    textLoad,
    isTextLoading,
    retryTextLoad,
  } = useApp();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width: windowWidth } = useWindowDimensions();

  const settings = useMemo(() => withReaderDefaults(storedSettings), [storedSettings]);

  const [currentPage, setCurrentPage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    position: 0,
    duration: 0,
    rate: 1,
  });
  const [chromeVisible, setChromeVisible] = useState(false);
  const [showMenus, setShowMenus] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showHighlightColor, setShowHighlightColor] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<WikipediaSummary | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isSharingAudio, setIsSharingAudio] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [highlightColor, setHighlightColor] = useState(DEFAULT_HIGHLIGHT);
  const [sessionStartTime] = useState(Date.now());
  const [headerHeight, setHeaderHeight] = useState(92);

  const scrollRef = useRef<ScrollView>(null);

  const palette = readerPalettes[settings.theme] || readerPalettes[READER_DEFAULTS.theme];
  const onPaper = PAPER_THEMES.has(settings.theme);

  /**
   * Publish the reader's defaults to the store once, so the status bar, the
   * Settings previews and the reader are all describing the same page — and so
   * that from here on every setting is read back verbatim.
   */
  useEffect(() => {
    if (defaultsPushed) return;
    defaultsPushed = true;

    const patch: Partial<ReaderSettings> = {};
    if (storedSettings.theme !== settings.theme) patch.theme = settings.theme;
    if (storedSettings.textAlignment !== settings.textAlignment) {
      patch.textAlignment = settings.textAlignment;
    }
    if (Object.keys(patch).length) updateSettings(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    AudioService.onPlaybackStatus(setPlaybackState);
    return () => {
      readAloudCancelRef.current = true;
      AudioService.cleanup();
    };
  }, []);

  // --------------------------------------------------------------- chrome ----

  const chromeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(chromeAnim, {
      toValue: chromeVisible ? 1 : 0,
      duration: 180,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    if (!chromeVisible) setShowMenus(false);
  }, [chromeVisible, chromeAnim]);

  /**
   * Tap the page to reveal the furniture. On web a click that merely ends a
   * text selection must not count — otherwise highlighting a sentence always
   * throws the chrome up over the line you were reading. The selection
   * itself is picked up separately below (mobile browsers don't fire a
   * click after a touch-drag selection at all, so this check alone would
   * never open the passage modal on a phone).
   */
  const toggleChrome = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const selection = window.getSelection?.();
      if (selection && String(selection).trim().length > 0) return;
    }
    setChromeVisible((visible) => !visible);
  }, []);

  /**
   * A mouse drag-select ends with mouseup, which the browser follows with a
   * real click -- toggleChrome above catches that. A touch drag-select does
   * NOT get a synthetic click afterward (deliberate mobile browser
   * behavior, to stop a selection from also triggering whatever the tap
   * would have done) -- confirmed as the reason "highlight a passage" did
   * nothing on a phone. selectionchange fires for every selection method
   * on every platform, so it's the one thing both share.
   */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const anyModalOpen =
      showHighlightColor || showSearch || showBookmarkModal || lookupLoading || !!lookupResult || !!lookupError;
    if (anyModalOpen) return;

    let settleTimer: ReturnType<typeof setTimeout>;
    const handleSelectionChange = () => {
      clearTimeout(settleTimer);
      // Debounced: selectionchange fires continuously while a finger or
      // mouse is still dragging across text. Only act once it settles.
      settleTimer = setTimeout(() => {
        const selection = window.getSelection?.();
        const text = selection ? String(selection).trim() : '';
        if (text.length > 0) {
          setSelectedText(text);
          setShowHighlightColor(true);
        }
      }, 350);
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      clearTimeout(settleTimer);
    };
  }, [showHighlightColor, showSearch, showBookmarkModal, lookupLoading, lookupResult, lookupError]);

  // ---------------------------------------------------------------- text ----

  const textContent = currentBook?.content || '';

  /**
   * Structure the raw text once per book. Paragraphs (not characters) are the
   * unit of layout, so a page break never lands mid-sentence and never mid-word
   * the way the old fixed 500-character slice did.
   */
  const parsed = useMemo(() => {
    if (!textContent.trim()) return null;
    const book = GutenbergService.parse(GutenbergService.stripBoilerplate(textContent));
    if (!book.paragraphs.length) {
      // Text with no blank-line structure still has to be readable.
      const flat = textContent.replace(/\s+/g, ' ').trim();
      const chunks = flat.match(/[\s\S]{1,1200}(\s|$)/g) || [flat];
      return {
        chapters: [{ index: 0, title: 'Full Text', startParagraph: 0 }],
        wordCount: flat.split(/\s+/).length,
        paragraphs: chunks.map((text, index) => ({ index, text: text.trim(), chapter: 0 })),
      };
    }
    return book;
  }, [textContent]);

  const pages = useMemo<ReaderPage[]>(() => {
    if (!parsed) return [];
    const budget = settings.pageMode === 'scroll' ? PAGE_BUDGET.scroll : PAGE_BUDGET.paginated;
    const out: ReaderPage[] = [];

    let bucket: Paragraph[] = [];
    let chars = 0;
    let chapter = parsed.paragraphs[0]?.chapter ?? 0;
    let opensChapter = true;

    const flush = () => {
      if (!bucket.length) return;
      out.push({ paragraphs: bucket, chapterIndex: chapter, startsChapter: opensChapter });
      bucket = [];
      chars = 0;
      opensChapter = false;
    };

    for (const paragraph of parsed.paragraphs) {
      if (paragraph.chapter !== chapter) {
        flush();
        chapter = paragraph.chapter;
        opensChapter = true;
      } else if (chars > 0 && chars + paragraph.text.length > budget) {
        flush();
      }
      bucket.push(paragraph);
      chars += paragraph.text.length + 1;
    }
    flush();

    return out;
  }, [parsed, settings.pageMode]);

  const totalPages = Math.max(1, pages.length);
  const safePage = Math.min(currentPage, totalPages - 1);
  const page = pages[safePage];

  const chapterTitle = parsed?.chapters[page?.chapterIndex ?? 0]?.title || '';

  /**
   * Search across the whole book, client-side over the already-parsed
   * paragraphs — no server round trip, works offline. Each hit maps back to
   * the exact page it lives on via `pages`, and shows a short excerpt around
   * the match rather than the full paragraph, matching how every ereader's
   * search results list actually reads.
   */
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2 || !parsed) return [];
    const out: { paragraphIndex: number; pageIndex: number; snippet: string }[] = [];
    for (const paragraph of parsed.paragraphs) {
      const idx = paragraph.text.toLowerCase().indexOf(q);
      if (idx === -1) continue;
      const pageIndex = pages.findIndex((p) => p.paragraphs.some((pp) => pp.index === paragraph.index));
      if (pageIndex === -1) continue;
      const start = Math.max(0, idx - 40);
      const snippet = `${start > 0 ? '…' : ''}${paragraph.text.slice(start, idx + q.length + 40).trim()}…`;
      out.push({ paragraphIndex: paragraph.index, pageIndex, snippet });
      if (out.length >= 100) break;
    }
    return out;
  }, [searchQuery, parsed, pages]);

  const jumpToSearchResult = (pageIndex: number) => {
    setCurrentPage(pageIndex);
    setShowSearch(false);
    setSearchQuery('');
  };

  // Reset to the opening page whenever a different book is put on the desk.
  // Explicitly stops audio here too, not just via the safePage-keyed effect
  // below: if the previous book happened to also be sitting on page 0,
  // setCurrentPage(0) wouldn't actually change safePage's value, and that
  // effect wouldn't re-fire.
  useEffect(() => {
    readAloudCancelRef.current = true;
    readAloudActiveRef.current = false;
    AudioService.stop().catch(() => {});
    setCurrentPage(0);
    setIsPlaying(false);
    setChromeVisible(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBook?.id]);

  // A page turn should land at the top of the new page, like a real book.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [safePage]);

  /**
   * Stop Read Aloud whenever the visible page changes, for ANY reason --
   * next/prev buttons, swipe, chapter jump, search-result jump, Table of
   * Contents. Centralized here (keyed on the page value itself) rather than
   * patched into each navigation call site individually: there are enough
   * of those (handleNextPage, handlePreviousPage, goToChapter, the search
   * jump, the route-param chapter jump) that stopping audio in only some of
   * them is exactly the kind of gap that's easy to introduce by patching
   * one at a time and easy to miss reviewing. Setting the cancel flag alone
   * only stops the QUEUE from advancing to a new chunk -- the chunk already
   * playing would otherwise keep audibly playing to its natural end first.
   */
  useEffect(() => {
    readAloudCancelRef.current = true;
    readAloudActiveRef.current = false;
    AudioService.stop().catch(() => {});
    setIsPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  /**
   * Warm Kokoro up in the background as soon as a page is actually settled
   * on (debounced past quick page-flipping), so pressing Read Aloud is
   * close to instant instead of waiting on a cold model load. This can't
   * jump the gun on the browser's audio-gesture requirement -- it only
   * generates data, never calls .play() -- so there's nothing here for the
   * user to have to interact with first; by the time they press play, the
   * model is already loaded and the first chunk is already in
   * KokoroTTSService's cache, keyed on the exact same (text, voice, speed)
   * synthesize() will ask for.
   */
  useEffect(() => {
    if (Platform.OS !== 'web' || !KokoroTTSService.isSupported() || !page) return;
    const timer = setTimeout(() => {
      const chunks = buildReadAloudChunks(page.paragraphs.map((p) => p.text));
      if (chunks.length) {
        KokoroTTSService.synthesize(chunks[0], DEFAULT_KOKORO_VOICE, settings.ttsVoiceRate).catch(() => {
          // Best-effort warm-up -- a real attempt from the play button will
          // surface any actual error to the user; this one just primes the
          // cache when it works and is silently wasted when it doesn't.
        });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [page, settings.ttsVoiceRate]);

  const getPageContent = useCallback(() => {
    if (!page) return '';
    return page.paragraphs.map((p) => p.text).join('\n\n');
  }, [page]);

  // ------------------------------------------------------------ progress ----

  const progress = totalPages > 1 ? safePage / (totalPages - 1) : 1;
  const bookBookmarks = currentBook ? bookmarks.filter((b) => b.bookId === currentBook.id).length : 0;

  const minutesLeft = useMemo(() => {
    if (!parsed || !pages.length) return 0;
    const wordsPerPage = parsed.wordCount / pages.length;
    const remaining = Math.max(0, pages.length - safePage - 1) * wordsPerPage;
    return Math.ceil(remaining / 220); // 220 wpm is a normal adult reading pace.
  }, [parsed, pages.length, safePage]);

  // ------------------------------------------------------------- actions ----

  // Confirmed live: synthesizing a WHOLE PAGE in one Kokoro call took 90+
  // seconds and blocked the tab the entire time -- not viable as a single
  // request. Chunking fixes this: each chunk is short enough to synthesize
  // in a few seconds, playback of chunk N starts as soon as it's ready, and
  // chunk N+1 synthesizes in the background *while* chunk N is playing (a
  // paragraph takes several seconds to read aloud, comfortably longer than
  // it takes Kokoro to generate the next one) -- so total perceived wait is
  // one short chunk, not the whole page.
  const readAloudCancelRef = useRef(false);
  const readAloudActiveRef = useRef(false);

  const playPageWithKokoro = async () => {
    const chunks = buildReadAloudChunks(page?.paragraphs.map((p) => p.text) ?? []);
    if (!chunks.length) return;

    readAloudCancelRef.current = false;
    readAloudActiveRef.current = true;
    setIsLoadingAudio(true);
    try {
      let nextChunk: Promise<string> = KokoroTTSService.synthesize(
        chunks[0],
        DEFAULT_KOKORO_VOICE,
        settings.ttsVoiceRate
      );
      for (let i = 0; i < chunks.length; i++) {
        if (readAloudCancelRef.current) break;
        const uri = await nextChunk;
        if (readAloudCancelRef.current) break;
        if (i + 1 < chunks.length) {
          // Kick off the next chunk's synthesis now, so it's ready (or
          // close to it) by the time this one finishes playing.
          nextChunk = KokoroTTSService.synthesize(chunks[i + 1], DEFAULT_KOKORO_VOICE, settings.ttsVoiceRate);
        }
        setIsLoadingAudio(false);
        await AudioService.load(uri);
        const chunkEnded = AudioService.waitForEnd();
        await AudioService.play();
        setIsPlaying(true);
        await chunkEnded;
      }
    } catch (error) {
      console.error('[ReaderScreen] Kokoro read-aloud failed:', error);
      // Could be a synthesis failure or a playback failure (AudioService.play()
      // now surfaces real errors instead of hanging silently) -- both land
      // here, so the message stays generic rather than guessing which.
      Alert.alert('Error', 'Read Aloud ran into a problem. Try pressing play again.');
    } finally {
      readAloudActiveRef.current = false;
      setIsPlaying(false);
      setIsLoadingAudio(false);
    }
  };

  const handleReadAloud = async () => {
    if (KokoroTTSService.isSupported()) {
      await playPageWithKokoro();
      return;
    }
    // Native: kokoro-js needs a browser (WASM/WebGPU), so this stays on the
    // Google Cloud engine, which still needs a key configured in Settings.
    if (!TTSService.hasApiKey()) {
      Alert.alert('Setup Required', 'Please configure your Google Cloud TTS API key in settings first.');
      return;
    }

    setIsLoadingAudio(true);
    try {
      const content = getPageContent();
      const audioUrl = await TTSService.synthesize(
        content,
        settings.ttsVoice,
        settings.ttsVoicePitch,
        settings.ttsVoiceRate
      );
      await AudioService.load(audioUrl);
      await AudioService.play();
      setIsPlaying(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate speech');
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handlePause = async () => {
    await AudioService.pause();
    setIsPlaying(false);
  };

  /** The round play/pause button: resumes the current chunk if a Kokoro
   * queue is already in progress, rather than restarting the page from
   * chunk one every time playback is paused and pressed again. */
  const handlePlayPauseReadAloud = async () => {
    if (isPlaying) {
      await handlePause();
      return;
    }
    // Synchronous, before any await: a real click satisfies the browser's
    // "recent user gesture" requirement for audio playback right now, but
    // Kokoro's model-load-then-synthesize chain can easily outlast that
    // window, and by the time the real audio is ready to play the gesture
    // has gone stale -- confirmed live as exactly why Read Aloud would load
    // for a minute and then play nothing. Playing anything (even silence)
    // synchronously here keeps the page "unlocked" for the real audio that
    // follows, however long the async work in between takes.
    if (Platform.OS === 'web') unlockAudioPlayback();
    if (readAloudActiveRef.current) {
      await AudioService.play();
      setIsPlaying(true);
      return;
    }
    await handleReadAloud();
  };

  const handleNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(p + 1, totalPages - 1));
  }, [totalPages]);

  const handlePreviousPage = useCallback(() => {
    setCurrentPage((p) => Math.max(0, p - 1));
  }, []);

  /**
   * Swipe-to-turn: captured at onMoveShouldSetPanResponderCapture so it wins
   * against the page's own vertical ScrollView, but ONLY for drags that are
   * clearly horizontal (2:1 ratio) and already past a small deadzone —
   * anything more vertical than that is left alone so scrolling still works.
   */
  const pageSwipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_evt, gesture) =>
        Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx < -60) handleNextPage();
        else if (gesture.dx > 60) handlePreviousPage();
      },
    })
  ).current;

  /** First page of a given chapter index. Pages are built chapter-by-chapter,
   * so the first page whose chapterIndex matches IS the chapter's opening
   * page — no separate lookup table needed. */
  const goToChapter = useCallback(
    (chapterIndex: number) => {
      const target = pages.findIndex((p) => p.chapterIndex === chapterIndex);
      if (target >= 0) {
        setCurrentPage(target);
        setIsPlaying(false);
      }
    },
    [pages]
  );

  const chapterCount = parsed?.chapters.length ?? 0;
  const currentChapterIndex = page?.chapterIndex ?? 0;
  const handlePreviousChapter = useCallback(() => {
    goToChapter(Math.max(0, currentChapterIndex - 1));
  }, [goToChapter, currentChapterIndex]);
  const handleNextChapter = useCallback(() => {
    goToChapter(Math.min(chapterCount - 1, currentChapterIndex + 1));
  }, [goToChapter, currentChapterIndex, chapterCount]);

  // TableOfContentsScreen sends the chosen chapter back as a route param
  // rather than a prop, since it is a sibling screen in the same stack, not
  // a child — this is the normal RN Navigation way to pass a result back.
  useEffect(() => {
    const target = route?.params?.jumpToChapter;
    if (typeof target === 'number' && pages.length > 0) {
      goToChapter(target);
      navigation.setParams({ jumpToChapter: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.jumpToChapter, pages.length]);

  // Arrow keys turn pages on web — the expected gesture for a desktop reader.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: any) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') handleNextPage();
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') handlePreviousPage();
      if (e.key === 'Escape') setChromeVisible(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNextPage, handlePreviousPage]);

  // Record the sitting when the reader is left, and — separately — write the
  // stopping point back onto the book itself. `currentPage` was local state
  // only: BookDetailsScreen, the Library grid and the Continue Reading card
  // all read Book.currentProgress, so without this write every one of them
  // showed "Page 0" and 0% no matter how far the session actually went.
  const sessionRef = useRef({ bookId: '', page: 0, totalPages: 1 });
  useEffect(() => {
    sessionRef.current = { bookId: currentBook?.id || '', page: safePage, totalPages };
  }, [currentBook?.id, safePage, totalPages]);
  useEffect(() => {
    return () => {
      const { bookId, page: endPage, totalPages: endTotal } = sessionRef.current;
      if (!bookId) return;

      updateBook(bookId, {
        currentProgress: endPage + 1,
        totalPages: endTotal,
        lastReadDate: Date.now(),
      }).catch(() => {});

      const durationMinutes = Math.round((Date.now() - sessionStartTime) / 60000);
      if (durationMinutes < 1) return;
      addReadingSession({
        bookId,
        startTime: sessionStartTime,
        endTime: Date.now(),
        durationMinutes,
        pageStart: 0,
        pageEnd: endPage,
      }).catch(() => {});
    };
  }, []);

  const handleAddBookmark = async () => {
    if (!currentBook) return;
    try {
      await addBookmark({
        bookId: currentBook.id,
        chapter: page?.chapterIndex ?? 0,
        page: safePage,
        progress: (safePage / totalPages) * 100,
        timestamp: Date.now(),
        note: bookmarkNote,
      });
      setBookmarkNote('');
      setShowBookmarkModal(false);
      Alert.alert('Saved', 'Bookmark added');
    } catch (error) {
      Alert.alert('Error', 'Failed to add bookmark');
    }
  };

  const handleLookup = async () => {
    if (!selectedText) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const result = await WikipediaService.lookup(selectedText);
      if (!result) {
        setLookupError('No Wikipedia entry found for this passage.');
      } else {
        setLookupResult(result);
      }
    } catch {
      setLookupError('Could not reach Wikipedia. Check your connection.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleShareAsAudio = async () => {
    if (!selectedText) return;
    // No pre-check here: AudioShareService uses Kokoro on web (no key
    // needed at all) and only requires a Google Cloud key on native, where
    // it throws its own AudioShareError -- caught and surfaced below.
    setIsSharingAudio(true);
    try {
      const result = await AudioShareService.shareAsAudio(selectedText, {
        voice: settings.ttsVoice,
        pitch: settings.ttsVoicePitch,
        rate: settings.ttsVoiceRate,
        title: currentBook?.title,
      });
      setShowHighlightColor(false);
      if (result === 'downloaded') {
        Alert.alert('Downloaded', 'Your browser can\'t hand files to the share sheet directly — the audio file downloaded instead. Attach it to a text/email manually.');
      }
    } catch (error) {
      console.error('[ReaderScreen] Share as audio failed:', error);
      const message = error instanceof AudioShareError ? error.message : 'Could not create the audio file.';
      Alert.alert('Error', message);
    } finally {
      setIsSharingAudio(false);
    }
  };

  /**
   * `color` is a HEX STRING from HIGHLIGHT_SWATCHES and is persisted verbatim
   * on Highlight.color. It must never become a semantic key ('rose', 'sage') —
   * HighlightsScreen filters on the hex, and native cannot paint a keyword.
   */
  const handleHighlight = async (color: string) => {
    if (!selectedText || !currentBook) return;
    try {
      setHighlightColor(color);
      await addHighlight({
        bookId: currentBook.id,
        chapter: page?.chapterIndex ?? 0,
        page: safePage,
        text: selectedText,
        color,
        timestamp: Date.now(),
      });
      setSelectedText('');
      setShowHighlightColor(false);
      Alert.alert('Highlighted', 'Text saved to highlights');
    } catch (error) {
      Alert.alert('Error', 'Failed to highlight');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `"${getPageContent().substring(0, 240).trim()}…" — ${currentBook?.title || ''}`,
        title: currentBook?.title || 'Passage',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  /** Shares selectedText verbatim — exactly what was highlighted, no
   * truncation or page-snippet substitution like handleShare above. */
  const handleShareSelectedText = async () => {
    if (!selectedText) return;
    try {
      await Share.share({
        message: `"${selectedText}" — ${currentBook?.title || ''}`,
        title: currentBook?.title || 'Passage',
      });
      setShowHighlightColor(false);
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  // --------------------------------------------------------- typography ----
  //
  // Declared above the early returns so no hook below is called conditionally.

  // The stored setting is a UI slider value; the reader floors it at a size
  // that is actually comfortable for sustained reading.
  const fontSize = Math.round(Math.min(28, Math.max(17, settings.fontSize + 2)));
  const lineHeight = Math.round(fontSize * Math.min(2.1, Math.max(1.6, settings.lineHeight)));
  const gutter = GUTTERS[settings.marginSize] ?? space.xl;
  const paragraphGap = Math.round(fontSize * 0.8);
  const textAlign = settings.textAlignment === 'justify' ? 'justify' : settings.textAlignment;
  const chapterSize = Math.min(34, Math.max(24, Math.round(fontSize * 1.5)));

  /**
   * The column cap. The gutter lives INSIDE it, so the measure itself stays at
   * MEASURE (~34em, 65–75 characters) whatever margin width the user picked —
   * on a wide screen the margin setting widens the paper, not the line.
   */
  const columnCap = MEASURE + gutter * 2;
  const column = useColumn(columnCap, gutter);

  /**
   * Dead space either side of the column on a desktop viewport. It is the one
   * place a tap target can live without ever covering a word, so that is where
   * the page-turn zones go. On a phone it is 0 and none are rendered.
   */
  const railWidth = Math.min(200, Math.max(0, Math.floor((windowWidth - columnCap) / 2)));
  const showRails = railWidth >= 56;

  const bodyStyle = {
    fontFamily: fonts.reading,
    fontSize,
    lineHeight,
    color: palette.text,
    textAlign: textAlign as any,
    letterSpacing: settings.letterSpacing,
  };

  const chromeStyle = {
    opacity: chromeAnim,
  };

  // -------------------------------------------------------------- states ----

  if (!currentBook) {
    return (
      <Shell background={colors.bg} contentContainerStyle={styles.emptyShell}>
        <View style={styles.emptyState}>
          <View style={styles.emptyOrnament}>
            <View style={[styles.ornamentRule, { backgroundColor: colors.rule }]} />
            <View style={[styles.ornamentDiamond, { borderColor: colors.bronze }]} />
            <View style={[styles.ornamentRule, { backgroundColor: colors.rule }]} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.gold }]}>No manuscript selected</Text>
          <Text style={[styles.emptyBody, { color: colors.inkMuted }]}>
            Choose a volume from your library and it will open here, set in the hand of a book.
          </Text>
        </View>
      </Shell>
    );
  }

  if (!parsed) {
    const coverWidth = Math.min(176, Math.max(120, Math.round(column.width * 0.4)));
    const loadingThisBook = isTextLoading && textLoad.bookId === currentBook.id;
    const failedThisBook = textLoad.status === 'error' && textLoad.bookId === currentBook.id;

    return (
      <Shell background={colors.bg} contentContainerStyle={styles.emptyShell}>
        <View style={styles.emptyState}>
          <BookCover
            uri={currentBook.cover}
            title={currentBook.title}
            author={currentBook.author}
            itemType={currentBook.itemType}
            width={coverWidth}
          />
          <Text style={[styles.emptyTitle, { color: colors.gold, marginTop: space.xl }]}>
            {currentBook.title}
          </Text>

          {loadingThisBook ? (
            <>
              <ActivityIndicator color={colors.gold} style={{ marginBottom: space.md }} />
              <Text style={[styles.emptyBody, { color: colors.inkMuted }]}>
                {currentBook.sourceUrl
                  ? 'Fetching the full edition from the archive…'
                  : 'Restoring the text from this device…'}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.emptyBody, { color: colors.inkMuted }]}>
                {failedThisBook && textLoad.error
                  ? textLoad.error
                  : /**
                     * Reaching here with no error means AppContext found no
                     * source at all — by construction that is now only a
                     * format we cannot extract (PDF/MOBI) or a catalogue
                     * entry with neither a remote edition nor stored local
                     * text. The old copy ("hasn't been downloaded yet…
                     * fetch the full edition") implied a retry would work;
                     * for these cases it never will, so say what is true.
                     */
                    currentBook.fileFormat === 'pdf' || currentBook.fileFormat === 'mobi'
                    ? `Annotated cannot read ${currentBook.fileFormat === 'pdf' ? 'PDF' : 'MOBI/AZW'} text yet — this volume is shelved for reference only. Convert it to EPUB or plain text and import it again to read it here.`
                    : 'This volume has no readable edition yet. Add it again from the catalogue, or import a file with EPUB or plain-text content.'}
              </Text>
              {failedThisBook && (
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    retryTextLoad().catch(() => {});
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.retryLabel}>Try again</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </Shell>
    );
  }

  const pageIndicator = `${safePage + 1} of ${totalPages}`;

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]} {...pageSwipe.panHandlers}>
      {/* ---------------------------------------------------------- page --- */}
      <Shell
        scroll
        scrollRef={scrollRef}
        maxWidth={columnCap}
        gutter={gutter}
        background="transparent"
        tailSpace={0}
        contentContainerStyle={{ paddingTop: HEAD_SPACE, paddingBottom: TAIL_SPACE }}
      >
        <Pressable onPress={toggleChrome} accessibilityLabel="Show reading controls">
          {page?.startsChapter && !!chapterTitle && (
            <View style={styles.chapterOpener}>
              <Text
                style={[
                  styles.chapterTitle,
                  { color: palette.text, fontSize: chapterSize, lineHeight: Math.round(chapterSize * 1.25) },
                ]}
              >
                {chapterTitle}
              </Text>
              <View style={styles.ornament}>
                <View style={[styles.ornamentRule, { backgroundColor: palette.rule }]} />
                <View style={[styles.ornamentDiamond, { borderColor: palette.accentSoft }]} />
                <View style={[styles.ornamentRule, { backgroundColor: palette.rule }]} />
              </View>
            </View>
          )}

          {page?.paragraphs.map((paragraph, i) => (
            <Text
              key={paragraph.index}
              selectable
              onLongPress={() => {
                setSelectedText(paragraph.text);
                setShowHighlightColor(true);
              }}
              style={[
                bodyStyle,
                { marginBottom: i === (page?.paragraphs.length ?? 0) - 1 ? 0 : paragraphGap },
              ]}
            >
              {paragraph.text}
            </Text>
          ))}

          {/* Tail ornament: the eye needs to know the page ended. */}
          <View style={[styles.ornament, { marginTop: space.xxl }]}>
            <View style={[styles.ornamentRule, { backgroundColor: palette.rule }]} />
            <View style={[styles.ornamentDiamond, { borderColor: palette.accentSoft }]} />
            <View style={[styles.ornamentRule, { backgroundColor: palette.rule }]} />
          </View>
        </Pressable>
      </Shell>

      {/* --------------------------------------------------------- rails --- */}
      {/* Desktop only: the empty margin turns the page, so a mouse never has to
          go hunting for chrome that is deliberately hidden. */}
      {showRails && (
        <>
          <Pressable
            style={[styles.rail, { left: 0, width: railWidth }]}
            onPress={handlePreviousPage}
            disabled={safePage === 0}
            accessibilityLabel="Previous page"
          >
            {safePage > 0 && (
              <View style={styles.railGlyph}>
                <ChevronLeftIcon size={22} color={palette.muted} strokeWidth={1.6} />
              </View>
            )}
          </Pressable>
          <Pressable
            style={[styles.rail, { right: 0, width: railWidth }]}
            onPress={handleNextPage}
            disabled={safePage >= totalPages - 1}
            accessibilityLabel="Next page"
          >
            {safePage < totalPages - 1 && (
              <View style={styles.railGlyph}>
                <ChevronRightIcon size={22} color={palette.muted} strokeWidth={1.6} />
              </View>
            )}
          </Pressable>
        </>
      )}

      {/* ------------------------------------------------- quiet indicator --- */}
      {/* "4 of 1049", centred, barely there. The only mark on a bare page. */}
      {!chromeVisible && (
        <View pointerEvents="none" style={styles.quietFolio}>
          <Text style={[styles.folio, { color: palette.muted }]}>{pageIndicator}</Text>
          {isPlaying && (
            <View style={[styles.hairline, { backgroundColor: palette.rule }]}>
              <View
                style={[
                  styles.hairlineFill,
                  {
                    backgroundColor: palette.accent,
                    width: `${playbackState.duration > 0 ? (playbackState.position / playbackState.duration) * 100 : 0}%`,
                  },
                ]}
              />
            </View>
          )}
        </View>
      )}

      {/* -------------------------------------------------------- header --- */}
      <Animated.View
        pointerEvents={chromeVisible ? 'auto' : 'none'}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        style={[
          styles.chromeTop,
          chromeStyle,
          { backgroundColor: palette.surface, borderBottomColor: palette.rule },
        ]}
      >
        <Column maxWidth={columnCap} gutter={gutter}>
          <View style={styles.chromeTopRow}>
            <View style={styles.chromeTitles}>
              {!!chapterTitle && (
                <View style={styles.chapterNavRow}>
                  <TouchableOpacity
                    onPress={handlePreviousChapter}
                    disabled={currentChapterIndex === 0}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    accessibilityLabel="Previous chapter"
                  >
                    <ChevronLeftIcon
                      size={13}
                      color={currentChapterIndex === 0 ? palette.rule : palette.accentSoft}
                      strokeWidth={2}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('TableOfContents')}
                    style={{ flex: 1 }}
                    accessibilityLabel="Open table of contents"
                  >
                    <Text style={[styles.overline, { color: palette.accentSoft }]} numberOfLines={1}>
                      {chapterTitle.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleNextChapter}
                    disabled={currentChapterIndex >= chapterCount - 1}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    accessibilityLabel="Next chapter"
                  >
                    <ChevronRightIcon
                      size={13}
                      color={currentChapterIndex >= chapterCount - 1 ? palette.rule : palette.accentSoft}
                      strokeWidth={2}
                    />
                  </TouchableOpacity>
                </View>
              )}
              <Text style={[styles.bookTitle, { color: palette.accent }]} numberOfLines={1}>
                {currentBook.title}
              </Text>
              <Text style={[styles.meta, { color: palette.muted }]} numberOfLines={1}>
                {currentBook.author ? `${currentBook.author}   ·   ` : ''}
                {minutesLeft > 0 ? `${minutesLeft} min left` : 'Last page'}
                {bookBookmarks > 0 ? `   ·   ${bookBookmarks} marked` : ''}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.iconButton, { borderColor: palette.border }]}
              onPress={() => setShowSearch(true)}
              accessibilityLabel="Search this book"
            >
              <SearchIcon size={16} color={palette.accent} strokeWidth={1.8} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconButton, { borderColor: palette.border }]}
              onPress={() => setShowBookmarkModal(true)}
              accessibilityLabel="Add bookmark"
            >
              <BookmarkIcon size={17} color={palette.accent} strokeWidth={1.7} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.iconButton,
                { borderColor: palette.border, backgroundColor: showMenus ? palette.raised : 'transparent' },
              ]}
              onPress={() => setShowMenus(!showMenus)}
              accessibilityLabel="Reading menu"
            >
              <MenuIcon size={17} color={palette.accent} strokeWidth={1.7} />
            </TouchableOpacity>
          </View>
        </Column>

        {/* Reading progress, as a bound-in ribbon rather than a web progress bar. */}
        <View style={[styles.progressTrack, { backgroundColor: palette.rule }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round(progress * 100)}%`, backgroundColor: palette.accent },
            ]}
          />
        </View>
      </Animated.View>

      {/* ---------------------------------------------------------- menu --- */}
      {chromeVisible && showMenus && (
        <View style={[styles.menuLayer, { top: headerHeight + space.sm }]} pointerEvents="box-none">
          <Column maxWidth={columnCap} gutter={gutter}>
            <View
              style={[
                styles.menu,
                elevation.card,
                { backgroundColor: palette.raised, borderColor: palette.border },
              ]}
            >
              {[
                {
                  label: onPaper ? 'Read in the dark' : 'Read on paper',
                  onPress: () => {
                    updateSettings({ theme: onPaper ? 'dark' : READER_DEFAULTS.theme });
                    setShowMenus(false);
                  },
                },
                {
                  label: settings.pageMode === 'scroll' ? 'Switch to page mode' : 'Switch to scroll mode',
                  onPress: () => {
                    updateSettings({ pageMode: settings.pageMode === 'scroll' ? 'paginated' : 'scroll' });
                    setCurrentPage(0);
                    setShowMenus(false);
                  },
                },
                {
                  label: 'Contents',
                  onPress: () => {
                    setShowMenus(false);
                    navigation.navigate('TableOfContents');
                  },
                },
                {
                  label: 'Highlights',
                  onPress: () => {
                    setShowMenus(false);
                    navigation.navigate('Highlights');
                  },
                },
                { label: 'Share this passage', onPress: () => { setShowMenus(false); handleShare(); } },
                { label: 'Close menu', onPress: () => setShowMenus(false) },
              ].map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={item.onPress}
                  style={[styles.menuItem, i > 0 && { borderTopWidth: 1, borderTopColor: palette.rule }]}
                >
                  <Text style={[styles.menuLabel, { color: palette.accent }]}>{item.label}</Text>
                  <Text style={[styles.menuChevron, { color: palette.accentSoft }]}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Column>
        </View>
      )}

      {/* ------------------------------------------------------ controls --- */}
      <Animated.View
        pointerEvents={chromeVisible ? 'auto' : 'none'}
        style={[
          styles.chromeBottom,
          chromeStyle,
          { backgroundColor: palette.surface, borderTopColor: palette.rule },
        ]}
      >
        <Column maxWidth={columnCap} gutter={gutter}>
          {isPlaying && (
            <View style={styles.audioBar}>
              <View style={[styles.audioTrack, { backgroundColor: palette.rule }]}>
                <View
                  style={[
                    styles.audioFill,
                    {
                      backgroundColor: palette.accent,
                      width: `${playbackState.duration > 0 ? (playbackState.position / playbackState.duration) * 100 : 0}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.audioTime, { color: palette.muted }]}>
                {formatClock(playbackState.position)} / {formatClock(playbackState.duration)}
              </Text>
            </View>
          )}

          <Text style={[styles.folio, styles.folioInChrome, { color: palette.muted }]}>
            {pageIndicator}
          </Text>

          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[
                styles.roundButton,
                { borderColor: palette.border, backgroundColor: palette.raised },
                safePage === 0 && styles.disabled,
              ]}
              onPress={handlePreviousPage}
              disabled={safePage === 0}
              accessibilityLabel="Previous page"
            >
              <ChevronLeftIcon size={19} color={palette.accent} strokeWidth={1.9} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roundButton, { borderColor: palette.border, backgroundColor: palette.raised }]}
              onPress={handlePlayPauseReadAloud}
              disabled={isLoadingAudio}
              accessibilityLabel={isPlaying ? 'Pause reading' : 'Read aloud'}
            >
              {isLoadingAudio ? (
                <ActivityIndicator color={palette.accent} size="small" />
              ) : isPlaying ? (
                <PauseIcon size={17} color={palette.accent} />
              ) : (
                <PlayIcon size={17} color={palette.accent} />
              )}
            </TouchableOpacity>

            {/* The one saturated control on the page: the next thing to do. */}
            <TouchableOpacity
              style={[
                styles.nextButton,
                { backgroundColor: colors.action },
                safePage >= totalPages - 1 && styles.disabled,
              ]}
              onPress={handleNextPage}
              disabled={safePage >= totalPages - 1}
              accessibilityLabel="Next page"
            >
              <Text style={styles.nextLabel}>Next</Text>
              <ChevronRightIcon size={15} color={colors.actionInk} strokeWidth={2.1} />
            </TouchableOpacity>
          </View>
        </Column>
      </Animated.View>

      {/* ------------------------------------------------------ bookmark --- */}
      <Modal visible={showBookmarkModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              elevation.card,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: palette.accent }]}>Add a bookmark</Text>
            <Text style={[styles.modalCaption, { color: palette.muted }]}>
              Page {safePage + 1} of {totalPages}
              {chapterTitle ? ` · ${chapterTitle}` : ''}
            </Text>
            <TextInput
              style={[
                styles.bookmarkInput,
                { color: palette.text, borderColor: palette.border, backgroundColor: palette.bg },
              ]}
              placeholder="A note, if you wish"
              placeholderTextColor={palette.muted}
              value={bookmarkNote}
              onChangeText={setBookmarkNote}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: palette.border }]}
                onPress={() => setShowBookmarkModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: palette.muted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: colors.action }]}
                onPress={handleAddBookmark}
              >
                <Text style={[styles.modalButtonText, { color: colors.actionInk }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ----------------------------------------------------- highlight --- */}
      <Modal visible={showHighlightColor} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              elevation.card,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: palette.accent }]}>Mark this passage</Text>
            <Text style={[styles.modalExcerpt, { color: palette.text }]} numberOfLines={4}>
              {selectedText}
            </Text>
            <View style={styles.swatchRow}>
              {HIGHLIGHT_SWATCHES.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  accessibilityLabel={s.label}
                  style={[
                    styles.swatch,
                    { borderColor: highlightColor === s.value ? palette.accent : palette.border },
                  ]}
                  onPress={() => handleHighlight(s.value)}
                >
                  <View style={[styles.swatchDot, { backgroundColor: s.value }]} />
                  <Text style={[styles.swatchLabel, { color: palette.muted }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Two rows of two rather than four flex:1 buttons crammed into
                one row -- "Share as audio" was wrapping/crowding at
                mobile widths with four-across. Cancel gets its own
                de-emphasized row above the three real actions, so it
                doesn't visually compete with them for the same weight. */}
            <View style={styles.modalCancelRow}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedText('');
                  setShowHighlightColor(false);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.modalCancelText, { color: palette.muted }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: palette.border }]}
                onPress={() => {
                  setShowHighlightColor(false);
                  handleLookup();
                }}
              >
                <Text style={[styles.modalButtonText, { color: palette.accent }]}>Look up</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: palette.border }]}
                onPress={handleShareSelectedText}
              >
                <Text style={[styles.modalButtonText, { color: palette.accent }]}>Share text</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.modalButtons, { marginTop: space.sm }]}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonWide, { borderColor: palette.border }]}
                onPress={handleShareAsAudio}
                disabled={isSharingAudio}
              >
                {isSharingAudio ? (
                  <ActivityIndicator size="small" color={palette.accent} />
                ) : (
                  <Text style={[styles.modalButtonText, { color: palette.accent }]}>Share as audio</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ------------------------------------------------------- look up --- */}
      <Modal
        visible={lookupLoading || !!lookupResult || !!lookupError}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setLookupResult(null);
          setLookupError(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              elevation.card,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            {lookupLoading ? (
              <ActivityIndicator color={palette.accent} />
            ) : lookupError ? (
              <>
                <Text style={[styles.modalTitle, { color: palette.accent }]}>Look up</Text>
                <Text style={[styles.modalCaption, { color: palette.muted }]}>{lookupError}</Text>
              </>
            ) : (
              lookupResult && (
                <>
                  <Text style={[styles.modalTitle, { color: palette.accent }]}>{lookupResult.title}</Text>
                  <Text style={[styles.modalExcerpt, { color: palette.text }]}>{lookupResult.extract}</Text>
                  <Text style={[styles.modalCaption, { color: palette.muted }]}>Source: Wikipedia</Text>
                </>
              )
            )}
            <TouchableOpacity
              style={[styles.modalButton, { borderColor: palette.border, marginTop: space.md }]}
              onPress={() => {
                setLookupResult(null);
                setLookupError(null);
              }}
            >
              <Text style={[styles.modalButtonText, { color: palette.muted }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ---------------------------------------------------------- search --- */}
      <Modal visible={showSearch} transparent animationType="fade" onRequestClose={() => setShowSearch(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              elevation.card,
              styles.searchCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <View style={styles.searchHeader}>
              <SearchIcon size={16} color={palette.muted} strokeWidth={1.8} />
              <TextInput
                style={[styles.searchInput, { color: palette.text }]}
                placeholder="Search this book…"
                placeholderTextColor={palette.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              <TouchableOpacity onPress={() => setShowSearch(false)} accessibilityLabel="Close search">
                <CloseIcon size={16} color={palette.muted} strokeWidth={1.8} />
              </TouchableOpacity>
            </View>

            {searchQuery.trim().length >= 2 && (
              <Text style={[styles.searchCount, { color: palette.muted }]}>
                {searchResults.length}
                {searchResults.length >= 100 ? '+' : ''} match{searchResults.length === 1 ? '' : 'es'}
              </Text>
            )}

            <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
              {searchResults.map((r) => (
                <TouchableOpacity
                  key={r.paragraphIndex}
                  style={[styles.searchResultRow, { borderColor: palette.rule }]}
                  onPress={() => jumpToSearchResult(r.pageIndex)}
                >
                  <Text style={[styles.searchSnippet, { color: palette.text }]} numberOfLines={2}>
                    {r.snippet}
                  </Text>
                  <Text style={[styles.searchPageLabel, { color: palette.muted }]}>
                    Page {r.pageIndex + 1}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // --- chrome --------------------------------------------------------------

  chromeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingTop: space.lg,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  chromeTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingBottom: space.md,
  },
  chromeTitles: { flex: 1, minWidth: 0 },
  chapterNavRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  overline: {
    fontFamily: fonts.ui,
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: space.xs,
  },
  bookTitle: {
    fontFamily: fonts.display,
    fontSize: 19,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  meta: { fontFamily: fonts.ui, fontSize: 12, letterSpacing: 0.3 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  progressTrack: { height: 2, width: '100%' },
  progressFill: { height: '100%' },

  chromeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingTop: space.md,
    paddingBottom: space.lg,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 48,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    flexShrink: 1,
  },
  nextLabel: {
    fontFamily: fonts.ui,
    fontSize: 14,
    letterSpacing: 0.6,
    fontWeight: '600',
    color: colors.actionInk,
  },
  disabled: { opacity: 0.32 },

  // --- page furniture ------------------------------------------------------

  /** "4 of 1049". Quiet, centred, the only mark on an otherwise bare page. */
  quietFolio: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: space.lg,
    alignItems: 'center',
  },
  folio: {
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.8,
    opacity: 0.75,
    textAlign: 'center',
  },
  folioInChrome: { marginBottom: space.md, opacity: 1 },

  hairline: {
    marginTop: space.sm,
    height: 2,
    width: 120,
    borderRadius: 1,
    overflow: 'hidden',
  },
  hairlineFill: { height: '100%' },

  /** Desktop page-turn zones, living in the dead margin beside the column. */
  rail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railGlyph: { opacity: 0.28 },

  chapterOpener: { marginTop: space.lg, marginBottom: space.xxl, alignItems: 'center' },
  chapterTitle: {
    fontFamily: fonts.display,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: space.xl,
  },

  ornament: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md },
  ornamentRule: { height: 1, width: 56 },
  ornamentDiamond: {
    width: 6,
    height: 6,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },

  audioBar: { paddingBottom: space.md },
  audioTrack: { height: 3, borderRadius: 2, overflow: 'hidden', marginBottom: space.sm },
  audioFill: { height: '100%', borderRadius: 2 },
  audioTime: { fontFamily: fonts.ui, fontSize: 12, textAlign: 'center', letterSpacing: 0.6 },

  // --- menu ----------------------------------------------------------------

  menuLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
    alignItems: 'center',
  },
  menu: {
    alignSelf: 'flex-end',
    width: '100%',
    maxWidth: 300,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuLabel: { fontFamily: fonts.ui, fontSize: 14, letterSpacing: 0.3 },
  menuChevron: { fontSize: 16 },

  // --- empty / loading states ---------------------------------------------

  emptyShell: { flexGrow: 1, justifyContent: 'center' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: space.xxxl,
  },
  emptyOrnament: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    marginBottom: space.xl,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: space.md,
  },
  emptyBody: {
    fontFamily: fonts.reading,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 380,
  },
  retryButton: {
    marginTop: space.xl,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.action,
  },
  retryLabel: {
    fontFamily: fonts.ui,
    fontSize: 13,
    letterSpacing: 0.6,
    fontWeight: '600',
    color: colors.actionInk,
  },

  // --- modals --------------------------------------------------------------

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 5, 16, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.xl,
  },
  modalCard: {
    borderRadius: radius.hero,
    borderWidth: 1,
    padding: space.xl,
    width: '100%',
    maxWidth: 420,
  },
  modalTitle: { fontFamily: fonts.display, fontSize: 19, letterSpacing: 0.3, marginBottom: space.xs },
  modalCaption: { fontFamily: fonts.ui, fontSize: 12, letterSpacing: 0.3, marginBottom: space.lg },
  modalExcerpt: {
    fontFamily: fonts.reading,
    fontSize: 15,
    lineHeight: 24,
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  searchCard: { maxHeight: '75%' },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  searchInput: { flex: 1, fontFamily: fonts.ui, fontSize: 15, paddingVertical: space.xs },
  searchCount: { fontFamily: fonts.ui, fontSize: 11, letterSpacing: 0.3, marginBottom: space.sm },
  searchResults: { flexGrow: 0 },
  searchResultRow: { paddingVertical: space.md, borderTopWidth: 1 },
  searchSnippet: { fontFamily: fonts.reading, fontSize: 14, lineHeight: 20 },
  searchPageLabel: { fontFamily: fonts.ui, fontSize: 11, marginTop: space.xs },
  bookmarkInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 88,
    marginBottom: space.lg,
    fontFamily: fonts.reading,
    fontSize: 15,
    lineHeight: 23,
  },
  modalCancelRow: { alignItems: 'flex-end', marginBottom: space.sm },
  modalCancelText: { fontFamily: fonts.ui, fontSize: 12, letterSpacing: 0.6 },
  modalButtons: { flexDirection: 'row', gap: space.md },
  modalButton: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalButtonWide: { flex: undefined, width: '100%' },
  modalButtonPrimary: { borderColor: 'transparent' },
  modalButtonText: { fontFamily: fonts.ui, fontSize: 13, letterSpacing: 0.8 },

  swatchRow: { flexDirection: 'row', gap: space.sm },
  swatch: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
    gap: space.sm,
  },
  swatchDot: { width: 16, height: 16, borderRadius: radius.pill },
  swatchLabel: { fontFamily: fonts.ui, fontSize: 11, letterSpacing: 0.6 },
});
