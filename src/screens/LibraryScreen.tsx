// LibraryScreen — the app's home.
//
// Rebuilt against the owner's reference apps. Four structural changes:
//
// 1. <Shell>. This screen was the worst full-bleed offender: with no cap, the
//    four sort/view buttons were `flex: 1` inside a 1365px row, so each one
//    rendered ~340–640px wide. Everything now lives in the centred phone-width
//    column, and every cover size is computed from `useColumnWidth()` rather
//    than from `Dimensions.get('window')`.
//
// 2. A HERO "Continue Reading" card. The signature move of every reference: a
//    large cover, the title, a progress bar, "page X of Y", and the screen's
//    ONE saturated action-coloured CTA. It is a panel, not a list row.
//
// 3. A <Carousel> of recent volumes under it, then the shelf itself with
//    covers at 84–150px instead of the old 58px postage stamps.
//
// 4. An empty state that shows books rather than a lone ✦ glyph.
//
// The import flow — pickFile → importFile → the ImportStatus banner, its
// phases, its percentages and its dismissal timing — is carried over verbatim.
// It is the only honest feedback channel on web (react-native-web does not
// implement Alert.alert) and nothing here changes its behaviour.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Text,
  TextInput,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { EbookService } from '../services/EbookService';
import type { PickedFile } from '../services/EbookService';
import { Book } from '../types';
import BookCover from '../components/BookCover';
import ScaleTouchable from '../components/ScaleTouchable';
import Shell, { useColumnWidth } from '../components/Shell';
import Section from '../components/Section';
import Carousel from '../components/Carousel';
import {
  PlusIcon,
  SearchIcon,
  CloseIcon,
  CollectionsIcon,
  MenuIcon,
  PlayIcon,
  ChevronRightIcon,
  DownloadIcon,
} from '../components/icons';
import { colors, type as t, space, radius, elevation, layout, HIT_SLOP_MIN, arch } from '../theme';
import LeafButton from '../components/LeafButton';
import { OrnamentRule } from '../components/Ornament';
import { Banner, BannerHeading } from '../components/Banner';

/**
 * How many imported books get their full text restored automatically on
 * arrival. Each one is potentially megabytes of string held in memory, so the
 * rest are restored on tap instead (see `openDetails`). Recently-read books
 * come first, which is what the shelf is sorted by anyway.
 */
const MAX_AUTO_HYDRATE = 6;

/** Success messages clear themselves; problems wait to be acknowledged. */
const SUCCESS_DISMISS_MS = 6000;

/** Most recent volumes shown in the carousel. */
const MAX_RECENT = 12;

type ImportPhase = 'idle' | 'working' | 'success' | 'partial' | 'error';

/**
 * The one place import feedback lives.
 *
 * It replaces Alert.alert(), which react-native-web does not implement — on
 * the web build those alerts were invisible, so a failed import looked
 * identical to nothing happening at all.
 */
interface ImportStatus {
  phase: ImportPhase;
  /** Headline. */
  title: string;
  /** The honest specifics: file name, real error text, real warning. */
  detail?: string;
  /** Optional second line — what to do about it. */
  hint?: string;
  /** 0-100, reflecting actual bytes read and sections extracted. */
  percent: number;
  /** Current stage, e.g. "Extracting text — section 4 of 31". */
  stageLabel?: string;
  /**
   * Set when this status is about one shelved volume (opening it, restoring
   * or downloading its text) rather than about an incoming file. It is what
   * lets the hero CTA spin for its OWN book and stay still for an import
   * running elsewhere on the screen.
   */
  bookId?: string;
}

const IDLE: ImportStatus = { phase: 'idle', title: '', percent: 0 };

const PHASE_ACCENT: Record<Exclude<ImportPhase, 'idle'>, string> = {
  working: colors.gold,
  success: colors.success,
  partial: colors.goldBright,
  error: colors.danger,
};

const PHASE_GLYPH: Record<Exclude<ImportPhase, 'idle'>, string> = {
  working: '✦',
  success: '✓',
  partial: '◈',
  error: '✕',
};

const SORTS: Array<{ key: 'recent' | 'title' | 'author'; label: string }> = [
  { key: 'recent', label: 'Recent' },
  { key: 'title', label: 'Title' },
  { key: 'author', label: 'Author' },
];

/** The three ghost spines drawn on the empty shelf. Never a lone glyph. */
const EMPTY_SHELF: Array<{ title: string; author: string; tilt: string }> = [
  { title: 'Confessions', author: 'Augustine', tilt: '-7deg' },
  { title: 'The Iliad', author: 'Homer', tilt: '0deg' },
  { title: 'Consolation', author: 'Boethius', tilt: '7deg' },
];

/** CC0, no attribution required -- credited anyway as good practice (see
 * SettingsScreen's HERITAGE_IMAGES for the full curated set and license
 * notes; this is the same source, upload.wikimedia.org, the app already
 * pulls classical-library cover art from). The empty library is the first
 * thing a brand-new reader sees, before they've added a single book --
 * highest-visibility moment in the app for the classical/Byzantine framing
 * to actually be felt rather than just claimed in copy. */
