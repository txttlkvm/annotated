import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useApp } from '../context/AppContext';
import BookCover from '../components/BookCover';
import { colors, fonts, space, radius, type, elevation, COVER_RATIO } from '../theme';
import type { Book } from '../types';

/**
 * Personal Library.
 *
 * Rebuilt as a physical bookshelf: real Gutenberg covers (or the designed
 * typographic board from BookCover) standing face-out on a lit walnut plank,
 * each with a contact shadow so the volumes rest *on* the shelf rather than
 * floating in a grid. The old 2px-radius tiles, 9px type, and sparkle glyph
 * on every item are gone.
 *
 * Sub-components live at module scope rather than inside the screen so that
 * expanding a book doesn't remount every BookCover and re-trigger its image
 * load.
 */

interface Palette {
  bg: string;
  surface: string;
  ink: string;
  inkMuted: string;
  gold: string;
  goldBright: string;
  bronze: string;
  rule: string;
  border: string;
  /** Foreground on a solid gold fill. */
  onGold: string;
}

interface Wood {
  face: string;
  edge: string;
  lip: string;
  board: string;
}

/** Manuscript palette (dark) and its parchment counterpart (light). */
const PALETTE: Record<'dark' | 'light', Palette> = {
  dark: {
    bg: colors.bg,
    surface: colors.surface,
    ink: colors.ink,
    inkMuted: colors.inkMuted,
    gold: colors.gold,
    goldBright: colors.goldBright,
    bronze: colors.bronze,
    rule: colors.rule,
    border: colors.border,
    onGold: colors.bg,
  },
  light: {
    bg: '#efe7da',
    surface: '#f7f1e6',
    ink: '#2f2717',
    inkMuted: '#6b5f4a',
    gold: '#8a6b2f',
    goldBright: '#a8843c',
    bronze: '#8b7355',
    rule: 'rgba(90,70,35,0.20)',
    border: 'rgba(90,70,35,0.28)',
    onGold: '#f7f1e6',
  },
};

/** Wood tones aren't in the core palette — the shelf is the only thing needing them. */
const WOOD: Record<'dark' | 'light', Wood> = {
  dark: { face: '#3b2c1d', edge: '#8b7355', lip: '#150e08', board: 'rgba(255,255,255,0.022)' },
  light: { face: '#c19a68', edge: '#e6c79a', lip: '#7d5c36', board: 'rgba(120,90,40,0.05)' },
};

function columnsFor(width: number) {
  if (width < 380) return 2;
  if (width < 560) return 3;
  if (width < 820) return 4;
  if (width < 1120) return 5;
  return 6;
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function clampProgress(value?: number) {
  return Math.max(0, Math.min(value || 0, 100));
}

/** The plank: lit top edge, walnut face, dark underside lip reading as depth. */
function Plank({ wood, style }: { wood: Wood; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.plankWrap, style]}>
      <View style={[styles.plankEdge, { backgroundColor: wood.edge }]} />
      <View style={[styles.plankFace, { backgroundColor: wood.face }, elevation.card]} />
      <View style={[styles.plankLip, { backgroundColor: wood.lip }]} />
    </View>
  );
}

