// CurriculumScreen — the 113-text classical map. The intellectual heart of the
// app, rebuilt on the shared primitives.
//
// What changed, and why:
//
// 1. <Shell>. The screen had no width cap, so on a 1365px desktop the masthead,
//    the search field and every card ran the full viewport: a 68px cover beside
//    1200px of description reads as a spreadsheet row, not a book. Everything
//    now lives in the centred phone-width column and EVERY cover size is
//    computed from `useColumnWidth()` — never from `Dimensions.get('window')`.
//
// 2. TWO MODES instead of one endless list.
//      • Browsing (nothing filtered, nothing typed): tier and stage BANDS,
//        each a <Carousel> of large covers — Tier I, Tier II, the three stages
//        of the trivium, then the companion volumes that sit outside the spine.
//        Each band's "See all" applies that band's real filter, so the browse
//        surface and the filter controls drive the same state.
//      • Filtered or searching: the grouped card list, with the full
//        description, the badges and the "free online" source links.
//    A flat list of 113 rows is a database dump; bands are a curriculum.
//
// 3. Covers are the hero. 68px postage stamps became 108–150px in the bands and
//    82–104px in the rows, all drawn by <BookCover> with `coverFor(item.id)` —
//    keyed by CATALOG ITEM id, which is what that map is keyed by.
//
// 4. Chips are fully pill-shaped with a FILLED gold selected state. The old
//    selected state was a hairline over a dark fill, which at chip size read as
//    a strikethrough — i.e. as "excluded" rather than "chosen".
//
// FILTERING, SEARCH AND NAVIGATION BEHAVIOUR IS UNCHANGED. The `items` memo,
// the stage rule (a stageless text always passes a stage filter), the grouping
// rule (by category, or by tier once a category is chosen) and the tap target
// (ClassicalLibraryReader) are all carried over verbatim.

import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
  Linking,
} from 'react-native';
import { useApp } from '../context/AppContext';
import type { ClassicalLibraryItem } from '../data/classicalLibrary';
import BookCover from '../components/BookCover';
import Shell, { useColumnWidth } from '../components/Shell';
import Section from '../components/Section';
import Carousel from '../components/Carousel';
import { SearchIcon, CloseIcon, CheckIcon, ChevronRightIcon } from '../components/icons';
import { coverFor } from '../data/gutenbergIds';
import { colors, fonts, space, radius, type as t, elevation, layout } from '../theme';

import { Alert } from '../components/Alert';
const categories = [
  'literature',
  'philosophy',
  'theology',
  'history',
  'mathematics',
  'science',
  'biography',
  'music',
  'art',
  'language',
];

const tiers = [
  { id: 1, label: 'Tier 1 (Core Texts)' },
  { id: 2, label: 'Tier 2 (Context)' },
];

const stages = [
  { id: 'grammar', label: 'Grammar Stage' },
  { id: 'logic', label: 'Logic Stage' },
  { id: 'rhetoric', label: 'Rhetoric Stage' },
];

/** Short chip labels — the long parenthetical versions above stay the source of truth for filtering. */
const TIER_CHIP: Record<number, string> = { 1: 'Tier I', 2: 'Tier II' };
const STAGE_CHIP: Record<string, string> = {
  grammar: 'Grammar',
  logic: 'Logic',
  rhetoric: 'Rhetoric',
};

/** Section headings when the results are grouped by tier. */
const TIER_SECTION: Record<number, string> = {
  1: 'Tier I — Core Texts',
  2: 'Tier II — Context',
};

/** One line of orientation under each band heading. */
const BAND_BLURB: Record<string, string> = {
  'tier-1': 'Revisited at rising depth in all three stages',
  'tier-2': 'One thorough pass',
  'stage-grammar': 'Memory, story and the facts themselves',
  'stage-logic': 'Order, argument and cause',
  'stage-rhetoric': 'Synthesis, judgment and expression',
  rest: 'Companions to the tiered spine',
};

/**
 * Rubrication: each stage of the trivium gets its own ink. Sage for grammar,
 * gold for logic, rubric red for rhetoric — all drawn from the theme so the
 * badges read as one family rather than three stray colours.
 */
