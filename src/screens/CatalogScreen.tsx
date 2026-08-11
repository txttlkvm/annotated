// CatalogScreen — everything in the classical library that is NOT yet on the
// reader's shelf, and the one place a text gets added to it.
//
// Rebuilt on the shared primitives:
//
// 1. <Shell>. The screen had no width cap, so on a 1365px desktop each card was
//    a 76px cover marooned beside 1200px of description, and the three filter
//    tracks ran the full viewport. Everything now sits in the centred
//    phone-width column, and the cover width is derived from
//    `useColumnWidth()` — never from `Dimensions.get('window')`.
//
// 2. Covers are the hero: 76px → 92–118px, drawn by <BookCover> from
//    `coverFor(item.id)` (keyed by CATALOG ITEM id, which is what that map is
//    keyed by), with the typographic board as the fallback.
//
// 3. ONE accent per row. "Add to Library" is the single next action on this
//    screen, so it is the only thing wearing `colors.action`. Everything else —
//    chips, tags, the result count — is neutral gold or bronze. The chips'
//    selected state is a solid gold fill; the old hairline-over-dark version
//    read as a strikethrough, i.e. as "excluded" rather than "chosen".
//
// FILTERING AND ADD BEHAVIOUR ARE UNCHANGED: the same exclusion of
// already-shelved ids, the same tier/stage/category predicates, and the same
// add path — `addClassicalLibraryItem`, the optimistic removal from the
// results, and the inline confirmation banner that exists because
// react-native-web does not implement `Alert.alert`. Search ranking and the
// result cap were fixed separately -- see matchRank() and the 150 constant
// below.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useApp } from '../context/AppContext';
import type { ClassicalLibraryItem } from '../data/classicalLibrary';
import { coverFor, textUrlFor } from '../data/gutenbergIds';
import BookCover from '../components/BookCover';
import Shell, { useColumnWidth } from '../components/Shell';
import Section from '../components/Section';
import { SearchIcon, CloseIcon, CheckIcon, PlusIcon } from '../components/icons';
import { colors, fonts, space, radius, type as t, elevation, layout } from '../theme';

import { Alert } from '../components/Alert';
type TierFilter = 'all' | 1 | 2;
type StageFilter = 'all' | 'grammar' | 'logic' | 'rhetoric';

const TIER_OPTIONS: Array<{ value: TierFilter; label: string }> = [
  { value: 'all', label: 'All tiers' },
  { value: 1, label: 'Tier I · Core' },
  { value: 2, label: 'Tier II' },
];

const STAGE_OPTIONS: Array<{ value: StageFilter; label: string }> = [
  { value: 'all', label: 'All stages' },
  { value: 'grammar', label: 'Grammar' },
  { value: 'logic', label: 'Logic' },
  { value: 'rhetoric', label: 'Rhetoric' },
];

const TYPE_LABEL: Record<string, string> = {
  music: 'Music',
  art: 'Art',
  resource: 'Resource',
};

/** Rubrication: one ink per stage of the trivium, same family as Curriculum. */
const STAGE_INK: Record<string, string> = {
  grammar: colors.success,
  logic: colors.gold,
  rhetoric: colors.danger,
};

const ROMAN: Record<number, string> = { 1: 'I', 2: 'II' };

/** React Native Web paints a focus ring and a border that fight the pill's own. */
const NO_FOCUS_RING = { outlineStyle: 'none', borderWidth: 0 } as any;

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

// ---------------------------------------------------------------------------
// Pieces. Module level, never declared inside the screen: a component declared
// in a render body is a new type on every render, so React would rebuild the
// search field on each keystroke and drop its focus.
// ---------------------------------------------------------------------------

/** Filter pill. Selected is a solid gold fill with dark ink and a check. */
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

