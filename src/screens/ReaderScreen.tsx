import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  Modal,
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
// import * as ScreenBrightness from 'expo-screen-brightness'; // Not available
import { useApp } from '../context/AppContext';
import { TTSService } from '../services/TTSService';
import { AudioService, PlaybackState } from '../services/AudioService';
import { GutenbergService, Paragraph } from '../services/GutenbergService';
import BookCover from '../components/BookCover';
import { colors, fonts, space, radius, elevation, readerPalettes } from '../theme';

/**
 * The reading surface.
 *
 * Everything here serves one goal: a line of text that is comfortable to read
 * for an hour. That means a constrained measure (65-75 characters, which is
 * ~34em / 680px at our body size), a real book serif, 1.6-1.7 line-height, and
 * warm ink on a warm ground — never pure white on pure black.
 */

/** Optical maximum line length. Beyond this the eye loses the line return. */
const MEASURE = 680;

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

export default function ReaderScreen() {
  const { currentBook, bookmarks, settings, updateSettings, addBookmark, addHighlight, addReadingSession } = useApp();
  const { width: windowWidth } = useWindowDimensions();

  const [currentPage, setCurrentPage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    position: 0,
    duration: 0,
    rate: 1,
  });
  const [showMenus, setShowMenus] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showHighlightColor, setShowHighlightColor] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [highlightColor, setHighlightColor] = useState(DEFAULT_HIGHLIGHT);
  const [sessionStartTime] = useState(Date.now());
  const [headerHeight, setHeaderHeight] = useState(96);

  const scrollRef = useRef<ScrollView>(null);

  const palette = readerPalettes[settings.theme] || readerPalettes.dark;

  useEffect(() => {
    AudioService.onPlaybackStatus(setPlaybackState);
    return () => {
      AudioService.cleanup();
    };
  }, []);

  useEffect(() => {
    updateBrightness();
  }, [settings.brightness]);

  const updateBrightness = async () => {
    try {
      if (!settings.autoBrightnessEnabled) {
        // Screen brightness control not available
        // await ScreenBrightness.setBrightnessAsync(settings.brightness);
      }
    } catch (error) {
      console.error('Brightness error:', error);
    }
  };

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

  // Reset to the opening page whenever a different book is put on the desk.
  useEffect(() => {
    setCurrentPage(0);
    setIsPlaying(false);
  }, [currentBook?.id]);

  // A page turn should land at the top of the new page, like a real book.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
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

  const handleReadAloud = async () => {
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

  const handleNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(p + 1, totalPages - 1));
    setIsPlaying(false);
  }, [totalPages]);

  const handlePreviousPage = useCallback(() => {
    setCurrentPage((p) => Math.max(0, p - 1));
    setIsPlaying(false);
  }, []);

  // Arrow keys turn pages on web — the expected gesture for a desktop reader.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: any) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') handleNextPage();
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') handlePreviousPage();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNextPage, handlePreviousPage]);

  // Record the sitting when the reader is left.
  const sessionRef = useRef({ bookId: '', page: 0 });
  useEffect(() => {
    sessionRef.current = { bookId: currentBook?.id || '', page: safePage };
  }, [currentBook?.id, safePage]);
  useEffect(() => {
    return () => {
      const { bookId, page: endPage } = sessionRef.current;
      const durationMinutes = Math.round((Date.now() - sessionStartTime) / 60000);
      if (!bookId || durationMinutes < 1) return;
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

  // -------------------------------------------------------------- states ----

  if (!currentBook) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
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
      </View>
    );
  }

  if (!parsed) {
    const coverWidth = Math.min(160, Math.max(112, windowWidth * 0.34));
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
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
          <Text style={[styles.emptyBody, { color: colors.inkMuted }]}>
            The text of this volume has not been downloaded yet. Open it from the library to fetch
            the full edition.
          </Text>
        </View>
      </View>
    );
  }

  // --------------------------------------------------------- typography ----

  // The stored setting is a UI slider value; the reader floors it at a size
  // that is actually comfortable for sustained reading.
  const fontSize = Math.round(Math.min(28, Math.max(17, settings.fontSize + 2)));
  const lineHeight = Math.round(fontSize * Math.min(2.0, Math.max(1.6, settings.lineHeight)));
  const gutter = GUTTERS[settings.marginSize] ?? space.xl;
  const paragraphGap = Math.round(fontSize * 0.85);
  const textAlign = settings.textAlignment === 'justify' ? 'justify' : settings.textAlignment;

  const bodyStyle = {
    fontFamily: fonts.reading,
    fontSize,
    lineHeight,
    color: palette.text,
    textAlign: textAlign as any,
    letterSpacing: settings.letterSpacing,
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* ------------------------------------------------------- header --- */}
      <View
        style={[styles.header, { backgroundColor: palette.surface, borderBottomColor: palette.rule }]}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            {!!chapterTitle && (
              <Text style={[styles.overline, { color: palette.accentSoft }]} numberOfLines={1}>
                {chapterTitle.toUpperCase()}
              </Text>
            )}
            <Text style={[styles.bookTitle, { color: palette.accent }]} numberOfLines={1}>
              {currentBook.title}
            </Text>
            <Text style={[styles.meta, { color: palette.muted }]} numberOfLines={1}>
              {currentBook.author ? `${currentBook.author}   ·   ` : ''}
              {safePage + 1} of {totalPages}
              {minutesLeft > 0 ? `   ·   ${minutesLeft} min left` : ''}
              {bookBookmarks > 0 ? `   ·   ${bookBookmarks} marked` : ''}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.menuButton, { borderColor: palette.border, backgroundColor: showMenus ? palette.raised : 'transparent' }]}
            onPress={() => setShowMenus(!showMenus)}
            accessibilityLabel="Reading menu"
          >
            <Text style={[styles.menuIcon, { color: palette.accent }]}>≡</Text>
          </TouchableOpacity>
        </View>

        {/* Reading progress, as a bound-in ribbon rather than a web progress bar. */}
        <View style={[styles.progressTrack, { backgroundColor: palette.rule }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round(progress * 100)}%`, backgroundColor: palette.accent },
            ]}
          />
        </View>
      </View>

      {/* --------------------------------------------------------- menu --- */}
      {showMenus && (
        <View
          style={[
            styles.menu,
            elevation.card,
            { top: headerHeight + space.sm, backgroundColor: palette.raised, borderColor: palette.border },
          ]}
        >
          {[
            { label: 'Add bookmark', onPress: () => { setShowMenus(false); setShowBookmarkModal(true); } },
            { label: 'Share this passage', onPress: () => { setShowMenus(false); handleShare(); } },
            {
              label: settings.pageMode === 'scroll' ? 'Switch to page mode' : 'Switch to scroll mode',
              onPress: () => {
                updateSettings({ pageMode: settings.pageMode === 'scroll' ? 'paginated' : 'scroll' });
                setCurrentPage(0);
                setShowMenus(false);
              },
            },
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
      )}

      {/* --------------------------------------------------------- page --- */}
      <ScrollView
        ref={scrollRef}
        style={[styles.textContainer, { backgroundColor: palette.bg }]}
        contentContainerStyle={[styles.textContent, { paddingHorizontal: gutter }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.measure}>
          {page?.startsChapter && !!chapterTitle && (
            <View style={styles.chapterOpener}>
              <Text style={[styles.chapterTitle, { color: palette.accent }]}>{chapterTitle}</Text>
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
        </View>
      </ScrollView>

      {/* -------------------------------------------------------- audio --- */}
      {isPlaying && (
        <View style={[styles.audioBar, { backgroundColor: palette.surface, borderTopColor: palette.rule }]}>
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

      {/* ----------------------------------------------------- controls --- */}
      <View style={[styles.controls, { backgroundColor: palette.surface, borderTopColor: palette.rule }]}>
        <TouchableOpacity
          style={[
            styles.pageButton,
            { borderColor: palette.border, backgroundColor: palette.raised },
            safePage === 0 && styles.disabled,
          ]}
          onPress={handlePreviousPage}
          disabled={safePage === 0}
        >
          <Text style={[styles.pageButtonText, { color: palette.accent }]}>‹  Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.playButton,
            { borderColor: palette.accent, backgroundColor: isPlaying ? palette.accent : palette.raised },
          ]}
          onPress={isPlaying ? handlePause : handleReadAloud}
          disabled={isLoadingAudio}
          accessibilityLabel={isPlaying ? 'Pause reading' : 'Read aloud'}
        >
          {isLoadingAudio ? (
            <ActivityIndicator color={palette.accent} />
          ) : (
            <Text style={[styles.playIcon, { color: isPlaying ? palette.surface : palette.accent }]}>
              {isPlaying ? '❙❙' : '▶'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pageButton,
            { borderColor: palette.border, backgroundColor: palette.raised },
            safePage >= totalPages - 1 && styles.disabled,
          ]}
          onPress={handleNextPage}
          disabled={safePage >= totalPages - 1}
        >
          <Text style={[styles.pageButtonText, { color: palette.accent }]}>Next  ›</Text>
        </TouchableOpacity>
      </View>

      {/* ------------------------------------------------------ bookmark --- */}
      <Modal visible={showBookmarkModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              elevation.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.gold }]}>Add a bookmark</Text>
            <Text style={[styles.modalCaption, { color: colors.inkMuted }]}>
              Page {safePage + 1} of {totalPages}
              {chapterTitle ? ` · ${chapterTitle}` : ''}
            </Text>
            <TextInput
              style={[
                styles.bookmarkInput,
                { color: colors.ink, borderColor: colors.border, backgroundColor: colors.bg },
              ]}
              placeholder="A note, if you wish"
              placeholderTextColor={colors.bronze}
              value={bookmarkNote}
              onChangeText={setBookmarkNote}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: colors.border }]}
                onPress={() => setShowBookmarkModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.inkMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.surfaceRaised, borderColor: colors.gold }]}
                onPress={handleAddBookmark}
              >
                <Text style={[styles.modalButtonText, { color: colors.goldBright }]}>Save</Text>
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
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.gold }]}>Mark this passage</Text>
            <Text style={[styles.modalExcerpt, { color: colors.ink }]} numberOfLines={4}>
              {selectedText}
            </Text>
            <View style={styles.swatchRow}>
              {HIGHLIGHT_SWATCHES.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  accessibilityLabel={s.label}
                  style={[
                    styles.swatch,
                    { borderColor: highlightColor === s.value ? colors.goldBright : colors.border },
                  ]}
                  onPress={() => handleHighlight(s.value)}
                >
                  <View style={[styles.swatchDot, { backgroundColor: s.value }]} />
                  <Text style={[styles.swatchLabel, { color: colors.inkMuted }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.modalButton, { borderColor: colors.border, marginTop: space.md }]}
              onPress={() => {
                setSelectedText('');
                setShowHighlightColor(false);
              }}
            >
              <Text style={[styles.modalButtonText, { color: colors.inkMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingTop: space.lg,
    paddingHorizontal: space.xl,
    borderBottomWidth: 1,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.lg },
  headerText: { flex: 1, paddingBottom: space.md },
  overline: {
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: space.xs,
  },
  bookTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: 0.3,
    marginBottom: space.xs,
  },
  meta: { fontFamily: fonts.ui, fontSize: 12, letterSpacing: 0.3 },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  menuIcon: { fontSize: 18, lineHeight: 20 },

  progressTrack: { height: 2, borderRadius: 1, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 1 },

  menu: {
    position: 'absolute',
    right: space.lg,
    left: space.lg,
    maxWidth: 360,
    alignSelf: 'flex-end',
    zIndex: 20,
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

  textContainer: { flex: 1 },
  textContent: {
    paddingTop: space.xxl,
    paddingBottom: space.xxxl,
  },
  /** The measure: never wider than a comfortable line, always centred. */
  measure: { width: '100%', maxWidth: MEASURE, alignSelf: 'center' },

  chapterOpener: { marginBottom: space.xxl, alignItems: 'center' },
  chapterTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 0.6,
    textAlign: 'center',
    marginBottom: space.lg,
  },

  ornament: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md },
  ornamentRule: { height: 1, width: 56 },
  ornamentDiamond: {
    width: 6,
    height: 6,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },

  audioBar: {
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderTopWidth: 1,
  },
  audioTrack: { height: 3, borderRadius: 2, overflow: 'hidden', marginBottom: space.sm },
  audioFill: { height: '100%', borderRadius: 2 },
  audioTime: { fontFamily: fonts.ui, fontSize: 12, textAlign: 'center', letterSpacing: 0.6 },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    borderTopWidth: 1,
    gap: space.md,
  },
  pageButton: {
    flex: 1,
    paddingVertical: space.md + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageButtonText: { fontFamily: fonts.ui, fontSize: 13, letterSpacing: 0.8 },
  disabled: { opacity: 0.35 },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: { fontSize: 15, letterSpacing: 1 },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.xxl,
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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 5, 16, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.xl,
  },
  modalCard: {
    borderRadius: radius.lg,
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
  modalButtons: { flexDirection: 'row', gap: space.md },
  modalButton: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
  },
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
