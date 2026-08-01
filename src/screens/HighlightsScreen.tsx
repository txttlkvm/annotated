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

  if (!currentBook) {
    return (
      <View style={[styles.container, { backgroundColor: '#0f0a1a' }]}>
        <Text style={[styles.emptyText, { color: '#c9a961' }]}>No passages yet</Text>
      </View>
    );
  }

  const filteredHighlights = highlights.filter(h =>
    h.text.toLowerCase().includes(searchText.toLowerCase())
  );

  const colorFiltered = selectedColor
    ? filteredHighlights.filter(h => h.color === selectedColor)
    : filteredHighlights;

  const colors = ['#d4a574', '#c9a961', '#b8860b', '#8b7355', '#5c4033', '#3e2723'];

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

  const HighlightCard = ({ id, text, color, page }: any) => (
    <View
      style={[
        styles.highlightCard,
        {
          backgroundColor: '#1a1328',
          borderColor: color || '#8b7355',
          borderLeftWidth: 3,
        },
      ]}
    >
      <Text style={[styles.highlightText, { color: '#c9a961' }]}>"{text}"</Text>
      <View style={styles.cardFooter}>
        <Text style={[styles.pageText, { color: '#8b7355' }]}>Page {page}</Text>
        <TouchableOpacity onPress={() => handleDeleteHighlight(id)}>
          <Text style={[styles.deleteIcon, { color: '#8b7355' }]}>—</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: '#0f0a1a' }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: '#c9a961' }]}>
        <Text style={[styles.headerTitle, { color: '#c9a961' }]}>✦ Sacred Passages</Text>
        <Text style={[styles.count, { color: '#8b7355' }]}>{highlights.length}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: '#2d1b4e',
              color: '#c9a961',
              borderColor: '#8b7355',
            },
          ]}
          placeholder="Search passages..."
          placeholderTextColor="#8b7355"
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* Color Filter */}
      <View style={styles.colorFilter}>
        <TouchableOpacity
          style={[
            styles.colorButton,
            { borderColor: '#8b7355' },
            selectedColor === null && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' },
          ]}
          onPress={() => setSelectedColor(null)}
        >
          <Text style={[styles.colorButtonText, { color: '#c9a961' }]}>All</Text>
        </TouchableOpacity>
        {colors.map(color => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorDot,
              { backgroundColor: color },
              selectedColor === color && { borderColor: '#c9a961', borderWidth: 2 },
            ]}
            onPress={() => setSelectedColor(color)}
          />
        ))}
      </View>

      {/* Highlights List */}
      {colorFiltered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyIcon, { color: '#c9a961' }]}>✦</Text>
          <Text style={[styles.emptyText, { color: '#c9a961' }]}>
            {highlights.length === 0 ? 'No passages yet' : 'No matches found'}
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
    borderBottomWidth: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: '400', letterSpacing: 2, fontFamily: 'Georgia' },
  count: { fontSize: 13, fontWeight: '400', letterSpacing: 1 },
  searchSection: { paddingHorizontal: 16, paddingVertical: 12 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Georgia',
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
    borderRadius: 2,
    backgroundColor: '#1a1328',
    borderWidth: 1,
  },
  colorButtonText: { fontSize: 11, fontWeight: '400', letterSpacing: 1 },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 2,
  },
  listContainer: { flex: 1 },
  listContent: { padding: 12 },
  highlightCard: {
    padding: 12,
    borderRadius: 2,
    marginBottom: 12,
  },
  highlightText: { fontSize: 12, lineHeight: 18, marginBottom: 8, fontStyle: 'italic', fontFamily: 'Georgia' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageText: { fontSize: 10, fontWeight: '400', letterSpacing: 1 },
  deleteIcon: { fontSize: 14, fontWeight: '300' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyText: { fontSize: 15, fontWeight: '400', fontFamily: 'Georgia', letterSpacing: 1 },
});
