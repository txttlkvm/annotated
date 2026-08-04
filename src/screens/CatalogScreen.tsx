import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useApp } from '../context/AppContext';
import type { ClassicalLibraryItem } from '../data/classicalLibrary';
import { coverFor, textUrlFor } from '../data/gutenbergIds';
import BookCover from '../components/BookCover';
import { colors, fonts, space, radius, type, elevation } from '../theme';

type TierFilter = 'all' | 1 | 2;
type StageFilter = 'all' | 'grammar' | 'logic' | 'rhetoric';

const COVER_WIDTH = 76;

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

const TYPE_GLYPH: Record<string, string> = {
  book: '❦',
  music: '♪',
  art: '✎',
  resource: '◆',
};

const ROMAN: Record<number, string> = { 1: 'I', 2: 'II' };

/** React Native Web paints a default focus ring that fights the gold border. */
const NO_FOCUS_RING = { outlineStyle: 'none' } as any;

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Pill filter control. Selected state is a gold wash — never a hairline that reads as a strikethrough. */
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
      activeOpacity={0.75}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Read-only metadata tag on a catalog card. */
function Tag({ label, emphasis }: { label: string; emphasis?: boolean }) {
  return (
    <View style={[styles.tag, emphasis && styles.tagEmphasis]}>
      <Text style={[styles.tagLabel, emphasis && styles.tagLabelEmphasis]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipTrack}
      >
        {children}
      </ScrollView>
    </View>
  );
}

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

      const results = library.filter(item => {
        if (bookIds.has(item.id)) return false; // Already in library
        if (tierFilter !== 'all' && item.tier !== tierFilter) return false;
        if (stageFilter !== 'all' && item.stage !== stageFilter) return false;
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        if (!query) return true;
        return (
          item.title.toLowerCase().includes(query) ||
          item.author.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
        );
      });

      // Same caps as before: a wider net once the reader has narrowed things
      // down, a browsable sample when they haven't.
      const limit = query || filtersActive ? 50 : 30;
      setFilteredItems(results.slice(0, limit));
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

  const ItemCard = ({ item }: { item: ClassicalLibraryItem }) => {
    const hasFullText = !!textUrlFor(item.id);

    return (
      <View style={styles.card}>
        <BookCover
          uri={coverFor(item.id)}
          title={item.title}
          author={item.author}
          itemType={item.type}
          width={COVER_WIDTH}
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
              <Tag label={`Tier ${ROMAN[item.tier] || item.tier}`} emphasis={item.tier === 1} />
            )}
            {!!item.stage && <Tag label={titleCase(item.stage)} />}
            <Tag label={`${TYPE_GLYPH[item.type] || TYPE_GLYPH.book}  ${titleCase(item.category)}`} />
            {typeof item.grade === 'number' && item.grade > 0 && (
              <Tag label={`Grade ${item.grade}`} />
            )}
          </View>

          <Text style={styles.cardDesc} numberOfLines={3}>
            {item.description}
          </Text>

          <View style={styles.cardFooter}>
            <TouchableOpacity
              style={styles.addButton}
              activeOpacity={0.8}
              onPress={() => handleAddItem(item)}
            >
              <Text style={styles.addButtonText}>Add to Library</Text>
            </TouchableOpacity>
            {hasFullText && <Text style={styles.sourceNote}>Full text available</Text>}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.overline}>The Great Books</Text>
        <Text style={styles.title}>Classical Catalog</Text>
        <View style={styles.titleRule} />
        <Text style={styles.subtitle}>Texts not yet on your shelf</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Search */}
        <View style={styles.searchField}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            placeholder="Search by title, author, or topic"
            placeholderTextColor={colors.bronze}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, NO_FOCUS_RING]}
            returnKeyType="search"
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.searchClear}>✕</Text>
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

          <FilterRow label="Stage">
            {STAGE_OPTIONS.map(opt => (
              <Chip
                key={opt.value}
                label={opt.label}
                active={stageFilter === opt.value}
                onPress={() => setStageFilter(opt.value)}
              />
            ))}
          </FilterRow>

          <FilterRow label="Subject">
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
            <Text style={styles.bannerText} numberOfLines={2}>
              “{justAdded}” added to your library
            </Text>
          </View>
        )}

        {/* Results */}
        {isSearching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={styles.loadingText}>Searching the catalog…</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
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
              <TouchableOpacity style={styles.emptyAction} onPress={clearFilters} activeOpacity={0.8}>
                <Text style={styles.emptyActionText}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <View style={styles.resultHeader}>
              <Text style={styles.resultCount}>
                {filteredItems.length} {filteredItems.length === 1 ? 'text' : 'texts'}
              </Text>
              {filtersActive && (
                <TouchableOpacity onPress={clearFilters} activeOpacity={0.7}>
                  <Text style={styles.resultClear}>Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>

            {filteredItems.map(item => (
              <ItemCard key={item.id} item={item} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    backgroundColor: colors.surface,
  },
  overline: {
    ...type.overline,
    color: colors.bronze,
    textTransform: 'uppercase',
    marginBottom: space.sm,
  },
  title: { ...type.display, color: colors.gold },
  titleRule: {
    height: 1,
    width: 56,
    backgroundColor: colors.gold,
    opacity: 0.55,
    marginTop: space.md,
    marginBottom: space.md,
  },
  subtitle: { ...type.body, color: colors.inkMuted },

  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.xxxl,
  },

  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    ...elevation.card,
  },
  searchGlyph: { fontSize: 18, color: colors.bronze },
  searchInput: {
    flex: 1,
    ...type.body,
    color: colors.ink,
    paddingVertical: space.xs,
  },
  searchClear: { fontSize: 14, color: colors.bronze, paddingHorizontal: space.xs },

  filters: { marginTop: space.xl, gap: space.lg },
  filterRow: { gap: space.sm },
  filterLabel: {
    ...type.overline,
    color: colors.bronze,
    textTransform: 'uppercase',
  },
  chipTrack: { flexDirection: 'row', gap: space.sm, paddingRight: space.lg, paddingVertical: 2 },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: 'rgba(201, 169, 97, 0.16)',
    borderColor: colors.gold,
  },
  chipLabel: { ...type.caption, color: colors.inkMuted },
  chipLabelActive: { color: colors.goldBright, fontWeight: '600' },

  banner: {
    marginTop: space.xl,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(127, 169, 107, 0.45)',
    backgroundColor: 'rgba(127, 169, 107, 0.12)',
  },
  bannerText: { ...type.body, color: colors.ink },

  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xxl,
    marginBottom: space.lg,
  },
  resultCount: { ...type.caption, color: colors.bronze, textTransform: 'uppercase', letterSpacing: 1 },
  resultClear: { ...type.caption, color: colors.gold },

  loadingContainer: { justifyContent: 'center', alignItems: 'center', marginVertical: space.xxxl },
  loadingText: { ...type.body, color: colors.inkMuted, marginTop: space.lg },

  emptyState: {
    marginTop: space.xxl,
    paddingHorizontal: space.xl,
    paddingVertical: space.xxxl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  emptyGlyph: { fontSize: 26, color: colors.bronze, marginBottom: space.md },
  emptyTitle: { ...type.heading, color: colors.gold, marginBottom: space.sm },
  emptyText: { ...type.body, color: colors.inkMuted, textAlign: 'center', maxWidth: 320 },
  emptyAction: {
    marginTop: space.xl,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  emptyActionText: { ...type.caption, color: colors.goldBright, fontWeight: '600' },

  card: {
    flexDirection: 'row',
    gap: space.lg,
    padding: space.lg,
    marginBottom: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'flex-start',
    ...elevation.card,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { ...type.title, color: colors.ink, marginBottom: 2 },
  cardAuthor: { ...type.caption, color: colors.bronze, marginBottom: space.md },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  tag: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.surfaceRaised,
  },
  tagEmphasis: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(201, 169, 97, 0.14)',
  },
  tagLabel: { ...type.caption, fontSize: 11, color: colors.inkMuted },
  tagLabelEmphasis: { color: colors.goldBright, fontWeight: '600' },

  cardDesc: { ...type.body, color: colors.inkMuted, marginBottom: space.lg },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  addButton: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
  },
  addButtonText: {
    fontFamily: fonts.ui,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: colors.bg,
  },
  sourceNote: { ...type.caption, fontSize: 11, color: colors.bronze },
});
