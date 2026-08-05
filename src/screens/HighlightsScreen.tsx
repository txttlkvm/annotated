import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { colors, fonts, space, radius, type, elevation } from '../theme';
import Shell from '../components/Shell';
import type { Highlight } from '../types';

import { Alert } from '../components/Alert';
/**
 * The six ink colours a passage can be marked in. These hexes are stored on
 * existing highlights, so they must not change — only how they are presented.
 * ReaderScreen's HIGHLIGHT_SWATCHES writes a subset of these values; the two
 * lists must stay in sync or marks made in the reader cannot be filtered here.
 */
const HIGHLIGHT_COLORS: Array<{ value: string; name: string }> = [
  { value: '#d4a574', name: 'Amber' },
  { value: '#c9a961', name: 'Gold' },
  { value: '#b8860b', name: 'Ochre' },
  { value: '#8b7355', name: 'Bronze' },
  { value: '#5c4033', name: 'Umber' },
  { value: '#3e2723', name: 'Sepia' },
];

export default function HighlightsScreen() {
  const { currentBook, highlights, deleteHighlight } = useApp();
  const [searchText, setSearchText] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return highlights.filter((h) => {
      const matchesText =
        !q ||
        h.text.toLowerCase().includes(q) ||
        (h.note || '').toLowerCase().includes(q);
      const matchesColor = !selectedColor || h.color === selectedColor;
      return matchesText && matchesColor;
    });
  }, [highlights, searchText, selectedColor]);

  const handleDeleteHighlight = (id: string) => {
    Alert.alert('Remove Passage', 'Remove this highlighted passage?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteHighlight(id),
      },
    ]);
  };

  if (!currentBook) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyGlyph}>❧</Text>
          <Text style={styles.emptyTitle}>Nothing marked yet</Text>
          <Text style={styles.emptyBody}>
            Open a book and hold a line to keep it. Everything you mark gathers
            here, in the order you found it.
          </Text>
        </View>
      </View>
    );
  }

  const HighlightCard = ({ id, text, color, page, chapter, note }: Partial<Highlight> & { id: string }) => (
    <View style={styles.card}>
      <View style={[styles.cardSpine, { backgroundColor: color || colors.bronze }]} />

      <Text style={styles.quoteMark}>“</Text>
      <Text style={styles.passage}>{text}</Text>

      {!!note && (
        <View style={styles.noteBlock}>
          <Text style={styles.noteLabel}>NOTE</Text>
          <Text style={styles.noteText}>{note}</Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <View style={styles.locationRow}>
          <View style={styles.pagePill}>
            <Text style={styles.pagePillText}>PAGE {page ?? '—'}</Text>
          </View>
          {chapter != null && (
            <Text style={styles.chapterText}>Chapter {chapter}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleDeleteHighlight(id)}
        >
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Shell gutter={false} contentContainerStyle={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>MARGINALIA</Text>
          <Text style={styles.title}>Sacred Passages</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {currentBook.title}
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countNumber}>{highlights.length}</Text>
          <Text style={styles.countLabel}>
            {highlights.length === 1 ? 'MARK' : 'MARKS'}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.controls}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search passages…"
            placeholderTextColor={colors.bronze}
            value={searchText}
            onChangeText={setSearchText}
          />
          {!!searchText && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Colour filter */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.allPill, selectedColor === null && styles.allPillActive]}
            onPress={() => setSelectedColor(null)}
          >
            <Text
              style={[
                styles.allPillText,
                selectedColor === null && styles.allPillTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          {HIGHLIGHT_COLORS.map(({ value, name }) => {
            const active = selectedColor === value;
            return (
              <TouchableOpacity
                key={value}
                accessibilityLabel={name}
                style={[styles.swatchRing, active && styles.swatchRingActive]}
                onPress={() => setSelectedColor(active ? null : value)}
              >
                <View style={[styles.swatch, { backgroundColor: value }]} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Passages */}
      {visible.length === 0 ? (
        <View style={[styles.listContainer, styles.centered]}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyGlyph}>❧</Text>
            <Text style={styles.emptyTitle}>
              {highlights.length === 0 ? 'Nothing marked yet' : 'No matching passages'}
            </Text>
            <Text style={styles.emptyBody}>
              {highlights.length === 0
                ? 'Hold a line while reading to keep it. Marked passages gather here.'
                : 'Try a different search, or clear the colour filter.'}
            </Text>
            {highlights.length > 0 && (
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => {
                  setSearchText('');
                  setSelectedColor(null);
                }}
              >
                <Text style={styles.emptyCtaText}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {visible.length} passage{visible.length === 1 ? '' : 's'}
            </Text>
            <View style={styles.sectionRule} />
          </View>

          {visible.map((highlight) => (
            <HighlightCard
              key={highlight.id}
              id={highlight.id}
              text={highlight.text}
              color={highlight.color}
              page={highlight.page}
              chapter={highlight.chapter}
              note={highlight.note}
            />
          ))}
        </ScrollView>
      )}
    </Shell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { justifyContent: 'center', alignItems: 'center', padding: space.xl },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    backgroundColor: colors.surface,
  },
  headerText: { flex: 1 },
  eyebrow: { ...type.overline, color: colors.bronze, marginBottom: space.xs },
  title: { ...type.display, color: colors.goldBright, marginBottom: space.sm },
  subtitle: { ...type.body, color: colors.inkMuted, fontStyle: 'italic' },
  countBadge: {
    minWidth: 54,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
  },
  countNumber: { ...type.title, fontSize: 18, color: colors.goldBright },
  countLabel: { ...type.overline, color: colors.bronze, marginTop: 2 },

  /* Controls */
  controls: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  searchGlyph: { fontSize: 16, color: colors.bronze },
  searchInput: {
    flex: 1,
    paddingVertical: space.sm,
    fontFamily: fonts.ui,
    fontSize: 14,
    color: colors.ink,
  },
  searchClear: { fontSize: 13, color: colors.bronze, paddingHorizontal: space.xs },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.lg,
  },
  allPill: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  allPillActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.gold },
  allPillText: { ...type.caption, fontSize: 11, color: colors.bronze },
  allPillTextActive: { color: colors.goldBright },
  swatchRing: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchRingActive: { borderColor: colors.goldBright },
  swatch: { width: 20, height: 20, borderRadius: radius.pill },

  /* List */
  listContainer: { flex: 1 },
  listContent: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.lg,
  },
  sectionTitle: { ...type.caption, color: colors.bronze, letterSpacing: 1 },
  sectionRule: { flex: 1, height: 1, backgroundColor: colors.rule },

  /* Passage card */
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.xl,
    paddingRight: space.xl,
    paddingLeft: space.xl,
    marginBottom: space.lg,
    overflow: 'hidden',
    ...elevation.card,
  },
  cardSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  quoteMark: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 40,
    color: colors.gold,
    opacity: 0.35,
    marginBottom: -space.md,
  },
  passage: {
    fontFamily: fonts.reading,
    fontSize: 16,
    lineHeight: 27,
    color: colors.ink,
  },
  noteBlock: {
    marginTop: space.lg,
    paddingLeft: space.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.rule,
  },
  noteLabel: { ...type.overline, color: colors.bronze, marginBottom: space.xs },
  noteText: {
    fontFamily: fonts.reading,
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
    color: colors.inkMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xl,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pagePill: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.surfaceRaised,
  },
  pagePillText: { ...type.overline, color: colors.gold },
  chapterText: { ...type.caption, color: colors.bronze },
  removeButton: {
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
  },
  removeText: { ...type.caption, color: colors.danger },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingVertical: space.xxxl,
    paddingHorizontal: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.surface,
    maxWidth: 420,
  },
  emptyGlyph: { fontSize: 34, color: colors.bronze, marginBottom: space.lg },
  emptyTitle: { ...type.heading, color: colors.gold, marginBottom: space.sm },
  emptyBody: {
    ...type.body,
    color: colors.inkMuted,
    textAlign: 'center',
    maxWidth: 320,
  },
  emptyCta: {
    marginTop: space.xl,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  emptyCtaText: { ...type.caption, color: colors.goldBright, letterSpacing: 0.8 },
});
