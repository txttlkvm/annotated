import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { READER_THEMES } from '../types';

export default function HighlightsScreen() {
  const { currentBook, highlights, updateHighlight, deleteHighlight, settings } = useApp();
  const [searchText, setSearchText] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const theme = READER_THEMES[settings.theme];

  if (!currentBook) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.emptyText, { color: theme.textColor }]}>No highlights yet</Text>
      </View>
    );
  }

  const filteredHighlights = highlights.filter(h =>
    h.text.toLowerCase().includes(searchText.toLowerCase())
  );

  const colorFiltered = selectedColor
    ? filteredHighlights.filter(h => h.color === selectedColor)
    : filteredHighlights;

  const colors = ['yellow', 'orange', 'pink', 'green', 'blue', 'purple'];

  const handleDeleteHighlight = (id: string) => {
    Alert.alert('Delete Highlight', 'Remove this highlight?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteHighlight(id),
      },
    ]);
  };

  const HighlightCard = ({ id, text, color, page }: any) => (
    <View
      style={[
        styles.highlightCard,
        {
          backgroundColor: theme.selectionColor,
          borderLeftColor: color,
        },
      ]}
    >
      <Text style={[styles.highlightText, { color: theme.textColor }]}>"{text}"</Text>
      <View style={styles.cardFooter}>
        <Text style={[styles.pageText, { color: theme.textColor }]}>Page {page}</Text>
        <TouchableOpacity onPress={() => handleDeleteHighlight(id)}>
          <Text style={styles.deleteIcon}>🗑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.selectionColor }]}>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>✓ Highlights</Text>
        <Text style={[styles.count, { color: theme.accentColor }]}>{highlights.length}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.selectionColor,
              color: theme.textColor,
              borderColor: theme.accentColor,
            },
          ]}
          placeholder="Search highlights..."
          placeholderTextColor={theme.accentColor}
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* Color Filter */}
      <View style={styles.colorFilter}>
        <TouchableOpacity
          style={[
            styles.colorButton,
            selectedColor === null && { backgroundColor: theme.accentColor },
          ]}
          onPress={() => setSelectedColor(null)}
        >
          <Text style={styles.colorButtonText}>All</Text>
        </TouchableOpacity>
        {colors.map(color => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorDot,
              { backgroundColor: color },
              selectedColor === color && { borderColor: '#fff', borderWidth: 2 },
            ]}
            onPress={() => setSelectedColor(color)}
          />
        ))}
      </View>

      {/* Highlights List */}
      {colorFiltered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={[styles.emptyText, { color: theme.textColor }]}>
            {highlights.length === 0 ? 'No highlights yet' : 'No matches found'}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
          {colorFiltered.map(highlight => (
            <HighlightCard
              key={highlight.id}
              id={highlight.id}
              text={highlight.text}
              color={highlight.color}
              page={highlight.page}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  count: { fontSize: 14, fontWeight: '600' },
  searchSection: { paddingHorizontal: 16, paddingVertical: 12 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  colorFilter: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  colorButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  colorButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  listContainer: { flex: 1 },
  listContent: { padding: 12 },
  highlightCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  highlightText: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageText: { fontSize: 11, fontWeight: '600' },
  deleteIcon: { fontSize: 16 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: '600' },
});