const STAGE_INK: Record<string, string> = {
  grammar: colors.success,
  logic: colors.gold,
  rhetoric: colors.danger,
};

const TYPE_LABEL: Record<string, string> = {
  music: 'Music',
  art: 'Art',
  resource: 'Resource',
};

const SOURCE_LABEL: Record<string, string> = {
  gutenberg: 'Gutenberg',
  archive: 'Archive',
  youtube: 'YouTube',
  wikimedia: 'Wikimedia',
};

const ROMAN: Record<number, string> = { 1: 'I', 2: 'II' };

/**
 * Covers shown per band before "See all" takes over. A band is a shop window,
 * not the whole shelf — and every cover in it is a live <Image>, so an uncapped
 * band would mount several hundred of them across six carousels.
 */
const BAND_CAP = 12;

/** React Native Web paints a focus ring that fights the pill's own border. */
const NO_FOCUS_RING = { outlineStyle: 'none', borderWidth: 0 } as any;

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ---------------------------------------------------------------------------
// Pieces. Declared at module level, never inside the screen: a component
// declared in a render body is a NEW type every render, so React would tear
// down and rebuild every chip, card and — fatally — the search field on each
// keystroke, dropping its focus.
// ---------------------------------------------------------------------------

/**
 * Filter pill. The selected state is a solid gold fill carrying dark ink and a
 * check — unmissable, and impossible to mistake for a struck-through label.
 */
