import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  Pressable,
  ActivityIndicator,
  Animated,
  Share,
  Modal,
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { TTSService } from '../services/TTSService';
import { AudioService, PlaybackState } from '../services/AudioService';
import { unlockAudioPlayback } from '../services/WebSound';
import { GutenbergService, Paragraph } from '../services/GutenbergService';
import BookCover from '../components/BookCover';
import ScaleTouchable from '../components/ScaleTouchable';
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
import { colors, fonts, space, radius, elevation, layout, readerPalettes, HIT_SLOP_MIN } from '../theme';
import { DEFAULT_READER_SETTINGS } from '../types';
import type { ReaderSettings } from '../types';

import { Alert } from '../components/Alert';
import { WikipediaService, WikipediaSummary } from '../services/WikipediaService';
import { AudioShareService, AudioShareError } from '../services/AudioShareService';
import { KokoroTTSService, KOKORO_VOICES, DEFAULT_KOKORO_VOICE, KokoroVoice } from '../services/KokoroTTSService';
import { LattimoreNarrationService } from '../services/LattimoreNarrationService';

/** settings.ttsVoice is shared between the native Google-Cloud voice ID
 * ("en-US-Neural2-C") and Kokoro's own voice IDs ("af_heart") -- same field,
 * different namespace depending on platform (see SettingsScreen). Guards
 * against a stored value from the wrong namespace (or the pre-Kokoro
 * default) being handed to Kokoro, which doesn't know what to do with it. */
function resolveKokoroVoice(stored: string): KokoroVoice {
  return (KOKORO_VOICES.some((v) => v.id === stored) ? stored : DEFAULT_KOKORO_VOICE) as KokoroVoice;
}
import { estimateWordTimings, findActiveWordIndex } from '../services/ReadAloudTiming';