/** Read-only metadata tag on a catalog card. */
function Tag({
  label,
  ink = colors.inkMuted,
  dot,
  emphasis,
}: {
  label: string;
  ink?: string;
  dot?: boolean;
  emphasis?: boolean;
}) {
  return (
    <View style={[styles.tag, emphasis && styles.tagEmphasis]}>
      {dot && <View style={[styles.tagDot, { backgroundColor: ink }]} />}
      <Text
        style={[styles.tagLabel, { color: ink }, emphasis && styles.tagLabelEmphasis]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/** A labelled, edge-bleeding track of filter pills. */
function FilterRow({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={style}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroller}
        contentContainerStyle={styles.chipTrack}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * One catalog row: large cover, the metadata that decides whether it belongs on
 * the shelf, and the single accent-coloured action.
 */
function ItemCard({
  item,
  coverWidth,
  onAdd,
}: {
  item: ClassicalLibraryItem;
  coverWidth: number;
  onAdd: (item: ClassicalLibraryItem) => void;
}) {
  const hasFullText = !!textUrlFor(item.id);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <BookCover
          uri={coverFor(item.id)}
          title={item.title}
          author={item.author}
          itemType={item.type}
          width={coverWidth}
          compact
        />

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.cardAuthor} numberOfLines={1}>
            {item.author}
          </Text>

          <View style={styles.tagRow}>
            {!!item.tier && (
              <Tag
                label={`Tier ${ROMAN[item.tier] || item.tier}`}
                ink={item.tier === 1 ? colors.goldBright : colors.bronze}
                emphasis={item.tier === 1}
              />
            )}
            {!!item.stage && (
              <Tag label={titleCase(item.stage)} ink={STAGE_INK[item.stage] || colors.bronze} dot />
            )}
            <Tag label={titleCase(item.category)} ink={colors.inkMuted} />
            {!!TYPE_LABEL[item.type] && <Tag label={TYPE_LABEL[item.type]} ink={colors.bronze} />}
            {typeof item.grade === 'number' && item.grade > 0 && (
              <Tag label={`Grade ${item.grade}`} ink={colors.bronze} />
            )}
          </View>

          {/* Inside the text column, not under the row: a 118px cover stands
              ~177px tall, and a description slung beneath the whole row would
              leave that much dead space beside it. */}
          <Text style={styles.cardDesc} numberOfLines={3}>
            {item.description}
          </Text>
        </View>
      </View>

      {/* THE action. Nothing else on this screen may wear this colour. */}
      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={styles.addButton}
          activeOpacity={0.9}
          onPress={() => onAdd(item)}
          accessibilityRole="button"
          accessibilityLabel={`Add ${item.title} to your library`}
        >
          <PlusIcon size={13} color={colors.actionInk} strokeWidth={2.4} />
          <Text style={styles.addButtonText}>Add to Library</Text>
        </TouchableOpacity>

        {hasFullText && <Text style={styles.sourceNote}>Full text available</Text>}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

export default function CatalogScreen() {
  const { getClassicalLibrary, books, addClassicalLibraryItem } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filteredItems, setFilteredItems] = useState<ClassicalLibraryItem[]>([]);
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // THE fix for the desktop defect: sizes come from the capped column, not the
  // window. The gutter is applied by Shell's contentContainerStyle rather than
  // by Shell itself, so it has to be passed to the hook explicitly.
  const col = useColumnWidth(undefined, layout.gutter);
  const coverW = clamp(Math.round(col * 0.28), 92, 118);

  // Categories are derived from the data rather than hardcoded so the chips
  // never drift from the library.
  const categories = useMemo(() => {
    try {
      const seen = new Set<string>();
      getClassicalLibrary().forEach(item => {
        if (item.category) seen.add(item.category);
      });
      return Array.from(seen).sort();
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    performSearch();
  }, [searchQuery, tierFilter, stageFilter, categoryFilter, books]);

  useEffect(
    () => () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    },
    []
  );

  const filtersActive =
    tierFilter !== 'all' || stageFilter !== 'all' || categoryFilter !== 'all';

  const performSearch = () => {
    setIsSearching(true);

    try {
      const library = getClassicalLibrary();
      const bookIds = new Set(books.map(b => b.id));
      const query = searchQuery.trim().toLowerCase();

      // Match rank: 0 = title, 1 = author, 2 = description ("topic" per the
      // placeholder). Description is only searched for queries of 4+ chars --
      // a short query like "Ili" is a substring of enough ordinary English
      // words (Ilium, civilization, hostility...) to flood long description
      // prose with noise. Results are sorted by rank so title/author matches
      // -- what the placeholder leads with -- always surface above
      // description-only matches instead of interleaving by array order.
      const matchRank = (item: ClassicalLibraryItem): number => {
        if (!query) return 0;
        const q = query;
        if (item.title.toLowerCase().includes(q)) return 0;
        if (item.author.toLowerCase().includes(q)) return 1;
        if (q.length >= 4 && item.description.toLowerCase().includes(q)) return 2;
        return -1;
      };

      const results = library
        .filter(item => {
          if (bookIds.has(item.id)) return false; // Already in library
          if (tierFilter !== 'all' && item.tier !== tierFilter) return false;
          if (stageFilter !== 'all' && item.stage !== stageFilter) return false;
          if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
          return matchRank(item) >= 0;
        })
        .sort((a, b) => matchRank(a) - matchRank(b));

      // The catalog is small (127 items total) -- cap high enough that
      // nothing is silently hidden. The old 30-item default-view cap
      // combined with tier ordering in the source data (Tier I listed
      // before Tier II) meant every one of the 32 Tier II texts was
      // invisible whenever "All tiers" -- the active, checked filter --
      // was selected, which read as a real bug, not a curated sample.
      setFilteredItems(results.slice(0, 150));
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Could not search catalog');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddItem = async (item: ClassicalLibraryItem) => {
    try {
      await addClassicalLibraryItem(item);
      Alert.alert('Added', `"${item.title}" added to your library`);
      setFilteredItems(prev => prev.filter(i => i.id !== item.id));
      // Alert is a no-op on web, so confirm inline as well.
      setJustAdded(item.title);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => setJustAdded(null), 4000);
    } catch (error) {
      Alert.alert('Error', 'Could not add item to library');
    }
  };

  const clearFilters = () => {
    setTierFilter('all');
    setStageFilter('all');
    setCategoryFilter('all');
  };

  const resultCount = filteredItems.length;

  return (
    // gutter={false} + an explicit gutter on the column, so the scroller's clip
    // box stays the full window and no card shadow is sheared at the edge.
    <Shell scroll gutter={false} contentContainerStyle={styles.content}>
      {/* Masthead */}
      <View style={styles.masthead}>
        <Text style={styles.overline}>THE GREAT BOOKS</Text>
        <Text style={styles.screenTitle}>Classical Catalog</Text>
        <View style={styles.titleRule} />
        <Text style={styles.subtitle}>Texts not yet on your shelf</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <SearchIcon size={16} color={colors.bronze} strokeWidth={1.8} />
        <TextInput
          placeholder="Search by title, author, or topic"
          placeholderTextColor={colors.bronze}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[styles.searchInput, NO_FOCUS_RING]}
          returnKeyType="search"
          accessibilityLabel="Search the catalog"
        />
        {!!searchQuery && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <CloseIcon size={14} color={colors.bronze} strokeWidth={1.8} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        <FilterRow label="Tier">
          {TIER_OPTIONS.map(opt => (
            <Chip
              key={String(opt.value)}
              label={opt.label}
              active={tierFilter === opt.value}
              onPress={() => setTierFilter(opt.value)}
            />
          ))}
        </FilterRow>

        <FilterRow label="Stage" style={styles.filterRowSpaced}>
          {STAGE_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={opt.label}
              active={stageFilter === opt.value}
              onPress={() => setStageFilter(opt.value)}
            />
          ))}
        </FilterRow>

        <FilterRow label="Subject" style={styles.filterRowSpaced}>
          <Chip
            label="All subjects"
            active={categoryFilter === 'all'}
            onPress={() => setCategoryFilter('all')}
          />
          {categories.map(cat => (
            <Chip
              key={cat}
              label={titleCase(cat)}
              active={categoryFilter === cat}
              onPress={() => setCategoryFilter(cat)}
            />
          ))}
        </FilterRow>
      </View>

      {!!justAdded && (
        <View style={styles.banner}>
          <View style={styles.bannerMark}>
            <CheckIcon size={12} color={colors.success} strokeWidth={2.6} />
          </View>
          <Text style={styles.bannerText} numberOfLines={2}>
            “{justAdded}” added to your library
          </Text>
        </View>
      )}

      {/* Results */}
      {isSearching ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.loadingText}>Searching the catalog…</Text>
        </View>
      ) : resultCount === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyGlyph}>❦</Text>
          <Text style={styles.emptyTitle}>
            {searchQuery || filtersActive ? 'Nothing matches' : 'Catalog complete'}
          </Text>
          <Text style={styles.emptyText}>
            {searchQuery || filtersActive
              ? 'Try a different term, or widen the filters.'
              : 'Every text in the catalog is already on your shelf.'}
          </Text>
          {filtersActive && (
            <TouchableOpacity
              style={styles.ghostButton}
              onPress={clearFilters}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.ghostButtonText}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <Section
          title={searchQuery.trim() ? 'Results' : 'Available Texts'}
          subtitle={`${resultCount} ${resultCount === 1 ? 'text' : 'texts'} not yet on your shelf`}
          actionLabel={filtersActive ? 'Clear filters' : undefined}
          onAction={filtersActive ? clearFilters : undefined}
          hideActionChevron
          style={styles.results}
          last
        >
          {filteredItems.map(item => (
            <ItemCard key={item.id} item={item} coverWidth={coverW} onAdd={handleAddItem} />
          ))}
        </Section>
      )}
    </Shell>
  );
}