function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      {active && <CheckIcon size={11} color={colors.bg} strokeWidth={3} />}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Metadata badge on a card. `solid` gives it a gold wash, `dot` a rubric mark. */
function Badge({
  label,
  ink,
  dot,
  solid,
}: {
  label: string;
  ink: string;
  dot?: boolean;
  solid?: boolean;
}) {
  return (
    <View
      style={[
        styles.badge,
        { borderColor: solid ? ink : colors.border },
        solid && styles.badgeSolid,
      ]}
    >
      {dot && <View style={[styles.badgeDot, { backgroundColor: ink }]} />}
      <Text style={[styles.badgeText, { color: ink }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** One cover in a tier/stage band. The cover IS the card. */
function BandCell({
  item,
  width,
  onOpen,
}: {
  item: ClassicalLibraryItem;
  width: number;
  onOpen: (item: ClassicalLibraryItem) => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onOpen(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title} by ${item.author}`}
    >
      <BookCover
        uri={coverFor(item.id)}
        title={item.title}
        author={item.author}
        itemType={item.type}
        width={width}
      />
      <Text style={styles.cellTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.cellAuthor} numberOfLines={1}>
        {item.author}
      </Text>

      <View style={styles.cellMeta}>
        {!!item.tier && (
          <Text style={styles.cellTier}>TIER {ROMAN[item.tier] || item.tier}</Text>
        )}
        {!!item.stage && (
          <>
            {!!item.tier && <Text style={styles.cellSep}>·</Text>}
            <View style={[styles.cellDot, { backgroundColor: STAGE_INK[item.stage] }]} />
            <Text style={styles.cellStage} numberOfLines={1}>
              {STAGE_CHIP[item.stage] || titleCase(item.stage)}
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * A full card in the filtered/searched list: large cover, badges, description
 * and the public-domain source links.
 *
 * The card body and the source links are SIBLING touch targets rather than one
 * nested inside the other, so a tap on "Gutenberg" opens the link instead of
 * racing the card's own navigation.
 */
function CurriculumRow({
  item,
  coverWidth,
  onOpen,
}: {
  item: ClassicalLibraryItem;
  coverWidth: number;
  onOpen: (item: ClassicalLibraryItem) => void;
}) {
  const { id, title, author, tier, stage, description, type: itemType, grade, sources } = item;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardBody}
        activeOpacity={0.85}
        onPress={() => onOpen(item)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
      >
        <BookCover
          uri={coverFor(id)}
          title={title}
          author={author}
          itemType={itemType}
          width={coverWidth}
        />

        <View style={styles.cardText}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.itemAuthor} numberOfLines={1}>
            {author}
          </Text>

          <Text style={styles.itemDescription} numberOfLines={3}>
            {description}
          </Text>

          <View style={styles.badges}>
            {!!tier && (
              <Badge
                label={TIER_CHIP[tier] || `Tier ${tier}`}
                ink={tier === 1 ? colors.goldBright : colors.bronze}
                solid={tier === 1}
              />
            )}
            {!!stage && (
              <Badge
                label={STAGE_CHIP[stage] || titleCase(stage)}
                ink={STAGE_INK[stage] || colors.bronze}
                dot
              />
            )}
            {typeof grade === 'number' && grade > 0 && (
              <Badge label={`Grade ${grade}`} ink={colors.inkMuted} />
            )}
            {!!TYPE_LABEL[itemType] && <Badge label={TYPE_LABEL[itemType]} ink={colors.bronze} />}
          </View>
        </View>

        <View style={styles.cardChevron}>
          <ChevronRightIcon size={15} color={colors.bronze} strokeWidth={2} />
        </View>
      </TouchableOpacity>

      {!!sources && sources.length > 0 && (
        <View style={styles.sourcesSection}>
          <Text style={styles.sourcesLabel}>Free online</Text>
          <View style={styles.sourcesList}>
            {sources.slice(0, 2).map((source, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.sourceButton}
                activeOpacity={0.7}
                accessibilityRole="link"
                accessibilityLabel={`Open ${title} at ${SOURCE_LABEL[source.provider] || source.provider}`}
                onPress={() => {
                  Linking.openURL(source.url).catch(() =>
                    Alert.alert('Error', 'Could not open link')
                  );
                }}
              >
                <Text style={styles.sourceButtonText}>
                  {SOURCE_LABEL[source.provider] || 'View'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------

export default function CurriculumScreen({ navigation }: any) {
  const { getClassicalLibrary, addClassicalLibraryItem, books } = useApp();

  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  // THE fix for the desktop defect: content width comes from the capped column.
  // The page gutter is applied by Shell's contentContainerStyle rather than by
  // Shell itself (`gutter={false}`), so the scroller's clip box stays the full
  // window and a bleeding <Carousel> can never have its cover shadows sheared —
  // which is why the gutter is passed to the hook explicitly.
  const col = useColumnWidth(undefined, layout.gutter);

  const bandCoverW = clamp(Math.round(col * 0.34), 108, 150);
  const rowCoverW = clamp(Math.round(col * 0.25), 82, 104);

  const library = getClassicalLibrary();

  // Filtering behaviour is unchanged from the original screen.
  const items = useMemo(() => {
    let result = library;
    if (selectedCategory) {
      result = result.filter(item => item.category === selectedCategory);
    }
    if (selectedTier) {
      result = result.filter(item => item.tier === selectedTier);
    }
    if (selectedStage) {
      result = result.filter(item => item.stage === selectedStage || !item.stage);
    }
    if (searchText) {
      result = result.filter(
        item =>
          item.title.toLowerCase().includes(searchText.toLowerCase()) ||
          item.author.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    return result;
  }, [library, selectedCategory, selectedTier, selectedStage, searchText]);

  /**
   * Grouping is presentation only. A flat list of 113 entries is unreadable;
   * grouped by category it becomes a table of contents. Once a category is
   * chosen that heading would repeat on every row, so we group by tier instead.
   */
  const sections = useMemo(() => {
    if (selectedCategory) {
      const order = [1, 2, 0];
      return order
        .map(tier => ({
          key: `tier-${tier}`,
          label: TIER_SECTION[tier] || 'Further Reading',
          items: items.filter(item => (item.tier || 0) === tier),
        }))
        .filter(section => section.items.length > 0);
    }

    const seen = new Set(categories);
    const extra = Array.from(
      new Set(items.map(item => item.category).filter(cat => !seen.has(cat)))
    ).sort();

    return [...categories, ...extra]
      .map(cat => ({
        key: cat,
        label: titleCase(cat),
        items: items.filter(item => item.category === cat),
      }))
      .filter(section => section.items.length > 0);
  }, [items, selectedCategory]);

  /**
   * The browse surface: the curriculum's own spine, as horizontal bands.
   * Every text appears in at least one band — anything with neither a tier nor
   * a stage lands in "Further Reading" rather than falling off the screen.
   */
  const bands = useMemo(() => {
    const built: Array<{
      key: string;
      label: string;
      items: ClassicalLibraryItem[];
      onSeeAll?: () => void;
    }> = [];

    const add = (
      key: string,
      label: string,
      list: ClassicalLibraryItem[],
      onSeeAll?: () => void
    ) => {
      if (list.length > 0) built.push({ key, label, items: list, onSeeAll });
    };

    add('tier-1', TIER_SECTION[1], items.filter(i => i.tier === 1), () => setSelectedTier(1));
    add('tier-2', TIER_SECTION[2], items.filter(i => i.tier === 2), () => setSelectedTier(2));

    stages.forEach(stage => {
      add(
        `stage-${stage.id}`,
        stage.label,
        items.filter(i => i.stage === stage.id),
        () => setSelectedStage(stage.id)
      );
    });

    add('rest', 'Further Reading', items.filter(i => !i.tier && !i.stage));

    return built;
  }, [items]);

  const searching = searchText.trim().length > 0;
  const narrowed = !!selectedCategory || !!selectedTier || !!selectedStage;
  const filtersActive = narrowed || !!searchText;

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedTier(null);
    setSelectedStage(null);
    setSearchText('');
  };

  /**
   * Used to route straight to an already-added volume instead of creating a
   * duplicate library entry every time the same curriculum item is tapped.
   * Book has no field linking back to a catalogue id, so this matches on
   * title+author — the same key AppContext's own sourceUrl backfill uses.
   */
  const findExistingBook = (item: ClassicalLibraryItem) => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const key = `${norm(item.title)}|${norm(item.author || '')}`;
    return books.find((b) => `${norm(b.title)}|${norm(b.author || '')}` === key);
  };

  /**
   * Every prior version of this handler sent every tap — book, music, art —
   * to ClassicalLibraryReaderScreen, which downloaded to a native file:// path
   * via ContentDownloadService. That has no web implementation at all, so on
   * web every tap failed with "expo-file-system.getInfoAsync is not available
   * on web" instead of reading anything.
   *
   * Books now go through the exact path already proven end-to-end from the
   * Catalog: add (or reuse) the library entry, open Book Details, and let the
   * real GutenbergService/AppContext pipeline fetch and paginate the text.
   */
  const handleViewItem = async (item: ClassicalLibraryItem) => {
    if (item.type === 'music' || item.type === 'art') {
      const source = item.sources?.[0];
      if (item.type === 'music') {
        navigation.navigate('MusicPlayer', {
          sourceUrl: source?.url,
          sourceUrls: source?.urls,
          title: item.title,
          artist: item.author,
        });
      } else {
        navigation.navigate('ArtViewer', { sourceUrl: source?.url, title: item.title, artist: item.author });
      }
      return;
    }

    const existing = findExistingBook(item);
    const bookId = existing ? existing.id : await addClassicalLibraryItem(item);
    navigation.navigate('Library', { screen: 'BookDetails', params: { bookId } });
  };

  /* ------------------------------------------------------------------- ui */

  const renderBands = () =>
    bands.map((band, index) => (
      <Section
        key={band.key}
        title={band.label}
        subtitle={`${plural(band.items.length, 'text', 'texts')} · ${BAND_BLURB[band.key] || ''}`}
        actionLabel={band.onSeeAll ? 'See all' : undefined}
        onAction={band.onSeeAll}
        last={index === bands.length - 1}
      >
        <Carousel
          data={band.items.slice(0, BAND_CAP)}
          itemWidth={bandCoverW}
          gap={space.lg}
          bleed
          keyExtractor={item => item.id}
          renderItem={item => (
            <BandCell item={item} width={bandCoverW} onOpen={handleViewItem} />
          )}
        />
      </Section>
    ));

  const renderSections = () =>
    sections.map((section, index) => (
      <Section
        key={section.key}
        title={section.label}
        subtitle={plural(section.items.length, 'text', 'texts')}
        last={index === sections.length - 1}
      >
        {section.items.map(item => (
          <CurriculumRow
            key={item.id}
            item={item}
            coverWidth={rowCoverW}
            onOpen={handleViewItem}
          />
        ))}
      </Section>
    ));

  return (
    // gutter={false} + an explicit gutter on the column: see the note on `col`.
    <Shell scroll gutter={false} contentContainerStyle={styles.content}>
      {/* Masthead */}
      <View style={styles.masthead}>
        <View style={styles.mastheadText}>
          <Text style={styles.overline}>CLASSICAL CHRISTIAN EDUCATION</Text>
          <Text style={styles.screenTitle}>Curriculum</Text>
        </View>
        <View style={styles.count}>
          <Text style={styles.countNumber}>{items.length}</Text>
          <Text style={styles.countLabel}>{items.length === 1 ? 'text' : 'texts'}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <SearchIcon size={16} color={colors.bronze} strokeWidth={1.8} />
        <TextInput
          style={[styles.searchInput, NO_FOCUS_RING]}
          placeholder="Search by title or author"
          placeholderTextColor={colors.bronze}
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
          accessibilityLabel="Search the curriculum"
        />
        {!!searchText && (
          <TouchableOpacity
            onPress={() => setSearchText('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <CloseIcon size={14} color={colors.bronze} strokeWidth={1.8} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filterBlock}>
        <View style={styles.filterHead}>
          <Text style={styles.filterLabel}>Subject</Text>
          {filtersActive && (
            <TouchableOpacity
              onPress={clearFilters}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
            >
              <Text style={styles.clearAll}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroller}
          contentContainerStyle={styles.chipTrack}
        >
          <Chip
            label="All"
            active={selectedCategory === null}
            onPress={() => setSelectedCategory(null)}
          />
          {categories.map(cat => (
            <Chip
              key={cat}
              label={titleCase(cat)}
              active={selectedCategory === cat}
              onPress={() => setSelectedCategory(cat)}
            />
          ))}
        </ScrollView>

        <Text style={[styles.filterLabel, styles.filterLabelSpaced]}>Tier &amp; Stage</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroller}
          contentContainerStyle={styles.chipTrack}
        >
          <Chip
            label="All Tiers"
            active={selectedTier === null}
            onPress={() => setSelectedTier(null)}
          />
          {tiers.map(tier => (
            <Chip
              key={tier.id}
              label={TIER_CHIP[tier.id] || tier.label}
              active={selectedTier === tier.id}
              onPress={() => setSelectedTier(tier.id)}
            />
          ))}

          <View style={styles.chipDivider} />

          <Chip
            label="All Stages"
            active={selectedStage === null}
            onPress={() => setSelectedStage(null)}
          />
          {stages.map(stage => (
            <Chip
              key={stage.id}
              label={STAGE_CHIP[stage.id] || stage.label}
              active={selectedStage === stage.id}
              onPress={() => setSelectedStage(stage.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Results */}
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyGlyph}>❦</Text>
          <Text style={styles.emptyTitle}>Nothing in this part of the shelf</Text>
          <Text style={styles.emptyBody}>
            No texts match these filters. Widen the search or clear the filters to see the
            whole curriculum.
          </Text>
          {filtersActive && (
            <TouchableOpacity
              style={styles.ghostButton}
              activeOpacity={0.8}
              onPress={clearFilters}
              accessibilityRole="button"
            >
              <Text style={styles.ghostButtonText}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.results}>
          {searching || narrowed ? renderSections() : renderBands()}
          <View style={styles.footer}>
            <Text style={styles.footerMark}>❦</Text>
          </View>
        </View>
      )}
    </Shell>
  );
}

const styles = StyleSheet.create({
  /** The page gutter lives on the column, not on Shell — see the note on `col`. */
  content: { paddingHorizontal: layout.gutter },

  /* masthead */
  masthead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: space.xl,
    marginBottom: space.lg,
  },
  mastheadText: { flexShrink: 1, minWidth: 0 },
  overline: {
    ...t.overline,
    color: colors.bronze,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  screenTitle: { ...t.display, color: colors.gold },
  count: { alignItems: 'flex-end', flexShrink: 0, marginLeft: space.md, paddingBottom: 2 },
  countNumber: { ...t.heading, color: colors.goldBright },
  countLabel: { ...t.overline, color: colors.bronze, textTransform: 'uppercase' },

  /* search */
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    height: 44,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    ...t.body,
  },

  /* filters */
  filterBlock: { marginTop: space.lg, marginBottom: space.xl },
  filterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  filterLabel: {
    ...t.overline,
    color: colors.bronze,
    textTransform: 'uppercase',
  },
  filterLabelSpaced: { marginTop: space.lg, marginBottom: space.sm },
  clearAll: { ...t.caption, color: colors.goldBright },
  /**
   * A horizontal ScrollView inherits RNW's `flexGrow:1`, which in a column
   * parent is VERTICAL growth — it would absorb the page's slack and float the
   * chips. Pin it to its content height, and bleed it off both edges of the
   * column so the track runs to the screen edge the way the references do.
   */
  chipScroller: {
    flexGrow: 0,
    flexShrink: 0,
    marginHorizontal: -layout.gutter,
  },
  chipTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: layout.gutter,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    // NEVER `flex: 1` — that is what stretched controls to ~640px on desktop.
    paddingHorizontal: space.lg,
    minHeight: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  /** Solid gold. A hairline over a dark fill read as a strikethrough at this size. */
  chipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  chipLabel: { ...t.caption, fontSize: 13, color: colors.inkMuted },
  chipLabelActive: { color: colors.bg, fontWeight: '700' },
  chipDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.rule,
    marginHorizontal: space.xs,
  },

  /* results */
  results: { marginTop: space.xs },

  /* band cell */
  cellTitle: {
    ...t.title,
    fontSize: 14,
    lineHeight: 18,
    color: colors.gold,
    marginTop: space.sm,
  },
  cellAuthor: {
    ...t.caption,
    fontSize: 11,
    color: colors.bronze,
    fontStyle: 'italic',
    marginTop: 2,
  },
  cellMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  cellTier: { ...t.overline, fontSize: 9, color: colors.goldBright },
  cellSep: { ...t.overline, fontSize: 9, color: colors.bronze },
  cellDot: { width: 5, height: 5, borderRadius: radius.pill },
  cellStage: { ...t.overline, fontSize: 9, color: colors.inkMuted, flexShrink: 1 },

  /* card */
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.md,
    ...elevation.card,
  },
  cardBody: { flexDirection: 'row', alignItems: 'flex-start' },
  cardText: { flex: 1, minWidth: 0, marginLeft: space.lg },
  cardChevron: { marginLeft: space.sm, paddingTop: 4 },
  itemTitle: { ...t.title, color: colors.gold, marginBottom: 2 },
  itemAuthor: { ...t.caption, color: colors.bronze, fontStyle: 'italic', marginBottom: space.sm },
  itemDescription: { ...t.body, color: colors.inkMuted, marginBottom: space.md },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeSolid: { backgroundColor: 'rgba(201, 169, 97, 0.14)' },
  badgeDot: { width: 5, height: 5, borderRadius: radius.pill },
  badgeText: { fontFamily: fonts.ui, fontSize: 11, lineHeight: 16, letterSpacing: 0.4 },

  /* sources */
  sourcesSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
  sourcesLabel: { ...t.overline, color: colors.bronze, textTransform: 'uppercase' },
  sourcesList: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sourceButton: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  sourceButtonText: { ...t.caption, fontSize: 11, color: colors.gold },

  /* empty */
  empty: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xxxl,
  },
  emptyGlyph: {
    fontFamily: fonts.display,
    fontSize: 42,
    color: colors.bronze,
    marginBottom: space.lg,
  },
  emptyTitle: { ...t.heading, color: colors.gold, textAlign: 'center', marginBottom: space.sm },
  emptyBody: { ...t.body, color: colors.inkMuted, textAlign: 'center', maxWidth: 340 },
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

  /* footer */
  footer: { alignItems: 'center', paddingTop: space.lg },
  footerMark: { fontFamily: fonts.display, fontSize: 18, color: colors.rule },
});