const EMPTY_STATE_BACKDROP = {
  uri: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/Interior_of_the_Hagia_Sophia_Grand_Mosque%2C_Istanbul_%2853808370434%29.jpg',
  credit: 'Hagia Sophia, Constantinople',
};

/** '#c9a961' + 0.3 -> '#c9a9614d'. Eight-digit hex is fine on web and native. */
function withAlpha(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const suffix = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${suffix}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** `addedDate` is a string on imports and a number on catalogue entries. */
function toMillis(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function progressPercent(book: Book): number {
  if (!book.totalPages || book.totalPages <= 0) return 0;
  return clamp((book.currentProgress / book.totalPages) * 100, 0, 100);
}

export default function LibraryScreen({ navigation }: any) {
  const {
    books,
    addBook,
    updateBook,
    setCurrentBook,
    openBook: openBookText,
    clearTextError,
  } = useApp();

  // THE fix: content width comes from the capped column, never the window.
  //
  // The page gutter is applied by the FlatList's contentContainerStyle rather
  // than by <Shell>, so the scroller's clip box is the FULL column: a vertical
  // ScrollView compiles to `overflow-x: hidden` on web, and if the gutter sat
  // outside the scroller that clip would land exactly on the covers' edges and
  // shear the drop shadow off the outer grid column and off the carousel — the
  // same defect Carousel.tsx documents at length. Clipping at the padding box
  // instead means the shadows have the gutter to spill into.
  //
  // `useColumnWidth(undefined, layout.gutter)` therefore measures the column
  // WITH the gutter subtracted, even though the Shell itself applies none.
  const col = useColumnWidth(undefined, layout.gutter);

  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'author'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [importStatus, setImportStatus] = useState<ImportStatus>(IDLE);

  const isBusy = importStatus.phase === 'working';
  const searching = searchText.trim().length > 0;

  /* ------------------------------------------------------------- sizing */

  // Covers are the hero object, so they are sized as a fraction of the column
  // and only then clamped — a phone gets proportionally the same layout as a
  // desktop, because the desktop is running the same 480px column.
  const heroCoverW = clamp(Math.round(col * 0.3), 92, 136);
  const carouselItemW = clamp(Math.round(col * 0.33), 104, 148);
  const listCoverW = clamp(Math.round(col * 0.19), 70, 88);

  const gridCols = col >= 380 ? 3 : 2;
  const gridGap = space.md;
  const gridCellW = Math.floor((col - gridGap * (gridCols - 1)) / gridCols);

  /* ------------------------------------------------------------ shelving */

  const filteredBooks = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    const filtered = books.filter(
      b =>
        !needle ||
        b.title.toLowerCase().includes(needle) ||
        (b.author?.toLowerCase().includes(needle) ?? false)
    );

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'author':
          return (a.author || '').localeCompare(b.author || '');
        case 'recent':
        default:
          return (b.lastReadDate || 0) - (a.lastReadDate || 0);
      }
    });

    return sorted;
  }, [books, searchText, sortBy]);

  /** The volume the hero card offers. Most recently opened, still unfinished. */
  const heroBook = useMemo(() => {
    const inProgress = books.filter(
      b =>
        !b.isFinished &&
        b.itemType !== 'music' &&
        b.itemType !== 'art' &&
        (b.currentProgress > 0 || !!b.lastReadDate)
    );
    if (inProgress.length === 0) return null;
    return inProgress.sort((a, b) => (b.lastReadDate || 0) - (a.lastReadDate || 0))[0];
  }, [books]);

  const recentBooks = useMemo(() => {
    const rest = books.filter(b => b.id !== heroBook?.id);
    rest.sort(
      (a, b) =>
        (b.lastReadDate || 0) - (a.lastReadDate || 0) ||
        toMillis(b.addedDate) - toMillis(a.addedDate)
    );
    return rest.slice(0, MAX_RECENT);
  }, [books, heroBook]);

  const anyRead = recentBooks.some(b => !!b.lastReadDate);

  const inProgressCount = books.filter(b => b.currentProgress > 0 && !b.isFinished).length;

  /* ------------------------------------------------------------- rehydrate */

  /**
   * `Book.content` is never persisted (it would blow the localStorage quota),
   * and an imported local file has no `sourceUrl` to re-fetch from — so after
   * a reload its text lives only in the store EbookService wrote it to. Pull
   * it back, one book per pass so a shelf of imports cannot stall the UI.
   */
  const hydrationAttempts = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (hydrationAttempts.current.size >= MAX_AUTO_HYDRATE) return;

    const pending = books
      .filter(b => !b.content && !hydrationAttempts.current.has(b.id) && EbookService.hasStoredText(b))
      .sort((a, b) => (b.lastReadDate || 0) - (a.lastReadDate || 0))[0];

    if (!pending) return;
    hydrationAttempts.current.add(pending.id);

    let cancelled = false;
    (async () => {
      const text = await EbookService.loadStoredText(pending);
      if (cancelled || !text) return;
      await updateBook(pending.id, { content: text });
    })();

    return () => {
      cancelled = true;
    };
  }, [books]);

  /** A download outlives a fast tab switch; never navigate after leaving. */
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ---------------------------------------------------------------- import */

  useEffect(() => {
    if (importStatus.phase !== 'success') return;
    const timer = setTimeout(() => setImportStatus(IDLE), SUCCESS_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [importStatus]);

  const handleUploadBook = async () => {
    if (isBusy) return;

    setImportStatus({
      phase: 'working',
      title: 'Choose a file',
      detail: 'EPUB, TXT, PDF, MOBI or AZW3',
      percent: 0,
      stageLabel: 'Waiting for you',
    });

    let picked: PickedFile | null = null;
    try {
      // Must be the first await: browsers only open a file dialog while the
      // user's tap is still the active gesture.
      picked = await EbookService.pickFile();
    } catch (error) {
      const described = EbookService.describeError(error);
      setImportStatus({
        phase: 'error',
        title: 'Could not open the file picker',
        detail: described.message,
        hint: described.hint,
        percent: 0,
      });
      return;
    }

    if (!picked) {
      setImportStatus(IDLE);
      return;
    }

    const fileName = picked.name;
    setImportStatus({
      phase: 'working',
      title: 'Importing',
      detail: fileName,
      percent: 2,
      stageLabel: 'Reading file',
    });

    try {
      const { book, warning } = await EbookService.importFile(picked, progress => {
        setImportStatus({
          phase: 'working',
          title: 'Importing',
          detail: fileName,
          percent: progress.percent,
          stageLabel: progress.label,
        });
      });

      await addBook(book);

      if (warning) {
        setImportStatus({
          phase: 'partial',
          title: 'Added, but not readable yet',
          detail: warning,
          percent: 100,
        });
        return;
      }

      const size = book.fileSize ? ` · ${EbookService.getReadableFileSize(book.fileSize)}` : '';
      setImportStatus({
        phase: 'success',
        title: `“${book.title}” is on the shelf`,
        detail: `${book.totalPages} pages${size}${book.author ? ` · ${book.author}` : ''}`,
        percent: 100,
      });
    } catch (error) {
      const described = EbookService.describeError(error);
      console.error('[LibraryScreen] Import failed:', error);
      setImportStatus({
        phase: 'error',
        title: `Could not import “${fileName}”`,
        detail: described.message,
        hint: described.hint,
        percent: 0,
      });
    }
  };

  /* ----------------------------------------------------------- navigation */

  /**
   * Open a book's page, restoring an imported book's text first if this
   * session has not loaded it yet. Navigation happens either way — the details
   * screen is still worth showing when the text is gone.
   */
  const openDetails = async (book: Book) => {
    if (book.content || !EbookService.hasStoredText(book)) {
      navigation.navigate('BookDetails', { bookId: book.id });
      return;
    }

    setImportStatus({
      phase: 'working',
      title: 'Opening',
      detail: book.title,
      bookId: book.id,
      percent: 40,
      stageLabel: 'Restoring text',
    });

    const text = await EbookService.loadStoredText(book);
    hydrationAttempts.current.add(book.id);

    if (text) {
      await updateBook(book.id, { content: text });
      setImportStatus(IDLE);
    } else {
      setImportStatus({
        phase: 'error',
        title: `The text of “${book.title}” is no longer stored`,
        detail: 'Imported files are kept in this browser only, so clearing site data removes them.',
        hint: 'Import the file again to read it here.',
        percent: 0,
      });
    }

    if (!mountedRef.current) return;
    navigation.navigate('BookDetails', { bookId: book.id });
  };

  const goToReader = () => navigation.navigate('Reading', { screen: 'ReaderHome' });

  /**
   * The hero CTA. Straight onto the page the reader left off at, restoring or
   * downloading the text on the way — the same three routes BookDetails takes,
   * reported through the same banner so there is never a silent wait.
   */
  const handleContinue = async (book: Book) => {
    if (isBusy) return;

    if (book.itemType === 'music' || book.itemType === 'art') {
      navigation.navigate('BookDetails', { bookId: book.id });
      return;
    }

    // Already in hand.
    if (book.content) {
      setCurrentBook(book);
      goToReader();
      return;
    }

    // An import: its text lives in this browser's store, not on the network.
    if (EbookService.hasStoredText(book)) {
      setImportStatus({
        phase: 'working',
        title: 'Opening',
        detail: book.title,
        bookId: book.id,
        percent:40,
        stageLabel: 'Restoring text',
      });

      const text = await EbookService.loadStoredText(book);
      hydrationAttempts.current.add(book.id);
      if (!mountedRef.current) return;

      if (text) {
        await updateBook(book.id, { content: text });
        setCurrentBook({ ...book, content: text });
        setImportStatus(IDLE);
        goToReader();
        return;
      }

      setImportStatus({
        phase: 'error',
        title: `The text of “${book.title}” is no longer stored`,
        detail: 'Imported files are kept in this browser only, so clearing site data removes them.',
        hint: 'Import the file again to read it here.',
        percent: 0,
      });
      return;
    }

    // A catalogue edition: ~1MB over the wire. openBook reports its own
    // failures through textLoad and never rejects.
    if (book.sourceUrl) {
      clearTextError();
      setImportStatus({
        phase: 'working',
        title: 'Opening',
        detail: book.title,
        bookId: book.id,
        percent:35,
        stageLabel: 'Downloading the edition',
      });

      const loaded = await openBookText(book).catch(() => book);
      if (!mountedRef.current) return;

      if (loaded.content) {
        setImportStatus(IDLE);
        goToReader();
        return;
      }

      setImportStatus({
        phase: 'error',
        title: `Could not open “${book.title}”`,
        detail: 'The full text could not be downloaded.',
        hint: 'Check the connection and try again from the book’s page.',
        percent: 0,
      });
      return;
    }

    navigation.navigate('BookDetails', { bookId: book.id });
  };

  /* ------------------------------------------------------------------- ui */

  const getItemTypeMeta = (book: Book) => {
    if (book.itemType === 'music') return `${book.author} • Composition`;
    if (book.itemType === 'art') return `${book.author} • Artwork`;
    if (book.itemType === 'resource') return 'Reference • Study Material';
    if (book.totalPages > 0) {
      const size = book.fileSize ? ` • ${EbookService.getReadableFileSize(book.fileSize)}` : '';
      return `${book.totalPages} pages${size}`;
    }
    if (book.fileFormat === 'pdf' || book.fileFormat === 'mobi') {
      return `${book.fileFormat.toUpperCase()} • text not extracted`;
    }
    return book.fileSize ? EbookService.getReadableFileSize(book.fileSize) : 'Not yet paginated';
  };

  // Plain render functions, not nested components: a nested component is a new
  // type on every render, so React would tear down and rebuild the banner and
  // every visible card on each progress tick (~30 per import).
  const renderImportBanner = () => {
    if (importStatus.phase === 'idle') return null;

    const phase = importStatus.phase;
    const accent = PHASE_ACCENT[phase];
    const isWorking = phase === 'working';

    return (
      <View
        style={[
          styles.banner,
          { borderColor: withAlpha(accent, 0.4), backgroundColor: colors.surface },
        ]}
      >
        <View style={styles.bannerRow}>
          <View style={styles.bannerGlyphWrap}>
            {isWorking ? (
              <ActivityIndicator size="small" color={accent} />
            ) : (
              <Text style={[styles.bannerGlyph, { color: accent }]}>{PHASE_GLYPH[phase]}</Text>
            )}
          </View>

          <View style={styles.bannerBody}>
            <Text style={[styles.bannerTitle, { color: accent }]} numberOfLines={2}>
              {importStatus.title}
            </Text>
            {!!importStatus.detail && (
              <Text style={styles.bannerDetail} numberOfLines={4}>
                {importStatus.detail}
              </Text>
            )}
            {!!importStatus.hint && <Text style={styles.bannerHint}>{importStatus.hint}</Text>}
          </View>

          {!isWorking && (
            <ScaleTouchable
              style={styles.bannerClose}
              onPress={() => setImportStatus(IDLE)}
              accessibilityLabel="Dismiss"
            >
              <Text style={styles.bannerCloseText}>×</Text>
            </ScaleTouchable>
          )}
        </View>

        {isWorking && (
          <View style={styles.bannerProgress}>
            <View style={styles.importTrack}>
              <View
                style={[
                  styles.importFill,
                  { width: `${Math.max(2, importStatus.percent)}%`, backgroundColor: accent },
                ]}
              />
            </View>
            <Text style={styles.bannerStage}>
              {importStatus.stageLabel} · {importStatus.percent}%
            </Text>
          </View>
        )}

        {phase === 'error' && (
          <ScaleTouchable
            style={[styles.bannerAction, { borderColor: withAlpha(accent, 0.5) }]}
            onPress={handleUploadBook}
          >
            <Text style={[styles.bannerActionText, { color: accent }]}>Try another file</Text>
          </ScaleTouchable>
        )}
      </View>
    );
  };

  /**
   * The hero. Deliberately two sibling touch targets rather than one nested
   * inside the other: the panel opens the book's page, the CTA goes straight
   * to the reader, and neither swallows the other's press.
   */
  const renderHero = (book: Book) => {
    const pct = progressPercent(book);
    const started = book.currentProgress > 0;
    const page = book.totalPages > 0 ? clamp(book.currentProgress, 0, book.totalPages) : 0;
    /** Spin for THIS volume only — an import running above must not spin here. */
    const opening = isBusy && importStatus.bookId === book.id;

    return (
      <View style={styles.hero}>
        <ScaleTouchable
          style={styles.heroRow}
          activeOpacity={0.85}
          onPress={() => openDetails(book)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${book.title}`}
        >
          <BookCover
            uri={book.cover}
            title={book.title}
            author={book.author}
            itemType={book.itemType}
            width={heroCoverW}
            compact
          />

          <View style={styles.heroBody}>
            <Text style={styles.heroKicker}>
              {started ? 'CONTINUE READING' : 'UP NEXT'}
            </Text>
            <Text style={styles.heroTitle} numberOfLines={3}>
              {book.title}
            </Text>
            {!!book.author && (
              <Text style={styles.heroAuthor} numberOfLines={1}>
                {book.author}
              </Text>
            )}

            <View style={styles.heroFoot}>
              <View style={styles.heroTrack}>
                <View style={[styles.heroFill, { width: `${Math.max(1.5, pct)}%` }]} />
              </View>
              <Text style={styles.heroMeta}>
                {book.totalPages > 0
                  ? `${page} of ${book.totalPages}  ·  ${Math.round(pct)}%`
                  : 'Not yet paginated'}
              </Text>
            </View>
          </View>
        </ScaleTouchable>

        {/* The single accent on this screen. Nothing else may be this colour. */}
        <LeafButton
          label={started ? 'Continue Reading' : 'Begin Reading'}
          onPress={() => handleContinue(book)}
          disabled={isBusy}
          style={styles.cta}
          accessibilityLabel={started ? `Continue reading ${book.title}` : `Begin ${book.title}`}
        >
          {opening ? (
            <ActivityIndicator size="small" color={colors.actionInk} />
          ) : (
            <PlayIcon size={14} color={colors.actionInk} />
          )}
        </LeafButton>
      </View>
    );
  };

  /** Carousel cell: the cover IS the card, with the caption beneath it. */
  const renderCarouselItem = (book: Book) => {
    const pct = progressPercent(book);
    return (
      <ScaleTouchable
        activeOpacity={0.85}
        onPress={() => openDetails(book)}
        accessibilityRole="button"
        accessibilityLabel={book.title}
      >
        <BookCover
          uri={book.cover}
          title={book.title}
          author={book.author}
          itemType={book.itemType}
          width={carouselItemW}
          compact
        />
        <Text style={styles.cellTitle} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={styles.cellAuthor} numberOfLines={1}>
          {book.author || '—'}
        </Text>
        {pct > 0 && (
          <View style={styles.cellTrack}>
            <View style={[styles.cellFill, { width: `${pct}%` }]} />
          </View>
        )}
      </ScaleTouchable>
    );
  };

  const renderGridCard = (book: Book, index: number) => {
    const pct = progressPercent(book);
    const isLastInRow = index % gridCols === gridCols - 1;

    return (
      <ScaleTouchable
        style={[styles.gridCell, { width: gridCellW }, !isLastInRow && { marginRight: gridGap }]}
        activeOpacity={0.85}
        onPress={() => openDetails(book)}
        accessibilityRole="button"
        accessibilityLabel={book.title}
      >
        <BookCover
          uri={book.cover}
          title={book.title}
          author={book.author}
          itemType={book.itemType}
          width={gridCellW}
          compact
        />
        <Text style={styles.cellTitle} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={styles.cellAuthor} numberOfLines={1}>
          {book.author || '—'}
        </Text>
        {pct > 0 ? (
          <View style={styles.cellTrack}>
            <View style={[styles.cellFill, { width: `${pct}%` }]} />
          </View>
        ) : (
          book.itemType &&
          book.itemType !== 'book' && (
            <Text style={styles.cellTag}>
              {book.itemType === 'music' ? 'MUSIC' : book.itemType === 'art' ? 'ART' : 'RESOURCE'}
            </Text>
          )
        )}
      </ScaleTouchable>
    );
  };

  const renderListRow = (book: Book) => {
    const pct = progressPercent(book);

    return (
      <ScaleTouchable
        style={styles.listCard}
        activeOpacity={0.85}
        onPress={() => openDetails(book)}
        accessibilityRole="button"
        accessibilityLabel={book.title}
      >
        <BookCover
          uri={book.cover}
          title={book.title}
          author={book.author}
          itemType={book.itemType}
          width={listCoverW}
          compact
        />

        <View style={styles.listInfo}>
          <Text style={styles.listTitle} numberOfLines={2}>
            {book.title}
          </Text>
          <Text style={styles.listAuthor} numberOfLines={1}>
            {book.author || '—'}
          </Text>
          <Text style={styles.listMeta} numberOfLines={1}>
            {getItemTypeMeta(book)}
          </Text>

          {book.totalPages > 0 && (
            <>
              <View style={styles.cellTrack}>
                <View style={[styles.cellFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.listProgress}>
                {pct > 0 ? `Page ${clamp(book.currentProgress, 0, book.totalPages)} · ${Math.round(pct)}%` : 'Not started'}
              </Text>
            </>
          )}
        </View>

        <View style={styles.listChevron}>
          <ChevronRightIcon size={15} color={colors.bronze} strokeWidth={2} />
        </View>
      </ScaleTouchable>
    );
  };

  const renderEmpty = () => {
    if (books.length > 0) {
      // The shelf has books; this search simply found none of them.
      return (
        <View style={styles.empty}>
          <SearchIcon size={30} color={colors.bronze} strokeWidth={1.6} />
          <Text style={styles.emptyTitle}>Nothing by that name</Text>
          <Text style={styles.emptyBody}>
            No volume in your library matches “{searchText.trim()}”.
          </Text>
          <ScaleTouchable style={styles.ghostButton} onPress={() => setSearchText('')}>
            <Text style={styles.ghostButtonText}>Clear search</Text>
          </ScaleTouchable>
        </View>
      );
    }

    return (
      <ImageBackground
        source={{ uri: EMPTY_STATE_BACKDROP.uri }}
        style={styles.empty}
        imageStyle={styles.emptyBgImage}
      >
        <View style={styles.emptyBgOverlay} pointerEvents="none" />
        <View style={styles.emptyShelf}>
          {EMPTY_SHELF.map(spine => (
            <View
              key={spine.title}
              style={[styles.emptySpine, { transform: [{ rotate: spine.tilt }] }]}
              pointerEvents="none"
            >
              <BookCover title={spine.title} author={spine.author} width={62} />
            </View>
          ))}
        </View>

        <OrnamentRule
          mark="fleuron"
          color={colors.rule}
          markColor={colors.rubric}
          style={styles.emptyRule}
        />
        <Text style={styles.emptyTitle}>Your Library Awaits</Text>
        <Text style={styles.emptyBody}>
          Bring a manuscript in from this device, or add one from the classical catalogue.
        </Text>
        <Text style={styles.emptyBgCredit}>{EMPTY_STATE_BACKDROP.credit}</Text>

        {/* With no book in progress there is no hero, so THIS is the screen's
            single action and it carries the accent. */}
        <LeafButton
          label="Import a file"
          onPress={handleUploadBook}
          disabled={isBusy}
          style={[styles.cta, styles.emptyCta]}
          accessibilityLabel="Import a book from this device"
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={colors.actionInk} />
          ) : (
            <PlusIcon size={14} color={colors.actionInk} strokeWidth={2.2} />
          )}
        </LeafButton>

        <Text style={styles.emptyFootnote}>
          EPUB and TXT are read in full. PDF and MOBI can be shelved, but their text cannot be
          extracted yet.
        </Text>
      </ImageBackground>
    );
  };

  const shelfSubtitle = () => {
    if (searching) {
      return `${filteredBooks.length} ${filteredBooks.length === 1 ? 'match' : 'matches'}`;
    }
    const volumes = `${books.length} ${books.length === 1 ? 'volume' : 'volumes'}`;
    return inProgressCount > 0 ? `${volumes} · ${inProgressCount} in progress` : volumes;
  };

  // An ELEMENT, not a component type: passing a freshly-declared component to
  // ListHeaderComponent remounts the search field (and drops its focus) on
  // every keystroke.
  const header = (
    <View>
      {/* Masthead. A titling banner rather than a small overline over a word —
          see Banner.tsx on why that device and not another. */}
      <Banner title="Library" eyebrow="Annotated" style={styles.masthead} actions={
        /* Two distinct actions, always visible regardless of shelf state.
           "Add" browses the canon; "Import" picks a local file. The empty-
           state CTA below is the same import action at a larger size for a
           first-run shelf — once a book exists that CTA stops rendering, so
           this pair is the only way in for anyone with an existing library. */
        <View style={styles.mastheadActions}>
          <ScaleTouchable
            style={styles.addButton}
            onPress={() => navigation.navigate('Catalog')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Browse the classical catalogue"
          >
            <PlusIcon size={13} color={colors.gold} strokeWidth={2.2} />
            <Text style={styles.addButtonText}>Add</Text>
          </ScaleTouchable>
          <ScaleTouchable
            style={[styles.addButton, isBusy && styles.addButtonBusy]}
            onPress={handleUploadBook}
            disabled={isBusy}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Import a book from this device"
          >
            {isBusy ? (
              <ActivityIndicator color={colors.gold} size="small" />
            ) : (
              <>
                <DownloadIcon size={13} color={colors.gold} strokeWidth={2.2} />
                <Text style={styles.addButtonText}>Import</Text>
              </>
            )}
          </ScaleTouchable>
        </View>
      } />

      {/* Search + controls. An empty shelf has nothing to search or sort, so
          they stay out of the way until there is something to find. */}
      {books.length > 0 && (
        <>
          <View style={styles.searchRow}>
            <SearchIcon size={16} color={colors.bronze} strokeWidth={1.8} />
            <TextInput
              style={styles.searchInput}
              placeholder="Seek a manuscript..."
              placeholderTextColor={colors.bronze}
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
              accessibilityLabel="Search your library"
            />
            {searching && (
              <ScaleTouchable
                onPress={() => setSearchText('')}
                style={styles.hitTarget}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <CloseIcon size={14} color={colors.bronze} strokeWidth={1.8} />
              </ScaleTouchable>
            )}
          </View>

          {/* Sort + view mode. Pills size to their labels — never `flex: 1`,
              which is what stretched them to ~640px each on a desktop. */}
          <View style={styles.controls}>
            {SORTS.map(s => {
              const active = sortBy === s.key;
              return (
                <ScaleTouchable
                  key={s.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSortBy(s.key)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Sort by ${s.label.toLowerCase()}`}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
                </ScaleTouchable>
              );
            })}

            <View style={styles.controlsSpacer} />

            <ScaleTouchable
              style={styles.viewButton}
              onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={viewMode === 'list' ? 'Switch to grid' : 'Switch to list'}
            >
              {viewMode === 'list' ? (
                <CollectionsIcon size={17} color={colors.gold} strokeWidth={1.7} />
              ) : (
                <MenuIcon size={17} color={colors.gold} strokeWidth={1.7} />
              )}
            </ScaleTouchable>
          </View>
        </>
      )}

      {renderImportBanner()}

      {/* Hero and carousel are about the shelf as a whole, so a search — which
          is about one volume — hides them and gives the results the page. */}
      {!searching && !!heroBook && <View style={styles.heroWrap}>{renderHero(heroBook)}</View>}

      {!searching && recentBooks.length >= 2 && (
        <Section
          title={anyRead ? 'Recently Opened' : 'Recently Added'}
          spacing={space.section}
        >
          <Carousel
            data={recentBooks}
            itemWidth={carouselItemW}
            gap={space.lg}
            bleed
            keyExtractor={b => b.id}
            renderItem={b => renderCarouselItem(b)}
          />
        </Section>
      )}

      {(books.length > 0 || searching) && (
        <Section
          title={searching ? 'Results' : 'All Manuscripts'}
          subtitle={shelfSubtitle()}
          spacing={space.heading}
        />
      )}
    </View>
  );

  return (
    // gutter={false}: the gutter is the list's own content padding — see the
    // note on `col` above.
    <Shell gutter={false} contentContainerStyle={styles.column}>
      <FlatList
        // numColumns cannot change on a mounted list — remount on toggle, and
        // on a column-count change (phone rotation, desktop resize).
        key={`${viewMode}-${gridCols}`}
        data={filteredBooks}
        renderItem={({ item, index }) =>
          viewMode === 'grid' ? renderGridCard(item, index) : renderListRow(item)
        }
        keyExtractor={item => item.id}
        numColumns={viewMode === 'grid' ? gridCols : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        ListHeaderComponent={header}
        ListEmptyComponent={renderEmpty()}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
    </Shell>
  );
}

