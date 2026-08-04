import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { DatabaseService } from '../services/DatabaseService';
import BookCover from '../components/BookCover';
import { colors, fonts, space, radius, type, elevation } from '../theme';

/** "2h 14m", "45m", "—" when nothing has been read yet. */
function formatDuration(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes < 1) return '—';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** One stat, set as a card on the theme scale rather than a cramped 10px box. */
function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {!!hint && <Text style={styles.statHint}>{hint}</Text>}
    </View>
  );
}

export default function BookDetailsScreen({ route, navigation }: any) {
  const { bookId } = route.params;
  const {
    books,
    bookmarks,
    highlights,
    setCurrentBook,
    deleteBook,
    loadBookmarks,
    loadHighlights,
    updateBook,
  } = useApp();
  const [stats, setStats] = useState({ totalMinutes: 0, sessionCount: 0 });
  const { width: windowWidth } = useWindowDimensions();
  const book = books.find(b => b.id === bookId);

  useEffect(() => {
    if (book) {
      loadBookmarks(bookId);
      loadHighlights(bookId);
      loadStats();
    }
  }, [bookId]);

  const loadStats = async () => {
    const bookStats = await DatabaseService.getReadingStats(bookId);
    setStats(bookStats);
  };

  if (!book) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyGlyph}>✦</Text>
        <Text style={styles.emptyText}>Manuscript not found</Text>
        <TouchableOpacity style={styles.emptyAction} onPress={() => navigation.goBack()}>
          <Text style={styles.backLabel}>← Back to library</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progress =
    book.totalPages > 0 ? Math.min(100, (book.currentProgress / book.totalPages) * 100) : 0;
  const started = book.currentProgress > 0;

  /** Hero cover: generous but never wider than half the page. */
  const contentWidth = Math.min(windowWidth, 720) - space.xl * 2;
  const coverWidth = Math.max(140, Math.min(196, Math.round(contentWidth * 0.48)));

  const getItemTypeDisplay = () => {
    if (book.itemType === 'music') return 'Music Composition';
    if (book.itemType === 'art') return 'Artwork';
    if (book.itemType === 'resource') return 'Study Resource';
    return 'Manuscript';
  };

  const primaryLabel = () => {
    if (book.itemType === 'music') return 'Listen & Study';
    if (book.itemType === 'art') return 'Study & Reflect';
    return started ? 'Continue Reading' : 'Begin Reading';
  };

  const primaryHint = () => {
    if (book.itemType === 'music' || book.itemType === 'art') return 'Open the study guide';
    if (book.totalPages > 0 && started) return `Page ${book.currentProgress} of ${book.totalPages}`;
    if (book.totalPages > 0) return `${book.totalPages} pages ahead`;
    return 'From the first page';
  };

  const handleStartReading = () => {
    if (book.itemType === 'music' || book.itemType === 'art') {
      Alert.alert(
        'Curriculum Item',
        book.itemType === 'music'
          ? 'Find and listen to this composition. Take notes on its structure and emotional impact.'
          : 'Study this artwork in depth. Consider its composition, symbolism, and historical significance.'
      );
      return;
    }
    setCurrentBook(book);
    navigation.navigate('Reading', { screen: 'ReaderHome' });
  };

  const handleToggleFavorite = async () => {
    await updateBook(bookId, { isFavorite: !book.isFavorite });
  };

  const handleToggleFinished = async () => {
    await updateBook(bookId, { isFinished: !book.isFinished });
  };

  const handleDeleteBook = () => {
    Alert.alert('Remove Manuscript', 'Are you certain? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteBook(bookId);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to library"
          >
            <Text style={styles.backLabel}>← Library</Text>
          </TouchableOpacity>
          {book.isFinished && (
            <View style={styles.finishedBadge}>
              <Text style={styles.finishedBadgeText}>✓ FINISHED</Text>
            </View>
          )}
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <BookCover
            uri={book.cover}
            title={book.title}
            author={book.author}
            itemType={book.itemType}
            width={coverWidth}
          />
          <Text style={styles.kicker}>{getItemTypeDisplay().toUpperCase()}</Text>
          <Text style={styles.title}>{book.title}</Text>
          {!!book.author && <Text style={styles.author}>{book.author}</Text>}
          <View style={styles.heroRule} />
        </View>

        {/* Description */}
        {!!book.description && (
          <Text style={styles.description} numberOfLines={6}>
            {book.description}
          </Text>
        )}

        {/* Study guides for non-book curriculum items */}
        {(book.itemType === 'music' || book.itemType === 'art') && (
          <View style={styles.guideCard}>
            <Text style={styles.guideLabel}>STUDY GUIDE</Text>
            <Text style={styles.guideText}>
              {book.itemType === 'music'
                ? 'Listen to this composition attentively. Study its structure, harmony, and emotional progression. Consider how it reflects the compositional principles of its era.'
                : 'Examine this artwork in depth. Notice the composition, use of colour and light, symbolic elements, and historical context. Reflect on its spiritual and artistic significance.'}
            </Text>
          </View>
        )}

        {/* Primary action */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleStartReading}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel()}
        >
          <Text style={styles.primaryLabel}>{primaryLabel()}</Text>
          <Text style={styles.primaryHint}>{primaryHint()}</Text>
        </TouchableOpacity>

        {/* Progress */}
        {book.totalPages > 0 && (
          <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>PROGRESS</Text>
              <Text style={styles.progressValue}>{Math.round(progress)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressMeta}>
              Page {book.currentProgress} of {book.totalPages}
            </Text>
          </View>
        )}

        {/* Reading stats */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Time Read"
            value={formatDuration(stats.totalMinutes)}
            hint={stats.totalMinutes >= 60 ? 'hours & minutes' : 'minutes'}
          />
          <StatCard
            label="Sessions"
            value={String(stats.sessionCount)}
            hint={stats.sessionCount === 1 ? 'sitting' : 'sittings'}
          />
          <StatCard
            label="Progress"
            value={book.totalPages > 0 ? `${Math.round(progress)}%` : '—'}
            hint={book.totalPages > 0 ? `of ${book.totalPages} pages` : 'not paginated'}
          />
        </View>

        {/* Secondary actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, book.isFavorite && styles.secondaryButtonActive]}
            onPress={handleToggleFavorite}
            accessibilityRole="button"
            accessibilityLabel={book.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          >
            <Text style={[styles.secondaryGlyph, book.isFavorite && styles.secondaryGlyphActive]}>
              {book.isFavorite ? '★' : '☆'}
            </Text>
            <Text style={[styles.secondaryLabel, book.isFavorite && styles.secondaryLabelActive]}>
              Favourite
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, book.isFinished && styles.secondaryButtonActive]}
            onPress={handleToggleFinished}
            accessibilityRole="button"
            accessibilityLabel={book.isFinished ? 'Mark as unfinished' : 'Mark as finished'}
          >
            <Text style={[styles.secondaryGlyph, book.isFinished && styles.secondaryGlyphActive]}>
              ✓
            </Text>
            <Text style={[styles.secondaryLabel, book.isFinished && styles.secondaryLabelActive]}>
              {book.isFinished ? 'Finished' : 'Mark Read'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleDeleteBook}
            accessibilityRole="button"
            accessibilityLabel="Remove from library"
          >
            <Text style={[styles.secondaryGlyph, styles.dangerText]}>✕</Text>
            <Text style={[styles.secondaryLabel, styles.dangerText]}>Remove</Text>
          </TouchableOpacity>
        </View>

        {/* Bookmarks */}
        {bookmarks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Bookmarks</Text>
              <Text style={styles.sectionCount}>{bookmarks.length}</Text>
            </View>
            {bookmarks.slice(0, 5).map(bookmark => (
              <View key={bookmark.id} style={styles.entryCard}>
                <Text style={styles.entryPage}>Page {bookmark.page}</Text>
                {!!bookmark.note && <Text style={styles.entryNote}>{bookmark.note}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Highlights */}
        {highlights.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Passages</Text>
              <Text style={styles.sectionCount}>{highlights.length}</Text>
            </View>
            {highlights.slice(0, 3).map(highlight => (
              <View
                key={highlight.id}
                style={[
                  styles.entryCard,
                  styles.passageCard,
                  { borderLeftColor: highlight.color || colors.gold },
                ]}
              >
                <Text style={styles.passageText}>“{highlight.text}”</Text>
                <Text style={styles.entryPage}>Page {highlight.page}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: space.xxxl },
  /** Centred measure — a full-bleed detail page reads as a web form, not a book. */
  page: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: space.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  backButton: { paddingVertical: space.sm, paddingRight: space.md },
  backLabel: { ...type.body, color: colors.gold, letterSpacing: 0.4 },
  finishedBadge: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  finishedBadgeText: { ...type.overline, color: colors.goldBright },

  hero: { alignItems: 'center', paddingTop: space.lg, paddingBottom: space.xl },
  kicker: { ...type.overline, color: colors.bronze, marginTop: space.xl },
  title: {
    ...type.display,
    fontSize: 30,
    lineHeight: 38,
    color: colors.goldBright,
    textAlign: 'center',
    marginTop: space.sm,
  },
  author: {
    ...type.body,
    fontFamily: fonts.display,
    fontSize: 16,
    fontStyle: 'italic',
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: space.sm,
  },
  heroRule: {
    width: 56,
    height: 1,
    backgroundColor: colors.rule,
    marginTop: space.xl,
  },

  description: {
    ...type.body,
    fontFamily: fonts.reading,
    fontSize: 15,
    lineHeight: 24,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: space.xl,
  },

  guideCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    padding: space.lg,
    marginBottom: space.xl,
    ...elevation.card,
  },
  guideLabel: { ...type.overline, color: colors.bronze, marginBottom: space.sm },
  guideText: { ...type.body, fontFamily: fonts.reading, fontSize: 15, lineHeight: 24, color: colors.ink },

  primaryButton: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    marginBottom: space.xl,
    ...elevation.card,
  },
  primaryLabel: {
    ...type.heading,
    fontSize: 18,
    color: colors.bg,
    fontWeight: '600',
  },
  primaryHint: {
    ...type.caption,
    color: 'rgba(15, 10, 26, 0.72)',
    marginTop: space.xs,
  },

  progressBlock: { marginBottom: space.xl },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.sm,
  },
  progressLabel: { ...type.overline, color: colors.bronze },
  progressValue: { ...type.title, color: colors.goldBright },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.gold },
  progressMeta: { ...type.caption, color: colors.inkMuted, marginTop: space.sm },

  statsGrid: { flexDirection: 'row', gap: space.md, marginBottom: space.xl },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    alignItems: 'center',
    ...elevation.card,
  },
  statLabel: { ...type.overline, color: colors.bronze, textAlign: 'center' },
  statValue: {
    ...type.display,
    fontSize: 22,
    color: colors.goldBright,
    marginTop: space.sm,
    textAlign: 'center',
  },
  statHint: { ...type.caption, fontSize: 11, color: colors.inkMuted, marginTop: space.xs, textAlign: 'center' },

  actionRow: { flexDirection: 'row', gap: space.md, marginBottom: space.xxl },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryButtonActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.gold },
  secondaryGlyph: { fontSize: 17, color: colors.bronze, marginBottom: space.xs },
  secondaryGlyphActive: { color: colors.goldBright },
  secondaryLabel: { ...type.caption, color: colors.inkMuted },
  secondaryLabelActive: { color: colors.goldBright },
  dangerText: { color: colors.danger },

  section: { marginBottom: space.xxl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  sectionTitle: { ...type.heading, color: colors.gold },
  sectionCount: { ...type.caption, color: colors.bronze },

  entryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.md,
  },
  entryPage: { ...type.overline, color: colors.bronze },
  entryNote: { ...type.body, color: colors.ink, marginTop: space.sm },

  passageCard: { borderLeftWidth: 3 },
  passageText: {
    ...type.body,
    fontFamily: fonts.reading,
    fontSize: 15,
    lineHeight: 25,
    fontStyle: 'italic',
    color: colors.ink,
    marginBottom: space.sm,
  },

  emptyState: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  emptyGlyph: { fontSize: 34, color: colors.bronze, marginBottom: space.lg },
  emptyText: { ...type.heading, color: colors.gold, textAlign: 'center' },
  emptyAction: { marginTop: space.xl, paddingVertical: space.sm, paddingHorizontal: space.lg },
});