/** '#c9a961' + 0.3 -> '#c9a9614d'. Eight-digit hex is fine on web and native. */
function withAlpha(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const suffix = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${suffix}`;
}
/**
 * The reading surface â€” the most important screen in the app.
 *
 * Everything here serves one goal: a line of text that is comfortable to read
 * for an hour. That means
 *
 *   PAPER      cream ground, near-black serif. A book is not a terminal; dark
 *              is an option the reader offers, not the state it opens in.
 *   MEASURE    ~34em / 660px, centred. Uncapped, a 1365px desktop window ran
 *              the text edge to edge at ~180 characters a line, which is
 *              unreadable â€” the eye cannot find the next line's start.
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
 * pass's to change, so the reader resolves the two itself â€” once â€” and then
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

/** Themes that read as paper â€” used to label the light/dark toggle. */
const PAPER_THEMES = new Set(['light', 'sepia']);

/**
 * Highlight inks. The VALUE is what gets persisted on Highlight.color, so it
 * must be a real colour string and must stay in the canonical set that
 * HighlightsScreen filters by â€” storing a semantic key like 'sage' here makes
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

/** A page is a run of whole paragraphs â€” never a mid-word character slice. */
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

/** One Read-Aloud chunk, tagged with which paragraph(s) (by position in the
 * page's paragraph array) its text came from -- a chunk can span several
 * short paragraphs (merged, see below) or be one piece of a single long
 * paragraph (split, see splitParagraph) -- so this is a many-to-many
 * mapping in general, tracked per-segment to drive word highlighting back
 * to the right paragraph and character offset during playback. */
interface ReadAloudChunk {
  text: string;
  segments: { paragraphIndex: number; chunkOffsetStart: number; chunkOffsetEnd: number }[];
}


function buildReadAloudChunks(paragraphs: string[]): ReadAloudChunk[] {
  const chunks: ReadAloudChunk[] = [];
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
  let bufferText = '';
  let bufferSegments: ReadAloudChunk['segments'] = [];
  const flushBuffer = () => {
    if (bufferText) chunks.push({ text: bufferText, segments: bufferSegments });
    bufferText = '';
    bufferSegments = [];
  };
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const trimmed = paragraph.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_CHUNK_CHARS) {
      flushBuffer();
      // Each piece from splitParagraph becomes its own whole chunk, so the
      // piece's own text *is* the chunk text -- offsets are always [0, piece.length).
      for (const piece of splitParagraph(trimmed)) {
        chunks.push({
          text: piece,
          segments: [{ paragraphIndex, chunkOffsetStart: 0, chunkOffsetEnd: piece.length }],
        });
      }
      return;
    }
    const candidateText = bufferText ? `${bufferText} ${trimmed}` : trimmed;
    if (bufferText && candidateText.length > MAX_CHUNK_CHARS) {
      flushBuffer();
    }
    const segmentStart = bufferText ? bufferText.length + 1 : 0;
    bufferText = bufferText ? `${bufferText} ${trimmed}` : trimmed;
    bufferSegments.push({ paragraphIndex, chunkOffsetStart: segmentStart, chunkOffsetEnd: bufferText.length });
  });
  flushBuffer();
  return chunks;
}

/** Gutenberg footnote reference markers ("Shakespere[1]", "Jove.[76]") were
 * rendering as bare inline digits at full body-text size -- readable but
 * genuinely disruptive mid-sentence. Full footnote linking (parsing the
 * definitions, wherever they're collected, and making the marker tap
 * through to them) is a real feature, not a quick fix; this is the
 * contained improvement that actually addresses the complaint -- rendering
 * markers small and raised like real superscript typography -- without it.
 * Composed with the Read-Aloud word-highlight range (both need to slice the
 * same paragraph text without corrupting each other's offsets), operating
 * on absolute offsets into the ORIGINAL text throughout so the two
 * transforms can't desync. */
const FOOTNOTE_MARKER = /\[\d{1,3}\]/g;

function renderParagraphContent(
  text: string,
  highlight: { start: number; end: number } | null,
  highlightColor: string
): React.ReactNode[] {
  const segments: { text: string; isFootnote: boolean; start: number; end: number }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  FOOTNOTE_MARKER.lastIndex = 0;
  while ((match = FOOTNOTE_MARKER.exec(text))) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), isFootnote: false, start: lastIndex, end: match.index });
    }
    segments.push({ text: match[0], isFootnote: true, start: match.index, end: match.index + match[0].length });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isFootnote: false, start: lastIndex, end: text.length });
  }

  return segments.map((seg, i) => {
    if (seg.isFootnote) {
      return (
        <Text key={i} style={{ fontSize: 10, lineHeight: 14, textAlignVertical: 'top' }}>
          {seg.text}
        </Text>
      );
    }
    if (highlight && highlight.start < seg.end && highlight.end > seg.start) {
      const localStart = Math.max(0, highlight.start - seg.start);
      const localEnd = Math.min(seg.text.length, highlight.end - seg.start);
      return (
        <React.Fragment key={i}>
          {seg.text.slice(0, localStart)}
          <Text style={{ backgroundColor: highlightColor }}>{seg.text.slice(localStart, localEnd)}</Text>
          {seg.text.slice(localEnd)}
        </React.Fragment>
      );
    }
    return <React.Fragment key={i}>{seg.text}</React.Fragment>;
  });
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
  /** Tracks which book's position has been restored, so each book restores once. */
  const restoredInitialPageRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    position: 0,
    duration: 0,
    rate: 1,
  });
  const [chromeVisible, setChromeVisible] = useState(true);
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
  // Read-Aloud's current word, as a character range within one paragraph --
  // null whenever Read Aloud isn't actively speaking a tracked word.
  const [activeHighlight, setActiveHighlight] = useState<{
    paragraphIndex: number;
    start: number;
    end: number;
  } | null>(null);
  const [headerHeight, setHeaderHeight] = useState(92);

  const scrollRef = useRef<ScrollView>(null);

  const palette = readerPalettes[settings.theme] || readerPalettes[READER_DEFAULTS.theme];
  const onPaper = PAPER_THEMES.has(settings.theme);

  /**
   * Publish the reader's defaults to the store once, so the status bar, the
   * Settings previews and the reader are all describing the same page â€” and so
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

  // Read Aloud starting (loading OR already playing) reveals the transport
  // controls itself rather than leaving them hidden behind a tap the reader
  // has no reason to know they need -- confirmed live as a real point of
  // confusion: the play button lives in this same hidden chrome, so with
  // chrome hidden by default there was no visible way to even START Read
  // Aloud without first discovering the tap-to-reveal gesture.
  useEffect(() => {
    if (isPlaying || isLoadingAudio) setChromeVisible(true);
  }, [isPlaying, isLoadingAudio]);

  /**
   * Tap the page to reveal the furniture. On web a click that merely ends a
   * text selection must not count â€” otherwise highlighting a sentence always
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

  /** Page-turn imitation: new content enters with a short slide+fade from
   * the direction of travel (right-to-center going forward, left-to-center
   * going back), like a real page settling into place. Derived from the
   * page-number delta rather than hooked into handleNextPage/handlePreviousPage
   * individually, so it covers every way a page can change -- swipe, button,
   * arrow keys, chapter jump, search-result jump, TOC jump -- without having
   * to patch each call site (the same reasoning already used for stopping
   * Read Aloud on page change, above). Uses transform/opacity only, both
   * native-driver-safe on web, so this never touches the JS thread once
   * started and can't itself cause jank. */
  const prevPageRef = useRef(safePage);
  const pageSlideX = useRef(new Animated.Value(0)).current;
  const pageFade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const prev = prevPageRef.current;
    prevPageRef.current = safePage;
    if (safePage === prev) return;
    const direction = safePage > prev ? 1 : -1;
    pageSlideX.setValue(direction * 28);
    pageFade.setValue(0);
    Animated.parallel([
      Animated.timing(pageSlideX, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(pageFade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [safePage]);

  /**
   * Search across the whole book, client-side over the already-parsed
   * paragraphs â€” no server round trip, works offline. Each hit maps back to
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
      const snippet = `${start > 0 ? 'â€¦' : ''}${paragraph.text.slice(start, idx + q.length + 40).trim()}â€¦`;
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

  // Reset to the opening page whenever a different book is put on the desk
  // -- EXCEPT the very first time, when AppContext has just resumed
  // whenever book was on the desk, that one restores its
  // saved reading position instead of snapping back to page 1.
  // Explicitly stops audio here too, not just via the safePage-keyed effect
  // below: if the previous book happened to also be sitting on page 0,
  // setCurrentPage(0) wouldn't actually change safePage's value, and that
  // effect wouldn't re-fire. Uses restoredInitialPageRef to track which
  // book's position was restored, so a new book always gets position
  // restored (once per book).
  useEffect(() => {
    if (!currentBook) {
      readAloudCancelRef.current = true;
      readAloudActiveRef.current = false;
      AudioService.stop().catch(() => {});
      setCurrentPage(0);
      setIsPlaying(false);
      setChromeVisible(true);
      return;
    }

    if (restoredInitialPageRef.current === currentBook.id) {
      return;
    }

    readAloudCancelRef.current = true;
    readAloudActiveRef.current = false;
    AudioService.stop().catch(() => {});

    const saved = (currentBook.currentProgress || 1) - 1;
    setCurrentPage(Math.max(0, saved));
    restoredInitialPageRef.current = currentBook.id;
    setIsPlaying(false);
    setChromeVisible(true);
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
    if (lattimoreAutoAdvanceRef.current) {
      lattimoreAutoAdvanceRef.current = false;
      return;
    }
    readAloudCancelRef.current = true;
    readAloudActiveRef.current = false;
    AudioService.stop().catch(() => {});
    setIsPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

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
  const highlightTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Set immediately before playPageWithLattimore calls setCurrentPage to
   * follow the narration onto a new page -- the safePage-keyed effect below
   * stops Read Aloud on ANY page change since that's normally a sign the
   * reader navigated away by hand (next/prev, swipe, TOC). Without this
   * distinction, Lattimore's own auto-advance would cancel itself the
   * instant it tried to turn the page. Consumed (reset false) by that
   * effect on the very next run, so a REAL manual navigation right after an
   * auto-advance still stops playback as it should. */
  const lattimoreAutoAdvanceRef = useRef(false);

  const stopHighlightTicker = () => {
    if (highlightTickerRef.current) {
      clearInterval(highlightTickerRef.current);
      highlightTickerRef.current = null;
    }
    setActiveHighlight(null);
  };

  /** Estimated (not measured -- see ReadAloudTiming.ts) per-word highlighting
   * for the chunk currently playing. Polls faster than AudioService's own
   * 500ms status loop (word durations are often shorter than that) via a
   * dedicated one-shot getStatus() call rather than the shared callback, so
   * this doesn't change playback-bar update behavior used elsewhere. */
  const startHighlightTicker = (chunk: ReadAloudChunk, durationMs: number) => {
    stopHighlightTicker();
    const timings = estimateWordTimings(chunk.text, durationMs);
    if (!timings.length) return;
    highlightTickerRef.current = setInterval(async () => {
      const status = await AudioService.getStatus();
      if (!status) return;
      const wordIndex = findActiveWordIndex(timings, status.position);
      if (wordIndex < 0) {
        setActiveHighlight(null);
        return;
      }
      const word = timings[wordIndex];
      const segment = chunk.segments.find(
        (s) => word.charStart >= s.chunkOffsetStart && word.charStart < s.chunkOffsetEnd
      );
      if (!segment) {
        setActiveHighlight(null);
        return;
      }
      setActiveHighlight({
        paragraphIndex: segment.paragraphIndex,
        start: word.charStart - segment.chunkOffsetStart,
        end: Math.min(word.charEnd, segment.chunkOffsetEnd) - segment.chunkOffsetStart,
      });
    }, 80);
  };

  const playPageWithKokoro = async () => {
    const chunks = buildReadAloudChunks(page?.paragraphs.map((p) => p.text) ?? []);
    if (!chunks.length) return;

    readAloudCancelRef.current = false;
    readAloudActiveRef.current = true;
    setIsLoadingAudio(true);
    try {
      const voice = resolveKokoroVoice(settings.ttsVoice);
      let nextChunk: Promise<string> = KokoroTTSService.synthesize(
        chunks[0].text,
        voice,
        settings.ttsVoiceRate
      );
      for (let i = 0; i < chunks.length; i++) {
        if (readAloudCancelRef.current) break;
        const uri = await nextChunk;
        if (readAloudCancelRef.current) break;
        if (i + 1 < chunks.length) {
          // Kick off the next chunk's synthesis now, so it's ready (or
          // close to it) by the time this one finishes playing.
          nextChunk = KokoroTTSService.synthesize(chunks[i + 1].text, voice, settings.ttsVoiceRate);
        }
        setIsLoadingAudio(false);
        await AudioService.load(uri);
        const status = await AudioService.getStatus();
        if (status && status.duration > 0) {
          startHighlightTicker(chunks[i], status.duration);
        }
        const chunkEnded = AudioService.waitForEnd();
        await AudioService.play();
        setIsPlaying(true);
        await chunkEnded;
        stopHighlightTicker();
        // The next chunk's synthesis (kicked off above, in parallel with this
        // chunk's playback) doesn't always finish first -- synthesis is a
        // CPU-bound WASM inference call and can outlast the audio it's
        // replacing, especially for longer chunks. Confirmed live: without
        // this, the transport shows "Pause reading" with a frozen time
        // counter for several seconds between chunks, since nothing signals
        // that the wait for `nextChunk` below is still in flight.
        if (i + 1 < chunks.length) setIsLoadingAudio(true);
      }
    } catch (error) {
      console.error('[ReaderScreen] Kokoro read-aloud failed:', error);
      // Could be a synthesis failure or a playback failure (AudioService.play()
      // now surfaces real errors instead of hanging silently) -- both land
      // here, so the message stays generic rather than guessing which.
      Alert.alert('Error', 'Read Aloud ran into a problem. Try pressing play again.');
    } finally {
      stopHighlightTicker();
      readAloudActiveRef.current = false;
      setIsPlaying(false);
      setIsLoadingAudio(false);
    }
  };

  /** Which rendered page (if any) currently shows a given GLOBAL paragraph
   * index -- the bridge between a narration cue's chapter-relative position
   * and what's actually on screen. -1 if it's on a page not yet reached
   * (shouldn't happen in practice: playPageWithLattimore only starts a
   * chapter's audio once its pages exist). */
  const findPageForParagraph = useCallback(
    (globalIndex: number) => {
      return pages.findIndex((pg) => {
        const first = pg.paragraphs[0]?.index;
        const last = pg.paragraphs[pg.paragraphs.length - 1]?.index;
        return first !== undefined && last !== undefined && globalIndex >= first && globalIndex <= last;
      });
    },
    [pages]
  );

  /**
   * Read Aloud for the one book with a real, professionally narrated,
   * forced-aligned audiobook (the Lattimore Iliad -- see
   * LattimoreNarrationService) instead of Kokoro's live synthesis. Plays
   * real audio from Blob storage; sync is driven by the actual playback
   * position against the pre-computed cue timings, not estimated word
   * durations, and auto-advances both the highlighted paragraph and the
   * visible PAGE as narration moves ahead of what's currently on screen --
   * a whole book's audio spans many paginated pages, unlike Kokoro's
   * one-page-at-a-time chunks.
   */
  const playPageWithLattimore = async (startBookNum: number) => {
    readAloudCancelRef.current = false;
    readAloudActiveRef.current = true;
    setIsLoadingAudio(true);
    try {
      let bookNum = startBookNum;
      while (bookNum <= 24) {
        if (readAloudCancelRef.current) break;
        const audioUrl = LattimoreNarrationService.getAudioUrl(bookNum);
        const cues = LattimoreNarrationService.getCues(bookNum);
        if (!audioUrl || !cues.length) break;

        const chapterIdx = bookNum - 1;
        const chapterStartParagraph = parsed?.chapters[chapterIdx]?.startParagraph ?? 0;

        // Resume from wherever the reader currently is, if that happens to
        // be inside this same chapter; a fresh chapter (auto-advanced from
        // the previous book, or jumped to directly) starts from its top.
        let startSeconds = 0;
        if (page?.chapterIndex === chapterIdx && page.paragraphs.length) {
          const localStart = page.paragraphs[0].index - chapterStartParagraph;
          const startCue = cues.find((c) => c.p >= localStart);
          if (startCue) startSeconds = startCue.s;
        }

        await AudioService.load(audioUrl);
        await AudioService.seek(startSeconds * 1000);
        const chapterEnded = AudioService.waitForEnd();
        await AudioService.play();
        setIsPlaying(true);
        setIsLoadingAudio(false);

        stopHighlightTicker();
        let lastPageShown = -1;
        // Text-based phrase-position highlighting was tried and pulled: even
        // disambiguated, matching a phrase's position from its own text is
        // inherently approximate, and Homer's epic diction leans hard on
        // repeated formulaic lines ("son of Atreus", stock epithets) that
        // make "approximate" occasionally wrong in a way that reads as
        // broken rather than just imprecise. Page tracking below is the
        // reliable part -- built on the same per-paragraph cue mapping, but
        // only needs to know WHICH paragraph is active, not where inside its
        // text, so it isn't exposed to that ambiguity at all.
        highlightTickerRef.current = setInterval(async () => {
          const status = await AudioService.getStatus();
          if (!status) return;
          const cue = LattimoreNarrationService.findActiveCue(cues, status.position / 1000);
          if (!cue) return;
          const globalIdx = chapterStartParagraph + cue.p;
          const targetPage = findPageForParagraph(globalIdx);
          if (targetPage !== -1 && targetPage !== lastPageShown) {
            lastPageShown = targetPage;
            lattimoreAutoAdvanceRef.current = true;
            setCurrentPage(targetPage);
          }
        }, 200);

        await chapterEnded;
        stopHighlightTicker();
        if (readAloudCancelRef.current) break;
        bookNum += 1;
      }
    } catch (error) {
      console.error('[ReaderScreen] Lattimore read-aloud failed:', error);
      Alert.alert('Error', 'Read Aloud ran into a problem. Try pressing play again.');
    } finally {
      stopHighlightTicker();
      readAloudActiveRef.current = false;
      setIsPlaying(false);
      setIsLoadingAudio(false);
    }
  };

  const handleReadAloud = async () => {
    if (currentBook && LattimoreNarrationService.isLattimoreIliad(currentBook)) {
      await playPageWithLattimore((page?.chapterIndex ?? 0) + 1);
      return;
    }
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
    if (Platform.OS === 'web') {
      unlockAudioPlayback();
      // Any leftover text selection (e.g. from highlighting a passage
      // moments earlier) stays visibly selected -- native browser
      // behavior, nothing clears it on its own -- for the entire time
      // Read Aloud is running, which reads as "text highlighting while
      // it's read" even though nothing here is actually driving a
      // highlight off playback position.
      window.getSelection?.()?.removeAllRanges();
    }
    if (readAloudActiveRef.current) {
      await AudioService.play();
      setIsPlaying(true);
      return;
    }
    await handleReadAloud();
  };

  const RATE_STEPS = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3];

  const handleCycleRate = () => {
    const idx = RATE_STEPS.findIndex((r) => Math.abs(r - settings.ttsVoiceRate) < 0.01);
    const next = RATE_STEPS[(idx + 1 + RATE_STEPS.length) % RATE_STEPS.length];
    updateSettings({ ttsVoiceRate: next });
  };

  const handleRestartChunk = () => {
    AudioService.seek(0).catch(() => {});
  };

  /** Advances to the next Read-Aloud chunk immediately, without waiting for
   * the current one to finish. AudioService.stop() resolves the loop's
   * pending waitForEnd() (see AudioService.ts), which is exactly the signal
   * playPageWithKokoro's for-loop needs to move to chunk i+1 -- it does NOT
   * touch readAloudCancelRef, so unlike a real stop this can't end the
   * session, only the current chunk. */
  const handleSkipChunk = () => {
    AudioService.stop().catch(() => {});
  };

  const handleNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(p + 1, totalPages - 1));
  }, [totalPages]);

  const handlePreviousPage = useCallback(() => {
    setCurrentPage((p) => Math.max(0, p - 1));
  }, []);

  /**
   * Swipe-to-turn. PanResponder (RN's built-in gesture responder system)
   * doesn't fire reliably on web -- confirmed live: neither a synthetic
   * touch-event drag nor a mouse-event drag ever triggered
   * onMoveShouldSetPanResponderCapture, on a build where the responder
   * negotiation it depends on apparently never engages in this react-
   * native-web version. Replaced with plain start/end coordinate tracking
   * over real DOM touch AND mouse events instead of PanResponder's capture-
   * phase negotiation -- start position on press, compare against release
   * position, same thresholds as before (60px to commit, 2:1 horizontal-to-
   * vertical ratio so a vertical scroll gesture is never mistaken for a
   * page turn).
   */
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleSwipeStart = useCallback((x: number, y: number) => {
    swipeStartRef.current = { x, y };
  }, []);
  const handleSwipeEnd = useCallback(
    (x: number, y: number) => {
      const start = swipeStartRef.current;
      swipeStartRef.current = null;
      if (!start) return;
      const dx = x - start.x;
      const dy = y - start.y;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
      if (dx < 0) handleNextPage();
      else handlePreviousPage();
    },
    [handleNextPage, handlePreviousPage]
  );
  const swipeHandlers = {
    onTouchStart: (e: any) => {
      const t = e.nativeEvent.touches?.[0];
      if (t) handleSwipeStart(t.pageX, t.pageY);
    },
    onTouchEnd: (e: any) => {
      const t = e.nativeEvent.changedTouches?.[0];
      if (t) handleSwipeEnd(t.pageX, t.pageY);
    },
    // Mouse equivalents for desktop trackpad/mouse drag -- not part of RN's
    // typed ViewProps (web-only), forwarded to the underlying DOM node by
    // react-native-web regardless.
    onMouseDown: (e: any) => handleSwipeStart(e.nativeEvent.clientX, e.nativeEvent.clientY),
    onMouseUp: (e: any) => handleSwipeEnd(e.nativeEvent.clientX, e.nativeEvent.clientY),
  } as any;

  /** First page of a given chapter index. Pages are built chapter-by-chapter,
   * so the first page whose chapterIndex matches IS the chapter's opening
   * page â€” no separate lookup table needed. */
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
  // a child â€” this is the normal RN Navigation way to pass a result back.
  useEffect(() => {
    const target = route?.params?.jumpToChapter;
    if (typeof target === 'number' && pages.length > 0) {
      goToChapter(target);
      navigation.setParams({ jumpToChapter: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.jumpToChapter, pages.length]);

  // Arrow keys turn pages on web â€” the expected gesture for a desktop reader.
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

  // Record the sitting when the reader is left, and â€” separately â€” write the
  // stopping point back onto the book itself. `currentPage` was local state
  // only: BookDetailsScreen, the Library grid and the Continue Reading card
  // all read Book.currentProgress, so without this write every one of them
  // showed "Page 0" and 0% no matter how far the session actually went.
  const sessionRef = useRef({ bookId: '', page: 0, totalPages: 1 });
  useEffect(() => {
    // Same guard as the debounced write below: leaving the reader before the
    // text loaded must not persist the placeholder page 1 / 1 total.
    if (!pages.length) return;
    sessionRef.current = { bookId: currentBook?.id || '', page: safePage, totalPages };
  }, [currentBook?.id, safePage, totalPages, pages.length]);
  // Persist the stopping point on every page turn, debounced, rather than
  // only in the unmount cleanup below. The unmount write is async and has
  // no guarantee of completing before a hard browser reload actually tears
  // the page down -- confirmed live as why position reset to page 1 on
  // reload despite the write "happening". This also fixes BookDetailsScreen
  // and the Library grid showing stale progress for the entire duration of
  // an active reading session, since they only ever saw the unmount write.
  useEffect(() => {
    // `pages.length` is 0 until the text finishes downloading, during which
    // safePage clamps to 0 against the placeholder totalPages of 1. Writing
    // then would persist "page 1" over the reader's real saved position
    // before the restore above has anything to restore against.
    if (!currentBook?.id || !restoredInitialPageRef.current || !pages.length) return;
    const timer = setTimeout(() => {
      updateBook(currentBook.id, {
        currentProgress: safePage + 1,
        totalPages,
        lastReadDate: Date.now(),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [currentBook?.id, safePage, totalPages, pages.length]);
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
        Alert.alert('Downloaded', 'Your browser can\'t hand files to the share sheet directly â€” the audio file downloaded instead. Attach it to a text/email manually.');
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
   * on Highlight.color. It must never become a semantic key ('rose', 'sage') â€”
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
        message: `"${getPageContent().substring(0, 240).trim()}â€¦" â€” ${currentBook?.title || ''}`,
        title: currentBook?.title || 'Passage',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  /** Shares selectedText verbatim â€” exactly what was highlighted, no
   * truncation or page-snippet substitution like handleShare above. */
  const handleShareSelectedText = async () => {
    if (!selectedText) return;
    try {
      await Share.share({
        message: `"${selectedText}" â€” ${currentBook?.title || ''}`,
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
   * MEASURE (~34em, 65â€“75 characters) whatever margin width the user picked â€”
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
                  ? 'Fetching the full edition from the archiveâ€¦'
                  : 'Restoring the text from this deviceâ€¦'}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.emptyBody, { color: colors.inkMuted }]}>
                {failedThisBook && textLoad.error
                  ? textLoad.error
                  : /**
                     * Reaching here with no error means AppContext found no
                     * source at all â€” by construction that is now only a
                     * format we cannot extract (PDF/MOBI) or a catalogue
                     * entry with neither a remote edition nor stored local
                     * text. The old copy ("hasn't been downloaded yetâ€¦
                     * fetch the full edition") implied a retry would work;
                     * for these cases it never will, so say what is true.
                     */
                    currentBook.fileFormat === 'pdf' || currentBook.fileFormat === 'mobi'
                    ? `Annotated cannot read ${currentBook.fileFormat === 'pdf' ? 'PDF' : 'MOBI/AZW'} text yet â€” this volume is shelved for reference only. Convert it to EPUB or plain text and import it again to read it here.`
                    : 'This volume has no readable edition yet. Add it again from the catalogue, or import a file with EPUB or plain-text content.'}
              </Text>
              {failedThisBook && (
                <ScaleTouchable
                  style={styles.retryButton}
                  onPress={() => {
                    retryTextLoad().catch(() => {});
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.retryLabel}>Try again</Text>
                </ScaleTouchable>
              )}
            </>
          )}
        </View>
      </Shell>
    );
  }

  const pageIndicator = `${safePage + 1} of ${totalPages}`;

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]} {...swipeHandlers}>
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
        <Animated.View style={{ transform: [{ translateX: pageSlideX }], opacity: pageFade }}>
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

          {page?.paragraphs.map((paragraph, i) => {
            const wordHighlight = activeHighlight?.paragraphIndex === i ? activeHighlight : null;
            return (
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
                {renderParagraphContent(paragraph.text, wordHighlight, palette.accentSoft)}
              </Text>
            );
          })}

          {/* Tail ornament: the eye needs to know the page ended. */}
          <View style={[styles.ornament, { marginTop: space.xxl }]}>
            <View style={[styles.ornamentRule, { backgroundColor: palette.rule }]} />
            <View style={[styles.ornamentDiamond, { borderColor: palette.accentSoft }]} />
            <View style={[styles.ornamentRule, { backgroundColor: palette.rule }]} />
          </View>
        </Pressable>
        </Animated.View>
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
                  <ScaleTouchable
                    onPress={handlePreviousChapter}
                    disabled={currentChapterIndex === 0}
                    style={styles.hitTarget}
                    accessibilityLabel="Previous chapter"
                  >
                    <ChevronLeftIcon
                      size={13}
                      color={currentChapterIndex === 0 ? palette.rule : palette.accentSoft}
                      strokeWidth={2}
                    />
                  </ScaleTouchable>
                  <ScaleTouchable
                    onPress={() => navigation.navigate('TableOfContents')}
                    style={styles.hitTargetFlex}
                    accessibilityLabel="Open table of contents"
                  >
                    <Text style={[styles.overline, { color: palette.accentSoft }]} numberOfLines={1}>
                      {chapterTitle.toUpperCase()}
                    </Text>
                  </ScaleTouchable>
                  <ScaleTouchable
                    onPress={handleNextChapter}
                    disabled={currentChapterIndex >= chapterCount - 1}
                    style={styles.hitTarget}
                    accessibilityLabel="Next chapter"
                  >
                    <ChevronRightIcon
                      size={13}
                      color={currentChapterIndex >= chapterCount - 1 ? palette.rule : palette.accentSoft}
                      strokeWidth={2}
                    />
                  </ScaleTouchable>
                </View>
              )}
              <Text style={[styles.bookTitle, { color: palette.accent }]} numberOfLines={1}>
                {currentBook.title}
              </Text>
              <Text style={[styles.meta, { color: palette.muted }]} numberOfLines={1}>
                {currentBook.author ? `${currentBook.author}   Â·   ` : ''}
                {minutesLeft > 0 ? `${minutesLeft} min left` : 'Last page'}
                {bookBookmarks > 0 ? `   Â·   ${bookBookmarks} marked` : ''}
              </Text>
            </View>

            <ScaleTouchable
              style={[styles.iconButton, { borderColor: palette.border }]}
              onPress={() => setShowSearch(true)}
              accessibilityLabel="Search this book"
            >
              <SearchIcon size={16} color={palette.accent} strokeWidth={1.8} />
            </ScaleTouchable>

            <ScaleTouchable
              style={[styles.iconButton, { borderColor: palette.border }]}
              onPress={() => setShowBookmarkModal(true)}
              accessibilityLabel="Add bookmark"
            >
              <BookmarkIcon size={17} color={palette.accent} strokeWidth={1.7} />
            </ScaleTouchable>

            <ScaleTouchable
              style={[
                styles.iconButton,
                { borderColor: palette.border, backgroundColor: showMenus ? palette.raised : 'transparent' },
              ]}
              onPress={() => setShowMenus(!showMenus)}
              accessibilityLabel="Reading menu"
            >
              <MenuIcon size={17} color={palette.accent} strokeWidth={1.7} />
            </ScaleTouchable>
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
                <ScaleTouchable
                  key={item.label}
                  onPress={item.onPress}
                  style={[styles.menuItem, i > 0 && { borderTopWidth: 1, borderTopColor: palette.rule }]}
                >
                  <Text style={[styles.menuLabel, { color: palette.accent }]}>{item.label}</Text>
                  <Text style={[styles.menuChevron, { color: palette.accentSoft }]}>â€º</Text>
                </ScaleTouchable>
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
          // Translucent, not a solid panel -- floats over the last line or
          // two of text instead of reading as a bar that ate part of the
          // page. No border: a hard edge on a translucent surface looks like
          // a mistake, not a deliberate seam.
          { backgroundColor: withAlpha(palette.surface, 0.82) },
        ]}
      >
        <Column maxWidth={columnCap} gutter={gutter}>
          {(isPlaying || isLoadingAudio) && (
            <View style={styles.nowPlaying}>
              <View style={styles.nowPlayingHeader}>
                <Text style={[styles.nowPlayingVoice, { color: palette.accent }]} numberOfLines={1}>
                  {isLoadingAudio
                    ? 'Preparing voiceâ€¦'
                    : `${KOKORO_VOICES.find((v) => v.id === resolveKokoroVoice(settings.ttsVoice))?.label ?? 'Read Aloud'}`}
                </Text>
                <ScaleTouchable
                  onPress={handleCycleRate}
                  accessibilityLabel="Change speaking rate"
                  style={styles.hitTarget}
                >
                  <Text style={[styles.rateBadge, { color: palette.muted, borderColor: palette.border }]}>
                    {settings.ttsVoiceRate.toFixed(1)}Ã—
                  </Text>
                </ScaleTouchable>
              </View>

              <View style={styles.audioTrackWrap}>
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
                {playbackState.duration > 0 && (
                  <View
                    style={[
                      styles.audioThumb,
                      {
                        backgroundColor: palette.accent,
                        borderColor: palette.surface,
                        left: `${(playbackState.position / playbackState.duration) * 100}%`,
                      },
                    ]}
                  />
                )}
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
            {isPlaying ? (
              <ScaleTouchable
                style={[styles.roundButton, { borderColor: palette.border, backgroundColor: palette.raised }]}
                onPress={handleRestartChunk}
                accessibilityLabel="Restart this passage"
              >
                <View style={styles.skipGlyph}>
                  <ChevronLeftIcon size={14} color={palette.accent} strokeWidth={2} />
                  <ChevronLeftIcon size={14} color={palette.accent} strokeWidth={2} style={styles.skipGlyphOverlap} />
                </View>
              </ScaleTouchable>
            ) : (
              <ScaleTouchable
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
              </ScaleTouchable>
            )}

            {/* The hero transport control -- filled and larger only while
                actively reading, so it reads as "the media player" rather
                than a third identical round icon button in the row. */}
            <ScaleTouchable
              style={[
                styles.playButton,
                isPlaying
                  ? { backgroundColor: palette.accent, borderColor: palette.accent }
                  : { borderColor: palette.border, backgroundColor: palette.raised },
              ]}
              onPress={handlePlayPauseReadAloud}
              disabled={isLoadingAudio}
              accessibilityLabel={isPlaying ? 'Pause reading' : 'Read aloud'}
            >
              {isLoadingAudio ? (
                <ActivityIndicator color={palette.accent} size="small" />
              ) : isPlaying ? (
                <PauseIcon size={20} color={palette.surface} />
              ) : (
                <PlayIcon size={19} color={palette.accent} />
              )}
            </ScaleTouchable>

            {isPlaying ? (
              <ScaleTouchable
                style={[styles.roundButton, { borderColor: palette.border, backgroundColor: palette.raised }]}
                onPress={handleSkipChunk}
                accessibilityLabel="Skip to next passage"
              >
                <View style={styles.skipGlyph}>
                  <ChevronRightIcon size={14} color={palette.accent} strokeWidth={2} />
                  <ChevronRightIcon size={14} color={palette.accent} strokeWidth={2} style={styles.skipGlyphOverlap} />
                </View>
              </ScaleTouchable>
            ) : (
              /* The one saturated control on the page: the next thing to do. */
              <ScaleTouchable
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
              </ScaleTouchable>
            )}
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
              {chapterTitle ? ` Â· ${chapterTitle}` : ''}
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
              <ScaleTouchable
                style={[styles.modalButton, { borderColor: palette.border }]}
                onPress={() => setShowBookmarkModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: palette.muted }]}>Cancel</Text>
              </ScaleTouchable>
              <ScaleTouchable
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: colors.action }]}
                onPress={handleAddBookmark}
              >
                <Text style={[styles.modalButtonText, { color: colors.actionInk }]}>Save</Text>
              </ScaleTouchable>
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
                <ScaleTouchable
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
                </ScaleTouchable>
              ))}
            </View>
            {/* Two rows of two rather than four flex:1 buttons crammed into
                one row -- "Share as audio" was wrapping/crowding at
                mobile widths with four-across. Cancel gets its own
                de-emphasized row above the three real actions, so it
                doesn't visually compete with them for the same weight. */}
            <View style={styles.modalCancelRow}>
              <ScaleTouchable
                onPress={() => {
                  setSelectedText('');
                  setShowHighlightColor(false);
                }}
                style={styles.hitTarget}
              >
                <Text style={[styles.modalCancelText, { color: palette.muted }]}>Cancel</Text>
              </ScaleTouchable>
            </View>
            <View style={styles.modalButtons}>
              <ScaleTouchable
                style={[styles.modalButton, { borderColor: palette.border }]}
                onPress={() => {
                  setShowHighlightColor(false);
                  handleLookup();
                }}
              >
                <Text style={[styles.modalButtonText, { color: palette.accent }]}>Look up</Text>
              </ScaleTouchable>
              <ScaleTouchable
                style={[styles.modalButton, { borderColor: palette.border }]}
                onPress={handleShareSelectedText}
              >
                <Text style={[styles.modalButtonText, { color: palette.accent }]}>Share text</Text>
              </ScaleTouchable>
            </View>
            <View style={[styles.modalButtons, { marginTop: space.sm }]}>
              <ScaleTouchable
                style={[styles.modalButton, styles.modalButtonWide, { borderColor: palette.border }]}
                onPress={handleShareAsAudio}
                disabled={isSharingAudio}
              >
                {isSharingAudio ? (
                  <ActivityIndicator size="small" color={palette.accent} />
                ) : (
                  <Text style={[styles.modalButtonText, { color: palette.accent }]}>Share as audio</Text>
                )}
              </ScaleTouchable>
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
            <ScaleTouchable
              style={[styles.modalButton, { borderColor: palette.border, marginTop: space.md }]}
              onPress={() => {
                setLookupResult(null);
                setLookupError(null);
              }}
            >
              <Text style={[styles.modalButtonText, { color: palette.muted }]}>Close</Text>
            </ScaleTouchable>
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
                placeholder="Search this bookâ€¦"
                placeholderTextColor={palette.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              <ScaleTouchable onPress={() => setShowSearch(false)} accessibilityLabel="Close search">
                <CloseIcon size={16} color={palette.muted} strokeWidth={1.8} />
              </ScaleTouchable>
            </View>

            {searchQuery.trim().length >= 2 && (
              <Text style={[styles.searchCount, { color: palette.muted }]}>
                {searchResults.length}
                {searchResults.length >= 100 ? '+' : ''} match{searchResults.length === 1 ? '' : 'es'}
              </Text>
            )}

            <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
              {searchResults.map((r) => (
                <ScaleTouchable
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
                </ScaleTouchable>
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
  /** Small glyph/text controls -- the 13px chapter chevrons, the 10px overline
   *  chapter title, the rate badge, the modal Cancel -- measured 13-18px tall.
   *  They carried `hitSlop` instead, which react-native-web honours unreliably.
   *  These give them a real 44px box while the glyph and the type inside stay
   *  exactly the size they were. */
  hitTarget: {
    minHeight: HIT_SLOP_MIN,
    // Width floor too: the chapter chevrons are 13px glyphs, so height alone
    // left them a 13px-wide strip to hit.
    minWidth: HIT_SLOP_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The chapter title fills the row, so it needs the vertical floor only. */
  hitTargetFlex: { flex: 1, minHeight: HIT_SLOP_MIN, justifyContent: 'center' },
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
    width: HIT_SLOP_MIN,
    height: HIT_SLOP_MIN,
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
    paddingTop: space.sm,
    paddingBottom: space.md,
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

  nowPlaying: { paddingBottom: space.md },
  nowPlayingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  nowPlayingVoice: {
    fontFamily: fonts.ui,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  rateBadge: {
    fontFamily: fonts.ui,
    fontSize: 12,
    letterSpacing: 0.3,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  audioTrackWrap: { position: 'relative', justifyContent: 'center', marginBottom: space.sm },
  audioTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  audioFill: { height: '100%', borderRadius: 2 },
  audioThumb: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    marginLeft: -5.5,
    elevation: 2,
  },
  audioTime: { fontFamily: fonts.ui, fontSize: 12, textAlign: 'center', letterSpacing: 0.6 },

  playButton: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipGlyph: { flexDirection: 'row', alignItems: 'center' },
  skipGlyphOverlap: { marginLeft: -9 },

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