/** A single volume standing on the shelf. */
function Volume({
  book,
  width,
  palette,
  light,
  expanded,
  onPress,
}: {
  book: Book;
  width: number;
  palette: Palette;
  light: boolean;
  expanded: boolean;
  onPress: (id: string) => void;
}) {
  const progress = clampProgress(book.currentProgress);
  const inProgress = progress > 0 && !book.isFinished;

  return (
    <TouchableOpacity activeOpacity={0.82} onPress={() => onPress(book.id)} style={{ width }}>
      <View style={[styles.volume, expanded && styles.volumeLifted]}>
        <BookCover
          uri={book.cover}
          title={book.title}
          author={book.author}
          itemType={book.itemType}
          width={width}
        />

        {/* Selected state: a gilt frame rather than a colour change. */}
        {expanded && (
          <View
            pointerEvents="none"
            style={[styles.selectRing, { borderColor: palette.goldBright }]}
          />
        )}

        {inProgress && (
          <View pointerEvents="none" style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%`, backgroundColor: palette.goldBright },
              ]}
            />
          </View>
        )}

        {book.isFinished && (
          <View
            style={[
              styles.seal,
              { backgroundColor: palette.gold, borderColor: palette.bg },
              elevation.card,
            ]}
          >
            <Text style={[styles.sealMark, { color: palette.onGold }]}>✓</Text>
          </View>
        )}
      </View>

      {/* Contact shadow — what makes the book read as resting on the plank. */}
      <View
        pointerEvents="none"
        style={[
          styles.contactShadow,
          {
            width: width * 0.86,
            marginLeft: width * 0.07,
            opacity: light ? 0.18 : 0.55,
          },
        ]}
      />
    </TouchableOpacity>
  );
}

function DetailCard({ book, palette }: { book: Book; palette: Palette }) {
  const progress = clampProgress(book.currentProgress);

  return (
    <View
      style={[
        styles.detail,
        { backgroundColor: palette.surface, borderColor: palette.border },
        elevation.card,
      ]}
    >
      <Text style={[type.heading, styles.detailTitle, { color: palette.gold }]} numberOfLines={2}>
        {book.title}
      </Text>
      {!!book.author && (
        <Text style={[type.caption, styles.detailAuthor, { color: palette.bronze }]}>
          {book.author}
        </Text>
      )}
      <View style={[styles.detailRule, { backgroundColor: palette.rule }]} />
      {!!book.description && (
        <Text style={[type.body, styles.detailBody, { color: palette.inkMuted }]} numberOfLines={4}>
          {book.description}
        </Text>
      )}
      <View style={styles.detailFoot}>
        <View style={[styles.detailBarTrack, { backgroundColor: palette.rule }]}>
          <View
            style={[
              styles.detailBarFill,
              { width: `${progress}%`, backgroundColor: palette.goldBright },
            ]}
          />
        </View>
        <Text style={[type.caption, styles.detailMeta, { color: palette.bronze }]}>
          {book.isFinished ? 'Finished' : `${progress}% complete`}
        </Text>
      </View>
    </View>
  );
}

function ShelfSection({
  title,
  books: sectionBooks,
  icon,
  cols,
  gap,
  coverWidth,
  coverHeight,
  palette,
  wood,
  light,
  expandedBookId,
  onPressBook,
}: {
  title: string;
  books: Book[];
  icon: string;
  cols: number;
  gap: number;
  coverWidth: number;
  coverHeight: number;
  palette: Palette;
  wood: Wood;
  light: boolean;
  expandedBookId: string | null;
  onPressBook: (id: string) => void;
}) {
  const rows = chunk(sectionBooks, cols);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionGlyph, { color: palette.bronze }]}>{icon}</Text>
        <Text style={[styles.sectionLabel, { color: palette.gold }]}>{title.toUpperCase()}</Text>
        <View style={[styles.sectionRule, { backgroundColor: palette.rule }]} />
        <Text style={[styles.sectionCount, { color: palette.bronze }]}>{sectionBooks.length}</Text>
      </View>

      {rows.length === 0 ? (
        <View style={[styles.emptyShelf, { borderColor: palette.rule }]}>
          <Text style={[type.body, styles.emptyShelfText, { color: palette.inkMuted }]}>
            No volumes on this shelf yet
          </Text>
        </View>
      ) : (
        rows.map((row, i) => {
          const open = row.find((b) => b.id === expandedBookId);
          return (
            <View key={i} style={styles.shelfUnit}>
              <View style={[styles.backboard, { backgroundColor: wood.board }]}>
                <View style={[styles.backboardTopRule, { backgroundColor: palette.rule }]} />
                <View style={[styles.row, { gap, minHeight: coverHeight }]}>
                  {row.map((book) => (
                    <Volume
                      key={book.id}
                      book={book}
                      width={coverWidth}
                      palette={palette}
                      light={light}
                      expanded={book.id === expandedBookId}
                      onPress={onPressBook}
                    />
                  ))}
                </View>
              </View>
              <Plank wood={wood} />
              {!!open && <DetailCard book={open} palette={palette} />}
            </View>
          );
        })
      )}
    </View>
  );
}

function Stat({ value, label, palette }: { value: number; label: string; palette: Palette }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: palette.goldBright }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: palette.bronze }]}>{label}</Text>
    </View>
  );
}

export default function BookshelfScreen() {
  const { books, settings } = useApp();
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
  const { width: winWidth } = useWindowDimensions();

  const light = settings.theme === 'light';
  const palette = light ? PALETTE.light : PALETTE.dark;
  const wood = light ? WOOD.light : WOOD.dark;

  const pagePad = winWidth < 480 ? space.lg : space.xl;
  const cols = columnsFor(winWidth);
  const gap = winWidth < 480 ? space.md : space.lg;
  const available = Math.max(winWidth - pagePad * 2 - space.lg * 2, 200);
  const coverWidth = Math.min(Math.floor((available - gap * (cols - 1)) / cols), 168);
  const coverHeight = Math.round(coverWidth * COVER_RATIO);

  const currentlyReading = useMemo(
    () => books.filter((b) => !b.isFinished && b.currentProgress > 0),
    [books]
  );
  const finished = useMemo(() => books.filter((b) => b.isFinished), [books]);
  const toRead = useMemo(
    () => books.filter((b) => !b.isFinished && b.currentProgress === 0),
    [books]
  );

  const handlePressBook = (id: string) =>
    setExpandedBookId((current) => (current === id ? null : id));

  const shelfProps = {
    cols,
    gap,
    coverWidth,
    coverHeight,
    palette,
    wood,
    light,
    expandedBookId,
    onPressBook: handlePressBook,
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { paddingHorizontal: pagePad }]}>
        <Text style={[styles.eyebrow, { color: palette.bronze }]}>ANNOTATED</Text>
        <Text style={[type.display, styles.title, { color: palette.gold }]}>Personal Library</Text>

        <View style={styles.ornament}>
          <View style={[styles.ornamentRule, { backgroundColor: palette.rule }]} />
          <Text style={[styles.ornamentGlyph, { color: palette.bronze }]}>❧</Text>
          <View style={[styles.ornamentRule, { backgroundColor: palette.rule }]} />
        </View>

        {books.length > 0 && (
          <View style={styles.stats}>
            <Stat
              value={books.length}
              label={books.length === 1 ? 'VOLUME' : 'VOLUMES'}
              palette={palette}
            />
            <View style={[styles.statDivider, { backgroundColor: palette.rule }]} />
            <Stat value={currentlyReading.length} label="READING" palette={palette} />
            <View style={[styles.statDivider, { backgroundColor: palette.rule }]} />
            <Stat value={finished.length} label="FINISHED" palette={palette} />
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.shelves, { paddingHorizontal: pagePad }]}
        showsVerticalScrollIndicator={false}
      >
        {currentlyReading.length > 0 && (
          <ShelfSection title="Currently Reading" books={currentlyReading} icon="◆" {...shelfProps} />
        )}

        {toRead.length > 0 && (
          <ShelfSection title="To Read" books={toRead} icon="◇" {...shelfProps} />
        )}

        {finished.length > 0 && (
          <ShelfSection title="Finished Reading" books={finished} icon="✦" {...shelfProps} />
        )}

        {books.length === 0 && (
          <View
            style={[
              styles.emptyLibrary,
              { backgroundColor: palette.surface, borderColor: palette.border },
              elevation.card,
            ]}
          >
            <Text style={[styles.emptyGlyph, { color: palette.bronze }]}>❦</Text>
            <Text style={[type.heading, styles.emptyTitle, { color: palette.gold }]}>
              Your library is empty
            </Text>
            <View style={[styles.emptyRule, { backgroundColor: palette.rule }]} />
            <Text style={[type.body, styles.emptyMessage, { color: palette.inkMuted }]}>
              Add books from the catalog and they will appear here, standing on your shelves.
            </Text>

            {/* An empty shelf, drawn, so the page still reads as a bookcase. */}
            <Plank wood={wood} style={styles.emptyPlank} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingTop: space.xxl,
    paddingBottom: space.lg,
  },
  eyebrow: {
    ...type.overline,
    fontSize: 11,
    letterSpacing: 3,
    marginBottom: space.xs,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
  },
  ornament: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.md,
    marginBottom: space.lg,
  },
  ornamentRule: { flex: 1, height: 1, maxWidth: 120 },
  ornamentGlyph: {
    fontFamily: fonts.display,
    fontSize: 15,
    marginHorizontal: space.md,
  },

  stats: { flexDirection: 'row', alignItems: 'center' },
  stat: { paddingRight: space.lg },
  statValue: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28 },
  statLabel: { ...type.overline, fontSize: 10, letterSpacing: 1.4, marginTop: 2 },
  statDivider: { width: 1, height: 28, marginRight: space.lg },

  shelves: { paddingTop: space.sm, paddingBottom: space.xxxl * 2 },

  section: { marginBottom: space.xxl },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.lg,
  },
  sectionGlyph: { fontSize: 12, marginRight: space.sm },
  sectionLabel: {
    ...type.overline,
    fontSize: 12,
    letterSpacing: 2.2,
  },
  sectionRule: { flex: 1, height: 1, marginHorizontal: space.md },
  sectionCount: {
    fontFamily: fonts.display,
    fontSize: 15,
    letterSpacing: 0.5,
  },

  shelfUnit: { marginBottom: space.xl },
  backboard: {
    paddingTop: space.lg,
    paddingHorizontal: space.lg,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  backboardTopRule: {
    position: 'absolute',
    top: 0,
    left: space.lg,
    right: space.lg,
    height: 1,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'flex-end',
  },

  volume: { position: 'relative' },
  volumeLifted: { transform: [{ translateY: -6 }] },
  selectRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 1.5,
    borderRadius: radius.md + 2,
  },
  progressTrack: {
    position: 'absolute',
    left: space.sm,
    right: space.sm,
    bottom: space.sm,
    height: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  progressFill: { height: '100%', borderRadius: radius.pill },
  seal: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealMark: { fontSize: 12, fontFamily: fonts.ui, lineHeight: 14 },

  contactShadow: {
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: '#000',
    marginTop: -3,
  },

  plankWrap: { marginHorizontal: -space.xs },
  plankEdge: { height: 2, borderTopLeftRadius: 1, borderTopRightRadius: 1, opacity: 0.55 },
  plankFace: { height: 12 },
  plankLip: {
    height: 7,
    marginHorizontal: space.sm,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    opacity: 0.85,
  },

  detail: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  detailTitle: { marginBottom: 2 },
  detailAuthor: { fontStyle: 'italic' },
  detailRule: { height: 1, marginVertical: space.md },
  detailBody: { marginBottom: space.md },
  detailFoot: { flexDirection: 'row', alignItems: 'center' },
  detailBarTrack: {
    flex: 1,
    height: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginRight: space.md,
  },
  detailBarFill: { height: '100%', borderRadius: radius.pill },
  detailMeta: { letterSpacing: 0.6 },

  emptyShelf: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    paddingVertical: space.xxl,
    alignItems: 'center',
  },
  emptyShelfText: { fontStyle: 'italic' },

  emptyLibrary: {
    marginTop: space.xxl,
    paddingTop: space.xxxl,
    paddingHorizontal: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    overflow: 'hidden',
  },
  emptyGlyph: { fontFamily: fonts.display, fontSize: 34, marginBottom: space.md },
  emptyTitle: { textAlign: 'center' },
  emptyRule: { width: 64, height: 1, marginVertical: space.lg },
  emptyMessage: { textAlign: 'center', maxWidth: 380, marginBottom: space.xxxl },
  emptyPlank: { alignSelf: 'stretch', marginHorizontal: -space.xl },
});
