import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  TextInput,
  FlatList,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { BOOKSHELF_THEMES } from '../types';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }: any) {
  const { books, settings } = useApp();
  const [bookshelfTheme, setBookshelfTheme] = useState('dark');
  const [viewMode, setViewMode] = useState<'shelf' | 'grid' | 'list'>('shelf');
  const [searchText, setSearchText] = useState('');
  const [showKidsMode, setShowKidsMode] = useState(false);

  const theme = BOOKSHELF_THEMES[bookshelfTheme];
  const recentBooks = books.slice(0, 6);
  const filteredBooks = books.filter(b =>
    b.title.toLowerCase().includes(searchText.toLowerCase())
  );

  const ShelfBook = ({ book, width: bookWidth }: any) => (
    <TouchableOpacity
      style={[
        styles.shelfBook,
        {
          width: bookWidth,
          backgroundColor: `${theme.accentColor}40`,
          borderColor: theme.accentColor,
        },
      ]}
      onPress={() => navigation.navigate('Reader', { bookId: book.id })}
    >
      <View style={styles.bookCover}>
        <Text style={styles.coverEmoji}>📖</Text>
        <View style={styles.progressOverlay}>
          <Text style={styles.progressPercent}>
            {Math.round((book.currentProgress / book.totalPages) * 100)}%
          </Text>
        </View>
      </View>
      <Text style={[styles.bookSpine, { color: theme.textColor }]} numberOfLines={2}>
        {book.title}
      </Text>
    </TouchableOpacity>
  );

  const GridBook = ({ book }: any) => (
    <TouchableOpacity
      style={[styles.gridBook, { backgroundColor: theme.shelfColor }]}
      onPress={() => navigation.navigate('Reader', { bookId: book.id })}
    >
      <View style={styles.gridCover}>
        <Text style={styles.coverEmoji}>📖</Text>
      </View>
      <Text style={[styles.gridTitle, { color: theme.textColor }]} numberOfLines={2}>
        {book.title}
      </Text>
      <View style={styles.gridProgress}>
        <View style={[styles.progressBar, { backgroundColor: theme.accentColor }]}>
          <View
            style={{
              height: '100%',
              backgroundColor: theme.accentColor,
              width: `${(book.currentProgress / book.totalPages) * 100}%`,
            }}
          />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (viewMode === 'shelf') {
    const bookWidth = (width - 48) / 3;

    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.backgroundColor },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.backgroundColor }]}>
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>
            📚 My Library
          </Text>
          <View style={styles.headerControls}>
            <TouchableOpacity
              onPress={() => setShowKidsMode(!showKidsMode)}
              style={[styles.kidsBtn, showKidsMode && styles.kidsBtnActive]}
            >
              <Text style={styles.kidsBtnText}>{showKidsMode ? '👧' : '👤'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setViewMode('grid')}>
              <Text style={[styles.viewIcon, { color: theme.textColor }]}>⊞</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: theme.shelfColor }]}>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.backgroundColor,
                color: theme.textColor,
                borderColor: theme.accentColor,
              },
            ]}
            placeholder="Search books..."
            placeholderTextColor={theme.accentColor}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* Shelves */}
        <ScrollView contentContainerStyle={styles.shelfContainer}>
          {/* Currently Reading */}
          {recentBooks.length > 0 && (
            <View style={styles.shelfSection}>
              <Text style={[styles.shelfLabel, { color: theme.textColor }]}>
                📖 Currently Reading
              </Text>
              <View style={[styles.shelf, { backgroundColor: theme.shelfColor }]}>
                {recentBooks.map(book => (
                  <ShelfBook key={book.id} book={book} width={bookWidth} />
                ))}
              </View>
            </View>
          )}

          {/* All Books */}
          {filteredBooks.length > 0 && (
            <View style={styles.shelfSection}>
              <Text style={[styles.shelfLabel, { color: theme.textColor }]}>
                📚 All Books ({filteredBooks.length})
              </Text>
              {Array.from({
                length: Math.ceil(filteredBooks.length / 3),
              }).map((_, shelfIndex) => (
                <View key={shelfIndex} style={[styles.shelf, { backgroundColor: theme.shelfColor }]}>
                  {filteredBooks
                    .slice(shelfIndex * 3, (shelfIndex + 1) * 3)
                    .map(book => (
                      <ShelfBook key={book.id} book={book} width={bookWidth} />
                    ))}
                </View>
              ))}
            </View>
          )}

          {/* Empty State */}
          {books.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyIcon, { color: theme.textColor }]}>📚</Text>
              <Text style={[styles.emptyText, { color: theme.textColor }]}>
                No books yet
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.accentColor }]}>
                Add your first ebook to begin
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // Grid View
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundColor },
      ]}
    >
      <View style={[styles.header, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>
          📚 My Library
        </Text>
        <TouchableOpacity onPress={() => setViewMode('shelf')}>
          <Text style={[styles.viewIcon, { color: theme.textColor }]}>≡</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBar, { backgroundColor: theme.shelfColor }]}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.backgroundColor,
              color: theme.textColor,
              borderColor: theme.accentColor,
            },
          ]}
          placeholder="Search books..."
          placeholderTextColor={theme.accentColor}
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      <FlatList
        data={filteredBooks}
        renderItem={({ item }) => <GridBook book={item} />}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        scrollEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  headerControls: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  kidsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kidsBtnActive: { backgroundColor: '#4A90E2' },
  kidsBtnText: { fontSize: 20 },
  viewIcon: { fontSize: 20 },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  shelfContainer: { padding: 16, paddingBottom: 32 },
  shelfSection: { marginBottom: 24 },
  shelfLabel: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  shelf: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 8,
    marginBottom: 8,
    minHeight: 140,
  },
  shelfBook: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bookCover: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 4,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  coverEmoji: { fontSize: 32 },
  progressOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  progressPercent: { fontSize: 10, color: '#fff', fontWeight: '600' },
  bookSpine: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  gridRow: { justifyContent: 'space-between', marginBottom: 16 },
  gridContent: { paddingHorizontal: 12, paddingVertical: 16 },
  gridBook: {
    width: '48%',
    borderRadius: 12,
    padding: 12,
  },
  gridCover: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#333',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  gridProgress: { height: 4, borderRadius: 2, backgroundColor: '#333', overflow: 'hidden' },
  progressBar: { height: '100%' },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { fontSize: 14 },
});
