// BookshelfScreen — the personal library drawn as an actual bookcase.
//
// Rebuilt on the primitives. Four structural changes:
//
// 1. <Shell>. The screen used to size itself from `useWindowDimensions()`, so a
//    1365px desktop got SIX covers stretched across a full-bleed row with the
//    masthead's stat strip spread 400px apart. Everything now lives in the
//    centred phone-width column and every cover is computed from
//    `useColumnWidth()`.
//
// 2. REAL SHELVES. Reference 5's skeuomorphic bookcase, executed in the
//    aubergine/gold language rather than as literal walnut: each row of volumes
//    stands in a recessed niche (a darker back panel with light falling off at
//    the top), on a board with a gold-lit front edge, a lighter face, and a dark
//    nose that drops a real shadow onto the page below. Each volume gets its own
//    contact shadow, so the books rest ON the board instead of floating above a
//    drawn line — and lifting one (tapping it) shrinks that shadow, which is the
//    cue that sells the whole thing.
//
// 3. ONE ACCENT. `colors.action` appears exactly once and only ever on the
//    single next action — the "Continue Reading" button inside an opened
//    volume's card, or, on an empty library, the one button that fixes it. The
//    two states cannot coexist.
//
// 4. NO LOCAL PALETTE. The screen used to carry its own light/dark palette and
//    two wood tones keyed off `settings.theme`. App chrome does not follow the
//    reader theme — picking the cream reading ground turned this screen
//    parchment while every other screen stayed aubergine. Only the READER
//    changes ground. Everything here is painted from `theme`.
//
// Progress semantics also changed, because they were wrong: `Book.currentProgress`
// is a PAGE NUMBER (see LibraryScreen and AppContext.countPages), not a
// percentage. The old bar rendered `width: '${currentProgress}%'`, so a reader on
// page 40 of 900 showed a 40%-full bar.

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useApp } from '../context/AppContext';
import BookCover from '../components/BookCover';
import Shell, { useColumnWidth } from '../components/Shell';
import Section from '../components/Section';
import { ChevronLeftIcon, PlayIcon, CheckIcon } from '../components/icons';
import { colors, space, radius, type as t, elevation, COVER_RATIO, HIT_SLOP_MIN } from '../theme';
import type { Book } from '../types';

/** Padding between the niche's inner wall and the first/last volume. */
const SHELF_PAD = space.md;

/** Covers are the hero, but a shelf of three needs them to stay in proportion. */
const MAX_COVER = 148;