const styles = StyleSheet.create({
  /** The page gutter lives on the column, not on Shell. */
  content: { paddingHorizontal: layout.gutter },

  /* masthead */
  masthead: { paddingTop: space.xl, marginBottom: space.lg },
  overline: {
    ...t.overline,
    color: colors.bronze,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  screenTitle: { ...t.display, color: colors.gold },
  titleRule: {
    height: 1,
    width: 56,
    backgroundColor: colors.gold,
    opacity: 0.55,
    marginTop: space.md,
    marginBottom: space.md,
  },
  subtitle: { ...t.body, color: colors.inkMuted },

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
  filters: { marginTop: space.lg, marginBottom: space.xl },
  filterRowSpaced: { marginTop: space.md },
  filterLabel: {
    ...t.overline,
    color: colors.bronze,
    textTransform: 'uppercase',
    marginBottom: space.sm,
  },
  /**
   * RNW gives every ScrollView `flexGrow:1`; in a column parent that is
   * VERTICAL growth, which would let a chip track absorb the page's slack.
   * Pin it, and bleed it off both edges so the pills run to the screen edge.
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
  /** Solid gold. A hairline over a dark fill read as a strikethrough. */
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipLabel: { ...t.caption, fontSize: 13, color: colors.inkMuted },
  chipLabelActive: { color: colors.bg, fontWeight: '700' },

  /* banner */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xl,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(127, 169, 107, 0.45)',
    backgroundColor: 'rgba(127, 169, 107, 0.12)',
  },
  bannerMark: { width: 16, alignItems: 'center' },
  bannerText: { ...t.body, color: colors.ink, flex: 1, minWidth: 0 },

  /* results */
  results: { marginTop: space.xs },

  /* card */
  card: {
    padding: space.lg,
    marginBottom: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  cardBody: { flex: 1, minWidth: 0, marginLeft: space.lg },
  cardTitle: { ...t.title, color: colors.gold, marginBottom: 2 },
  cardAuthor: {
    ...t.caption,
    color: colors.bronze,
    fontStyle: 'italic',
    marginBottom: space.md,
  },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.surfaceRaised,
  },
  tagEmphasis: { borderColor: colors.border, backgroundColor: 'rgba(201, 169, 97, 0.14)' },
  tagDot: { width: 5, height: 5, borderRadius: radius.pill },
  tagLabel: { fontFamily: fonts.ui, fontSize: 11, lineHeight: 16, letterSpacing: 0.4 },
  tagLabelEmphasis: { fontWeight: '700' },

  cardDesc: { ...t.body, color: colors.inkMuted, marginTop: space.md },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    flexWrap: 'wrap',
    marginTop: space.lg,
  },
  /** THE action. One colour, one job. */
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: space.lg,
    minHeight: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.action,
  },
  addButtonText: {
    fontFamily: fonts.ui,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.actionInk,
  },
  sourceNote: { ...t.caption, fontSize: 11, color: colors.bronze },

  /* loading + empty */
  loading: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.xxxl },
  loadingText: { ...t.body, color: colors.inkMuted, marginTop: space.lg },
  empty: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xxxl,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyGlyph: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.bronze,
    marginBottom: space.md,
  },
  emptyTitle: { ...t.heading, color: colors.gold, marginBottom: space.sm, textAlign: 'center' },
  emptyText: { ...t.body, color: colors.inkMuted, textAlign: 'center', maxWidth: 320 },
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
});
