import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { useApp } from '../context/AppContext';
import BookCover from '../components/BookCover';
import { coverFor } from '../data/gutenbergIds';
import { colors, fonts, space, radius, type, elevation } from '../theme';

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

const COVER_WIDTH = 68;

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function CurriculumScreen({ navigation }: any) {
  const {
    getClassicalLibrary,
    getClassicalLibraryByCategory,
    getClassicalLibraryByTier,
    getClassicalLibraryByStage,
    settings,
  } = useApp();
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

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
          label: TIER_SECTION[tier] || 'Unassigned',
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

  const filtersActive =
    !!selectedCategory || !!selectedTier || !!selectedStage || !!searchText;

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedTier(null);
    setSelectedStage(null);
    setSearchText('');
  };

  const handleViewItem = (item: any) => {
    navigation.navigate('ClassicalLibraryReader', { itemId: item.id });
  };

  const Chip = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      activeOpacity={0.75}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const Badge = ({
    label,
    ink,
    dot,
    solid,
  }: {
    label: string;
    ink: string;
    dot?: boolean;
    solid?: boolean;
  }) => (
    <View
      style={[
        styles.badge,
        { borderColor: solid ? ink : colors.border },
        solid && { backgroundColor: 'rgba(201, 169, 97, 0.14)' },
      ]}
    >
      {dot && <View style={[styles.badgeDot, { backgroundColor: ink }]} />}
      <Text style={[styles.badgeText, { color: ink }]}>{label}</Text>
    </View>
  );

  const CurriculumItem = ({ item }: { item: any }) => {
    const { id, title, author, tier, stage, description, type: itemType, grade, sources } = item;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => handleViewItem(item)}
      >
        <View style={styles.cardBody}>
          <BookCover
            uri={coverFor(id)}
            title={title}
            author={author}
            itemType={itemType}
            width={COVER_WIDTH}
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
              {!!TYPE_LABEL[itemType] && (
                <Badge label={TYPE_LABEL[itemType]} ink={colors.bronze} />
              )}
            </View>
          </View>

          <Text style={styles.chevron}>›</Text>
        </View>

        {sources && sources.length > 0 && (
          <View style={styles.sourcesSection}>
            <Text style={styles.sourcesLabel}>Free online</Text>
            <View style={styles.sourcesList}>
              {sources.slice(0, 2).map((source: any, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.sourceButton}
                  activeOpacity={0.7}
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
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Masthead */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.overline}>Classical Christian Education</Text>
            <Text style={styles.headerTitle}>Curriculum</Text>
          </View>
          <View style={styles.countBlock}>
            <Text style={styles.countNumber}>{items.length}</Text>
            <Text style={styles.countLabel}>
              {items.length === 1 ? 'entry' : 'entries'}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title or author"
            placeholderTextColor={colors.bronze}
            value={searchText}
            onChangeText={setSearchText}
          />
          {!!searchText && (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        <View style={styles.filterLabelRow}>
          <Text style={styles.filterLabel}>Category</Text>
          {filtersActive && (
            <TouchableOpacity onPress={clearFilters} activeOpacity={0.7}>
              <Text style={styles.clearAll}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
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

        <View style={[styles.filterLabelRow, styles.filterLabelSpaced]}>
          <Text style={styles.filterLabel}>Tier &amp; Stage</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
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
        <View style={styles.emptyState}>
          <Text style={styles.emptyGlyph}>❦</Text>
          <Text style={styles.emptyTitle}>Nothing in this part of the shelf</Text>
          <Text style={styles.emptyBody}>
            No texts match these filters. Widen the search or clear the filters to see the
            whole curriculum.
          </Text>
          {filtersActive && (
            <TouchableOpacity style={styles.emptyButton} activeOpacity={0.8} onPress={clearFilters}>
              <Text style={styles.emptyButtonText}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
          {sections.map(section => (
            <View key={section.key} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.label}</Text>
                <View style={styles.sectionRule} />
                <Text style={styles.sectionCount}>{section.items.length}</Text>
              </View>
              {section.items.map(item => (
                <CurriculumItem key={item.id} item={item} />
              ))}
            </View>
          ))}
          <View style={styles.listFooter}>
            <Text style={styles.listFooterText}>❦</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  /* Masthead */
  header: {
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerTitleBlock: { flex: 1 },
  overline: {
    ...type.overline,
    fontSize: 11,
    color: colors.bronze,
    textTransform: 'uppercase',
    marginBottom: space.xs,
  },
  headerTitle: {
    ...type.display,
    color: colors.gold,
  },
  countBlock: { alignItems: 'flex-end', paddingBottom: space.xs },
  countNumber: {
    ...type.heading,
    color: colors.goldBright,
  },
  countLabel: {
    ...type.overline,
    fontSize: 11,
    color: colors.bronze,
    textTransform: 'uppercase',
  },

  /* Search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.lg,
    paddingHorizontal: space.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
  },
  searchGlyph: {
    fontSize: 17,
    color: colors.bronze,
    marginRight: space.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: space.md,
    fontFamily: fonts.ui,
    fontSize: 15,
    color: colors.ink,
    // React Native Web draws a default focus ring that fights the gold border.
    outlineWidth: 0,
  } as any,
  searchClear: {
    ...type.caption,
    color: colors.bronze,
    paddingHorizontal: space.xs,
  },

  /* Filters */
  filters: {
    paddingTop: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  filterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
  },
  filterLabel: {
    ...type.overline,
    fontSize: 11,
    color: colors.bronze,
    textTransform: 'uppercase',
    marginBottom: space.sm,
  },
  filterLabelSpaced: { marginTop: space.lg },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.xs,
  },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.goldBright,
    ...elevation.card,
  },
  chipText: {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
    color: colors.inkMuted,
  },
  chipTextActive: {
    color: colors.bg,
    fontWeight: '600',
  },
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.rule,
    marginHorizontal: space.xs,
  },
  clearAll: {
    ...type.caption,
    color: colors.goldBright,
    marginBottom: space.sm,
  },

  /* List */
  listContainer: { flex: 1 },
  listContent: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xxxl },
  section: { marginBottom: space.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.sm,
    marginBottom: space.md,
  },
  sectionTitle: {
    ...type.heading,
    color: colors.gold,
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.rule,
  },
  sectionCount: {
    ...type.caption,
    color: colors.bronze,
  },

  /* Card */
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
  cardText: { flex: 1, marginLeft: space.lg },
  itemTitle: {
    ...type.title,
    color: colors.gold,
    marginBottom: 2,
  },
  itemAuthor: {
    ...type.caption,
    color: colors.bronze,
    marginBottom: space.sm,
  },
  itemDescription: {
    ...type.body,
    color: colors.inkMuted,
    marginBottom: space.md,
  },
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
  badgeDot: { width: 5, height: 5, borderRadius: radius.pill },
  badgeText: {
    fontFamily: fonts.ui,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  chevron: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    color: colors.bronze,
    marginLeft: space.sm,
  },

  /* Sources */
  sourcesSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
  sourcesLabel: {
    ...type.overline,
    fontSize: 11,
    color: colors.bronze,
    textTransform: 'uppercase',
  },
  sourcesList: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sourceButton: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  sourceButtonText: {
    ...type.caption,
    color: colors.gold,
  },

  /* Empty */
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.xxl,
  },
  emptyGlyph: {
    fontFamily: fonts.display,
    fontSize: 46,
    color: colors.bronze,
    marginBottom: space.lg,
  },
  emptyTitle: {
    ...type.heading,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  emptyBody: {
    ...type.body,
    color: colors.inkMuted,
    textAlign: 'center',
    maxWidth: 340,
  },
  emptyButton: {
    marginTop: space.xl,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.surface,
  },
  emptyButtonText: {
    ...type.caption,
    color: colors.goldBright,
  },

  listFooter: { alignItems: 'center', paddingVertical: space.xl },
  listFooterText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.rule,
  },
});