const styles = StyleSheet.create({
  /** Shell's centred column has to grow so the FlatList inside it can scroll. */
  column: { flex: 1 },
  /** The page gutter lives here, inside the scroller's clip box. */
  listContent: { paddingHorizontal: layout.gutter, paddingBottom: space.xxxl },

  /* masthead */
  masthead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: space.xl,
    marginBottom: space.lg,
  },
  mastheadText: { flexShrink: 1, minWidth: 0 },
  overline: { ...t.overline, color: colors.bronze, textTransform: 'uppercase', marginBottom: 4 },
  screenTitle: { ...t.display, color: colors.gold },
  mastheadActions: { flexDirection: 'row', gap: space.sm },
  addButtonBusy: { opacity: 0.6 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: space.lg,
    // Was `space.sm + 1` (9px, the one value in the app off the 4pt grid) with
    // minHeight 36. The floor now governs the height, so the padding can go
    // back on-grid without changing how the button looks.
    paddingVertical: space.sm,
    justifyContent: 'center',
    ...arch.round,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: HIT_SLOP_MIN,
  },
  addButtonText: { ...t.caption, letterSpacing: 0.8, color: colors.gold, fontWeight: '600' },

  /* search */
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...arch.round,
    paddingHorizontal: space.lg,
    height: 44,
    marginBottom: space.md,
  },
  /** Real 44px box for a small glyph control; hitSlop alone is honoured
   *  unreliably by react-native-web. The glyph inside keeps its own size. */
  hitTarget: { minHeight: HIT_SLOP_MIN, minWidth: HIT_SLOP_MIN, alignItems: 'center', justifyContent: 'center' },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    ...t.body,
    // RNW draws a focus ring and a default border on <input>; neither belongs
    // inside a pill that already has its own.
    borderWidth: 0,
    outlineStyle: 'none',
  } as any,

  /* sort + view */
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xl,
  },
  chip: {
    // NO flex. This is the line that used to be `flex: 1`.
    paddingHorizontal: space.lg,
    // minHeight, not taller padding: the chip keeps its visual weight and only
    // its touch box grows to the 44px floor. Measured at 34px before this.
    minHeight: HIT_SLOP_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    // Arched head, squared foot — see `arch` in the theme. A row of stadiums
    // is the single most modern silhouette in the app.
    ...arch.round,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.gold },
  chipText: { ...t.caption, color: colors.bronze },
  chipTextActive: { color: colors.goldBright, fontWeight: '600' },
  controlsSpacer: { flex: 1 },
  viewButton: {
    width: HIT_SLOP_MIN,
    height: HIT_SLOP_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...arch.round,
    borderWidth: 1,
    borderColor: colors.border,
  },

  /* import banner */
  banner: {
    marginBottom: space.xl,
    padding: space.lg,
    borderWidth: 1,
    borderRadius: radius.lg,
    ...elevation.card,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bannerGlyphWrap: { width: 26, alignItems: 'flex-start', paddingTop: 1 },
  bannerGlyph: { fontSize: 15 },
  bannerBody: { flex: 1 },
  bannerTitle: { ...t.title, marginBottom: 3 },
  bannerDetail: { ...t.body, color: colors.inkMuted },
  bannerHint: { ...t.caption, color: colors.bronze, marginTop: 4, fontStyle: 'italic' },
  bannerClose: { paddingHorizontal: space.sm, marginTop: -space.xs, marginRight: -space.sm },
  bannerCloseText: { fontSize: 20, lineHeight: 22, color: colors.bronze },
  bannerProgress: { marginTop: space.md, marginLeft: 26 },
  importTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  importFill: { height: '100%', borderRadius: radius.pill },
  bannerStage: { ...t.overline, color: colors.bronze, marginTop: 6, textTransform: 'uppercase' },
  bannerAction: {
    alignSelf: 'flex-start',
    marginTop: space.md,
    marginLeft: 26,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  bannerActionText: { ...t.caption, letterSpacing: 0.6 },

  /* hero — the reference's signature panel */
  heroWrap: { marginBottom: space.section },
  hero: {
    backgroundColor: colors.surface,
    // The screen's one panel, so it gets the sprung arch rather than the
    // uniform 28px round of a content card.
    ...arch.panel,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    ...elevation.hero,
  },
  heroRow: { flexDirection: 'row', alignItems: 'stretch' },
  heroBody: { flex: 1, minWidth: 0, marginLeft: space.lg, justifyContent: 'flex-start' },
  /** Rubricated. In a manuscript the red ink is what announces a division —
   *  and `action` is now gold, which would have collided with the gold title
   *  directly beneath it. */
  heroKicker: { ...t.overline, color: colors.rubricInk, marginBottom: 6 },
  heroTitle: { ...t.display, fontSize: 22, lineHeight: 27, color: colors.goldBright },
  heroAuthor: { ...t.caption, color: colors.bronze, fontStyle: 'italic', marginTop: 4 },
  heroFoot: { marginTop: 'auto', paddingTop: space.md },
  heroTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  heroFill: { height: '100%', backgroundColor: colors.action, borderRadius: radius.pill },
  heroMeta: { ...t.overline, color: colors.inkMuted, marginTop: 7, textTransform: 'uppercase' },

  /* THE action. One per screen. */
  /** Geometry and fill now come from <LeafButton>; this only places it. */
  cta: { marginTop: space.lg },

  /* cover cells, shared by the carousel and the grid */
  cellTitle: { ...t.title, fontSize: 13, lineHeight: 17, color: colors.gold, marginTop: space.sm },
  cellAuthor: { ...t.caption, fontSize: 11, color: colors.bronze, fontStyle: 'italic', marginTop: 2 },
  cellTrack: {
    height: 3,
    marginTop: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  cellFill: { height: '100%', backgroundColor: colors.gold, borderRadius: radius.pill },
  cellTag: { ...t.overline, color: colors.bronze, marginTop: 6 },

  /* grid */
  gridRow: { justifyContent: 'flex-start' },
  gridCell: { marginBottom: space.xl },

  /* list */
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  listInfo: { flex: 1, minWidth: 0, marginLeft: space.lg, justifyContent: 'center' },
  listTitle: { ...t.title, color: colors.gold },
  listAuthor: { ...t.caption, color: colors.bronze, fontStyle: 'italic', marginTop: 3 },
  listMeta: { ...t.overline, color: colors.bronze, textTransform: 'uppercase', marginTop: 6 },
  listProgress: { ...t.overline, color: colors.inkMuted, marginTop: 6 },
  listChevron: { marginLeft: space.md },

  /* empty states */
  empty: {
    alignItems: 'center',
    paddingTop: space.xl,
    paddingBottom: space.xxxl,
    paddingHorizontal: space.sm,
    overflow: 'hidden',
  },
  emptyBgImage: { opacity: 0.22 },
  emptyBgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    opacity: 0.55,
  },
  emptyBgCredit: {
    ...t.caption,
    fontSize: 10,
    color: colors.bronze,
    marginTop: space.xs,
    marginBottom: space.md,
  },
  emptyShelf: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: space.xl,
    opacity: 0.55,
  },
  emptySpine: { marginHorizontal: -4 },
  emptyRule: { marginTop: space.xl, maxWidth: 220, alignSelf: 'center' },
  emptyTitle: { ...t.display, fontSize: 23, color: colors.gold, marginTop: space.md, textAlign: 'center' },
  emptyBody: {
    ...t.body,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: space.sm,
    maxWidth: 340,
  },
  emptyCta: { alignSelf: 'stretch', marginTop: space.xl, paddingHorizontal: space.xl },
  ghostButton: {
    marginTop: space.xl,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  ghostButtonText: { ...t.caption, color: colors.gold, letterSpacing: 0.8 },
  emptyFootnote: {
    ...t.caption,
    color: colors.bronze,
    textAlign: 'center',
    marginTop: space.lg,
    maxWidth: 340,
    lineHeight: 18,
  },
});