/** The three ghost spines standing on the empty bookcase. Never a lone glyph. */
const GHOST_SHELF: Array<{ title: string; author: string }> = [
  { title: 'Confessions', author: 'Augustine' },
  { title: 'The Iliad', author: 'Homer' },
  { title: 'Consolation of Philosophy', author: 'Boethius' },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** `currentProgress` is a page number; `totalPages` is 0 until the text is fetched. */
function progressPercent(book: Book): number {
  if (!book.totalPages || book.totalPages <= 0) return 0;
  return clamp((book.currentProgress / book.totalPages) * 100, 0, 100);
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/** `addedDate` is a string on imports and a number on catalogue entries. */
function toMillis(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ---------------------------------------------------------------------------
// The bookcase
// ---------------------------------------------------------------------------

/**
 * The board. Three stacked bars rather than one: a gold-lit front edge catching
 * the light, the face of the plank, and a dark nose underneath that carries the
 * drop shadow. Overhangs the niche by 6px on each side because a real shelf
 * board is wider than the case it sits in — that overhang is most of what stops
 * this reading as a divider rule.
 */
function Plank({ wide = false }: { wide?: boolean }) {
  return (
    <View pointerEvents="none" style={styles.plank}>
      <View style={styles.plankEdge} />
      <View style={[styles.plankFace, wide && styles.plankFaceWide]} />
      <View style={styles.plankNose} />
    </View>
  );
}

/**
 * The recess the books stand in. The two shade bands at the top are a poor
 * man's gradient — `expo-linear-gradient` is not installed and this workflow may
 * not add dependencies — and they carry their own top radius, because the niche
 * itself must NOT clip (`overflow: 'hidden'` here would shear the drop shadow
 * off every cover in the row, which is the exact defect Carousel.tsx documents).
 */
function Niche({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.niche}>
      <View pointerEvents="none" style={styles.nicheShadeA} />
      <View pointerEvents="none" style={styles.nicheShadeB} />
      {children}
    </View>
  );
}

/** A single volume standing on the shelf. */
function Volume({
  book,
  width,
  expanded,
  onPress,
}: {
  book: Book;
  width: number;
  expanded: boolean;
  onPress: (id: string) => void;
}) {
  const pct = progressPercent(book);
  const started = pct > 0 && !book.isFinished;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(book.id)}
      style={{ width }}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={book.author ? `${book.title}, ${book.author}` : book.title}
      testID={`shelf-volume-${book.id}`}
    >
      <View style={[styles.volume, expanded && styles.volumeLifted]}>
        <BookCover
          uri={book.cover}
          title={book.title}
          author={book.author}
          itemType={book.itemType}
          width={width}
        />

        {/* Selected state is a gilt frame, not a colour change — the cover has
            to stay the loudest thing on the shelf. */}
        {expanded && <View pointerEvents="none" style={styles.selectRing} />}

        {started && (
          <View pointerEvents="none" style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(3, pct)}%` }]} />
          </View>
        )}

        {book.isFinished && (
          <View pointerEvents="none" style={styles.seal}>
            <CheckIcon size={11} color={colors.bg} strokeWidth={3} />
          </View>
        )}
      </View>

      {/* Contact shadow. Lifting the volume leaves a gap above this and narrows
          it, which is what reads as the book being picked up off the board. */}
      <View
        pointerEvents="none"
        style={[
          styles.contact,
          {
            width: Math.round(width * (expanded ? 0.74 : 0.9)),
            marginLeft: Math.round(width * (expanded ? 0.13 : 0.05)),
          },
          expanded && styles.contactLifted,
        ]}
      />
    </TouchableOpacity>
  );
}

/** The opened volume's card, hung under the shelf it stands on. */
function VolumeCard({ book, onRead }: { book: Book; onRead: (book: Book) => void }) {
  const pct = progressPercent(book);
  const page = book.totalPages > 0 ? clamp(book.currentProgress, 0, book.totalPages) : 0;
  const label = book.isFinished ? 'Read Again' : pct > 0 ? 'Continue Reading' : 'Begin Reading';

  return (
    <View style={styles.card} testID={`shelf-card-${book.id}`}>
      <Text style={styles.cardTitle} numberOfLines={3}>
        {book.title}
      </Text>
      {!!book.author && (
        <Text style={styles.cardAuthor} numberOfLines={1}>
          {book.author}
        </Text>
      )}

      {!!book.description && (
        <Text style={styles.cardBody} numberOfLines={4}>
          {book.description}
        </Text>
      )}

      <View style={styles.cardFoot}>
        <View style={styles.cardTrack}>
          <View style={[styles.cardFill, { width: `${Math.max(1.5, pct)}%` }]} />
        </View>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {book.isFinished
            ? 'Finished'
            : book.totalPages > 0
              ? `${page} of ${book.totalPages}  ·  ${Math.round(pct)}%`
              : 'Not yet paginated'}
        </Text>
      </View>

      {/* THE accent. Nothing else on this screen may be this colour. */}
      <TouchableOpacity
        style={styles.cta}
        activeOpacity={0.9}
        onPress={() => onRead(book)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${book.title}`}
      >
        <PlayIcon size={14} color={colors.actionInk} />
        <Text style={styles.ctaLabel}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

function StatCell({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function BookshelfScreen() {
  const { books, openBook } = useApp();
  const navigation = useNavigation<any>();
  const [openId, setOpenId] = useState<string | null>(null);

  // THE fix for the worst desktop defect: sizes come from the capped column,
  // never from the window.
  const col = useColumnWidth();
  const cols = col < 300 ? 2 : 3;
  const gap = col < 340 ? space.sm : space.md;
  const inner = Math.max(120, col - SHELF_PAD * 2);
  const coverW = clamp(Math.floor((inner - gap * (cols - 1)) / cols), 54, MAX_COVER);

  const reading = useMemo(
    () =>
      books
        .filter(b => !b.isFinished && b.currentProgress > 0)
        .sort((a, b) => (b.lastReadDate ?? 0) - (a.lastReadDate ?? 0)),
    [books]
  );
  const toRead = useMemo(
    () =>
      books
        .filter(b => !b.isFinished && b.currentProgress <= 0)
        .sort((a, b) => toMillis(b.addedDate) - toMillis(a.addedDate)),
    [books]
  );
  const finished = useMemo(() => books.filter(b => b.isFinished), [books]);

  const shelves = useMemo(() => {
    const out: Array<{ key: string; title: string; subtitle: string; items: Book[] }> = [];
    if (reading.length) {
      out.push({
        key: 'reading',
        title: 'Currently Reading',
        subtitle: plural(reading.length, 'volume open', 'volumes open'),
        items: reading,
      });
    }
    if (toRead.length) {
      out.push({
        key: 'to-read',
        title: 'To Read',
        subtitle: plural(toRead.length, 'volume waiting', 'volumes waiting'),
        items: toRead,
      });
    }
    if (finished.length) {
      out.push({
        key: 'finished',
        title: 'Finished',
        subtitle: plural(finished.length, 'volume closed', 'volumes closed'),
        items: finished,
      });
    }
    return out;
  }, [reading, toRead, finished]);

  const toggle = (id: string) => setOpenId(current => (current === id ? null : id));

  /**
   * Put the volume on the desk and go to the reader. `openBook` sets the current
   * book synchronously and then downloads the text; the reader owns the loading
   * state, so this deliberately does not await it. The navigate bubbles out of
   * the More stack to the tab navigator, which is where "Reading" lives.
   */
  const handleRead = (book: Book) => {
    openBook(book).catch(() => {});
    try {
      navigation.navigate('Reading', { screen: 'ReaderHome' });
    } catch {
      /* Route resolution is the navigator's business; a miss must not crash. */
    }
  };

  const goBack = () => {
    if (navigation.canGoBack?.()) navigation.goBack();
  };

  const canGoBack = !!navigation.canGoBack?.();

  return (
    <Shell scroll testID="bookshelf-screen">
      {/* Masthead */}
      <View style={styles.masthead}>
        {canGoBack && (
          <TouchableOpacity
            style={styles.back}
            onPress={goBack}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID="bookshelf-back"
          >
            <ChevronLeftIcon size={16} color={colors.gold} strokeWidth={2.2} />
          </TouchableOpacity>
        )}
        <View style={styles.mastheadText}>
          <Text style={styles.overline}>ANNOTATED</Text>
          <Text style={styles.screenTitle}>Bookshelf</Text>
        </View>
      </View>

      {books.length > 0 && (
        <View style={styles.stats}>
          <StatCell value={books.length} label={books.length === 1 ? 'VOLUME' : 'VOLUMES'} />
          <View style={styles.statRule} />
          <StatCell value={reading.length} label="READING" />
          <View style={styles.statRule} />
          <StatCell value={finished.length} label="FINISHED" />
        </View>
      )}

      {/* The bookcase */}
      {shelves.map((shelf, shelfIndex) => {
        const rows = chunk(shelf.items, cols);

        return (
          <Section
            key={shelf.key}
            title={shelf.title}
            subtitle={shelf.subtitle}
            last={shelfIndex === shelves.length - 1}
            testID={`shelf-${shelf.key}`}
          >
            {rows.map((row, rowIndex) => {
              const opened = row.find(b => b.id === openId);
              return (
                <View
                  key={`${shelf.key}-${rowIndex}`}
                  style={rowIndex < rows.length - 1 && styles.shelfSpacing}
                >
                  <Niche>
                    <View style={[styles.row, { gap }]}>
                      {row.map(book => (
                        <Volume
                          key={book.id}
                          book={book}
                          width={coverW}
                          expanded={book.id === openId}
                          onPress={toggle}
                        />
                      ))}
                    </View>
                  </Niche>
                  <Plank />
                  {!!opened && <VolumeCard book={opened} onRead={handleRead} />}
                </View>
              );
            })}
          </Section>
        );
      })}

      {/* Empty state: a drawn bookcase with ghost volumes on it, never a glyph. */}
      {books.length === 0 && (
        <View style={styles.empty} testID="bookshelf-empty">
          <View style={styles.emptyCase}>
            <Niche>
              <View style={[styles.row, styles.emptyRow, { gap }]}>
                {GHOST_SHELF.map(spine => (
                  <View key={spine.title} style={styles.ghost} pointerEvents="none">
                    <BookCover title={spine.title} author={spine.author} width={coverW} />
                  </View>
                ))}
              </View>
            </Niche>
            <Plank wide />
          </View>

          <Text style={styles.emptyTitle}>Your shelves are bare</Text>
          <Text style={styles.emptyBody}>
            Nothing is standing here yet. Add a volume from the classical catalogue and it will
            take its place on the shelf.
          </Text>

          {/* With no volume open there is no card, so THIS is the screen's
              single action and it carries the accent. */}
          <TouchableOpacity
            style={[styles.cta, styles.emptyCta]}
            activeOpacity={0.9}
            onPress={() => {
              try {
                navigation.navigate('Catalog');
              } catch {
                /* no-op */
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Browse the catalogue"
          >
            <Text style={styles.ctaLabel}>Browse the catalogue</Text>
          </TouchableOpacity>
        </View>
      )}
    </Shell>
  );
}

export { BookshelfScreen };

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  /* masthead ------------------------------------------------------------- */
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.xl,
    marginBottom: space.lg,
  },
  back: {
    width: HIT_SLOP_MIN,
    height: HIT_SLOP_MIN,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mastheadText: { flexShrink: 1, minWidth: 0 },
  overline: {
    ...t.overline,
    color: colors.bronze,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  screenTitle: { ...t.display, color: colors.gold },

  /* stat strip ----------------------------------------------------------- */
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.rule,
    paddingVertical: space.md,
    marginBottom: space.xl,
    ...elevation.card,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: {
    ...t.hero,
    fontSize: 24,
    lineHeight: 30,
    color: colors.goldBright,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { ...t.overline, color: colors.bronze, marginTop: 2 },
  statRule: { width: 1, alignSelf: 'stretch', backgroundColor: colors.rule },

  /* the bookcase --------------------------------------------------------- */
  shelfSpacing: { marginBottom: space.xl },

  /**
   * The recess. Deliberately NO `overflow: 'hidden'` — clipping here shears the
   * drop shadow off every cover standing in it.
   */
  niche: {
    backgroundColor: 'rgba(0, 0, 0, 0.26)',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.rule,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: space.lg,
    paddingHorizontal: SHELF_PAD,
  },
  /** Light falling off down the back panel. Two bands, each carrying the
   *  niche's own top radius so the corners stay round without clipping. */
  nicheShadeA: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  nicheShadeB: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    height: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.14)',
  },

  row: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'flex-end',
  },

  /** The board: lit front edge, face, and a dark nose that drops the shadow. */
  plank: { marginHorizontal: -6 },
  plankEdge: {
    height: 2,
    backgroundColor: 'rgba(227, 200, 135, 0.34)',
  },
  plankFace: {
    height: 12,
    backgroundColor: '#2a1e3d',
  },
  plankFaceWide: { height: 14 },
  plankNose: {
    height: 8,
    marginHorizontal: space.sm,
    backgroundColor: '#090511',
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  /* a volume ------------------------------------------------------------- */
  volume: { position: 'relative' },
  volumeLifted: { transform: [{ translateY: -10 }] },
  selectRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 1.5,
    borderColor: colors.goldBright,
    borderRadius: radius.cover + 3,
  },
  progressTrack: {
    position: 'absolute',
    left: space.sm,
    right: space.sm,
    bottom: space.sm,
    height: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.goldBright,
  },
  seal: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contact: {
    height: 6,
    marginTop: -2,
    borderRadius: radius.pill,
    backgroundColor: '#000',
    opacity: 0.5,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
  },
  contactLifted: { opacity: 0.3, marginTop: 2 },

  /* opened volume card --------------------------------------------------- */
  card: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  cardTitle: { ...t.heading, color: colors.goldBright },
  cardAuthor: { ...t.caption, color: colors.bronze, fontStyle: 'italic', marginTop: 3 },
  cardBody: { ...t.body, color: colors.inkMuted, marginTop: space.md },
  cardFoot: { marginTop: space.lg },
  cardTrack: {
    height: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.gold },
  cardMeta: {
    ...t.caption,
    color: colors.bronze,
    marginTop: space.sm,
    fontVariant: ['tabular-nums'],
  },

  /* the one accent ------------------------------------------------------- */
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.lg,
    minHeight: 46,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.action,
  },
  ctaLabel: {
    ...t.caption,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: colors.actionInk,
  },

  /* empty state ---------------------------------------------------------- */
  empty: {
    alignItems: 'center',
    paddingTop: space.md,
    paddingBottom: space.xxl,
  },
  emptyCase: { alignSelf: 'stretch', marginBottom: space.xl },
  emptyRow: { justifyContent: 'center' },
  ghost: { opacity: 0.42 },
  emptyTitle: {
    ...t.display,
    fontSize: 23,
    color: colors.gold,
    textAlign: 'center',
    marginTop: space.md,
  },
  emptyBody: {
    ...t.body,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: space.sm,
    maxWidth: 340,
  },
  emptyCta: { alignSelf: 'stretch', marginTop: space.xl },
});
