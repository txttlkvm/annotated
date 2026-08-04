import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { EbookService } from '../services/EbookService';
import type { PickedFile } from '../services/EbookService';
import { Book } from '../types';
import BookCover from '../components/BookCover';
import { colors, type as t, space, radius, elevation } from '../theme';

const LIST_COVER_W = 58;

/**
 * How many imported books get their full text restored automatically on
 * arrival. Each one is potentially megabytes of string held in memory, so the
 * rest are restored on tap instead (see `openBook`). Recently-read books come
 * first, which is what the shelf is sorted by anyway.
 */
const MAX_AUTO_HYDRATE = 6;

/** Success messages clear themselves; problems wait to be acknowledged. */
const SUCCESS_DISMISS_MS = 6000;

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

/** '#c9a961' + 0.3 -> '#c9a9614d'. Eight-digit hex is fine on web and native. */
function withAlpha(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const suffix = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${suffix}`;
}

export default function LibraryScreen({ navigation }: any) {
  const { books, addBook, updateBook } = useApp();
  const { width } = useWindowDimensions();

  const [filteredBooks, setFilteredBooks] = useState<Book[]>(books);
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'author'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [importStatus, setImportStatus] = useState<ImportStatus>(IDLE);

  const isBusy = importStatus.phase === 'working';

  // Two columns inside listContent padding, minus card margins and padding.
  const gridCoverWidth = Math.max(72, Math.floor((width - space.xl) / 2 - space.md - space.xl));

  useFocusEffect(
    useCallback(() => {
      updateFilteredBooks();
    }, [books, searchText, sortBy])
  );

  const updateFilteredBooks = () => {
    const needle = searchText.trim().toLowerCase();
    const filtered = books.filter(
      b =>
        !needle ||
        b.title.toLowerCase().includes(needle) ||
        (b.author?.toLowerCase().includes(needle) ?? false)
    );

    filtered.sort((a, b) => {
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

    setFilteredBooks(filtered);
  };

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

  /**
   * Open a book, restoring an imported book's text first if this session has
   * not loaded it yet. Navigation happens either way — the details screen is
   * still worth showing when the text is gone.
   */
  const openBook = async (book: Book) => {
    if (book.content || !EbookService.hasStoredText(book)) {
      navigation.navigate('BookDetails', { bookId: book.id });
      return;
    }

    setImportStatus({
      phase: 'working',
      title: 'Opening',
      detail: book.title,
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
            <TouchableOpacity
              style={styles.bannerClose}
              onPress={() => setImportStatus(IDLE)}
              accessibilityLabel="Dismiss"
            >
              <Text style={styles.bannerCloseText}>×</Text>
            </TouchableOpacity>
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
          <TouchableOpacity style={[styles.bannerAction, { borderColor: withAlpha(accent, 0.5) }]} onPress={handleUploadBook}>
            <Text style={[styles.bannerActionText, { color: accent }]}>Try another file</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderBookCard = (book: Book) => {
    const progress =
      book.totalPages > 0 ? Math.min(100, (book.currentProgress / book.totalPages) * 100) : 0;

    if (viewMode === 'grid') {
      return (
        <TouchableOpacity
          style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => openBook(book)}
        >
          <View style={styles.gridCoverWrap}>
            <BookCover
              uri={book.cover}
              title={book.title}
              author={book.author}
              itemType={book.itemType}
              width={gridCoverWidth}
            />
          </View>
          <Text style={[styles.gridTitle, { color: colors.gold }]} numberOfLines={2}>
            {book.title}
          </Text>
          <Text style={[styles.gridAuthor, { color: colors.bronze }]} numberOfLines={1}>
            {book.author || '—'}
          </Text>
          {book.totalPages > 0 && (
            <>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={[styles.progressText, { color: colors.bronze }]}>
                {Math.round(progress)}%
              </Text>
            </>
          )}
          {book.itemType && book.itemType !== 'book' && (
            <Text style={[styles.typeTag, { color: colors.bronze }]}>
              {book.itemType === 'music' ? 'Music' : book.itemType === 'art' ? 'Art' : 'Resource'}
            </Text>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => openBook(book)}
      >
        <View style={styles.listCoverWrap}>
          <BookCover
            uri={book.cover}
            title={book.title}
            author={book.author}
            itemType={book.itemType}
            width={LIST_COVER_W}
          />
        </View>
        <View style={styles.listInfo}>
          <Text style={[styles.listTitle, { color: colors.gold }]} numberOfLines={1}>
            {book.title}
          </Text>
          <Text style={[styles.listAuthor, { color: colors.bronze }]} numberOfLines={1}>
            {book.author || '—'}
          </Text>
          <View style={styles.listMeta}>
            <Text style={[styles.metaText, { color: colors.bronze }]} numberOfLines={1}>
              {getItemTypeMeta(book)}
            </Text>
          </View>
          {book.totalPages > 0 && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          )}
        </View>
        <View style={styles.listStatus}>
          {book.totalPages > 0 ? (
            <>
              <Text style={[styles.pageNumber, { color: colors.gold }]}>{book.currentProgress}</Text>
              <Text style={[styles.pageLabel, { color: colors.bronze }]}>p.</Text>
            </>
          ) : (
            <Text style={[styles.pageLabel, { color: colors.bronze }]}>
              {book.itemType === 'music' ? '♪' : book.itemType === 'art' ? '✎' : '◆'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>✦ My Library</Text>
        <TouchableOpacity
          style={[styles.addButton, isBusy && styles.addButtonBusy]}
          onPress={handleUploadBook}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="Import a book from this device"
        >
          {isBusy ? (
            <ActivityIndicator color={colors.gold} size="small" />
          ) : (
            <Text style={styles.addButtonText}>+ Add</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Search & Filters */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Seek a manuscript..."
          placeholderTextColor={colors.bronze}
          value={searchText}
          onChangeText={setSearchText}
        />

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'recent' && styles.sortButtonActive]}
            onPress={() => setSortBy('recent')}
          >
            <Text style={styles.sortButtonText}>Recent</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'title' && styles.sortButtonActive]}
            onPress={() => setSortBy('title')}
          >
            <Text style={styles.sortButtonText}>Title</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'author' && styles.sortButtonActive]}
            onPress={() => setSortBy('author')}
          >
            <Text style={styles.sortButtonText}>Author</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewButton, viewMode === 'grid' && styles.sortButtonActive]}
            onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            accessibilityLabel={viewMode === 'list' ? 'Switch to grid' : 'Switch to list'}
          >
            <Text style={styles.viewButtonText}>{viewMode === 'list' ? '⊞' : '≡'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderImportBanner()}

      {/* Books List/Grid */}
      {filteredBooks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✦</Text>
          <Text style={styles.emptyText}>
            {books.length === 0 ? 'Your Library Awaits' : 'No results found'}
          </Text>
          <Text style={styles.emptySubtext}>
            {books.length === 0
              ? 'Bring a manuscript in from this device, or add one from the classical catalogue.'
              : 'Try a different search'}
          </Text>
          {books.length === 0 && (
            <>
              <TouchableOpacity style={styles.emptyButton} onPress={handleUploadBook} disabled={isBusy}>
                <Text style={styles.emptyButtonText}>Import a file</Text>
              </TouchableOpacity>
              <Text style={styles.emptyFootnote}>
                EPUB and TXT are read in full. PDF and MOBI can be shelved, but their text cannot be
                extracted yet.
              </Text>
            </>
          )}
        </View>
      ) : (
        <FlatList
          // numColumns cannot change on a mounted list — remount on toggle.
          key={viewMode}
          data={filteredBooks}
          renderItem={({ item }) => renderBookCard(item)}
          keyExtractor={item => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          contentContainerStyle={styles.listContent}
          scrollEnabled={true}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: space.lg,
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.gold,
    backgroundColor: colors.surface,
  },
  headerTitle: { ...t.display, color: colors.gold },
  addButton: {
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
    minWidth: 74,
    alignItems: 'center',
  },
  addButtonBusy: { opacity: 0.6 },
  addButtonText: { ...t.caption, letterSpacing: 0.8, color: colors.gold },
  searchSection: {
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    backgroundColor: colors.surface,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.board,
    color: colors.gold,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginBottom: space.md,
    ...t.body,
  },
  controls: {
    flexDirection: 'row',
    gap: space.sm,
  },
  sortButton: {
    flex: 1,
    paddingVertical: space.sm + 2,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  sortButtonActive: { backgroundColor: colors.board, borderColor: colors.gold },
  sortButtonText: { ...t.caption, color: colors.gold },
  viewButton: {
    width: 44,
    paddingVertical: space.sm + 2,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  viewButtonText: { fontSize: 15, color: colors.gold },

  /* import banner */
  banner: {
    marginHorizontal: space.md,
    marginTop: space.md,
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

  /* shelf */
  listContent: { padding: space.md, paddingBottom: space.xxxl },
  listCard: {
    flexDirection: 'row',
    marginBottom: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.md,
    alignItems: 'center',
    ...elevation.card,
  },
  listCoverWrap: { marginRight: space.lg },
  listInfo: { flex: 1, justifyContent: 'center' },
  listTitle: { ...t.title, marginBottom: 3 },
  listAuthor: { ...t.caption, marginBottom: 6, fontStyle: 'italic' },
  listMeta: { marginBottom: space.sm },
  metaText: { ...t.overline, textTransform: 'uppercase' },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderColor: colors.border,
  },
  progressFill: { height: '100%', backgroundColor: colors.gold, borderRadius: radius.pill },
  listStatus: { alignItems: 'center', marginLeft: space.md, minWidth: 30 },
  pageNumber: { ...t.heading, fontSize: 17 },
  pageLabel: { ...t.overline, marginTop: 2 },
  gridCard: {
    flex: 1,
    marginHorizontal: space.sm,
    marginBottom: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.md,
    ...elevation.card,
  },
  gridCoverWrap: { alignItems: 'center', marginBottom: space.md },
  gridTitle: { ...t.title, fontSize: 14, marginBottom: 3 },
  gridAuthor: { ...t.caption, marginBottom: space.sm, fontStyle: 'italic' },
  progressText: { ...t.overline, marginTop: 5 },
  typeTag: { ...t.overline, marginTop: 5, textTransform: 'uppercase' },

  /* empty state */
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xl },
  emptyIcon: { fontSize: 52, marginBottom: space.lg, color: colors.bronze, opacity: 0.5 },
  emptyText: { ...t.display, color: colors.gold, marginBottom: space.sm },
  emptySubtext: { ...t.body, color: colors.inkMuted, textAlign: 'center', maxWidth: 380 },
  emptyButton: {
    marginTop: space.xl,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.surfaceRaised,
  },
  emptyButtonText: { ...t.caption, color: colors.gold, letterSpacing: 0.8 },
  emptyFootnote: {
    ...t.caption,
    color: colors.bronze,
    textAlign: 'center',
    marginTop: space.lg,
    maxWidth: 360,
    lineHeight: 18,
  },
});
