import React, { useState } from 'react';
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
import { useApp } from '../context/AppContext';
import { BOOKSHELF_THEMES } from '../types';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }: any) {
  const { books } = useApp();
  const [bookshelfTheme, setBookshelfTheme] = useState('byzantine');
  const [viewMode, setViewMode] = useState<'shelf' | 'grid'>('shelf');
  const [searchText, setSearchText] = useState('');

  const theme = BOOKSHELF_THEMES[bookshelfTheme];
  const recentBooks = books.slice(0, 4);
  const filteredBooks = books.filter(b =>
    b.title.toLowerCase().includes(searchText.toLowerCase())
  );

  const ShelfBook = ({ book, width: bookWidth }: any) => (
    <TouchableOpacity
      style={[styles.shelfBook, { width: bookWidth, borderColor: theme.accentColor }]}
      onPress={() => navigation.navigate('Reader', { bookId: book.id })}
    >
      <View style={[styles.bookCover, { backgroundColor: theme.shelfColor, borderColor: theme.accentColor }]}>
        <Text style={[styles.coverText, { color: theme.textColor }]}>✦</Text>
        <View style={styles.progressOverlay}>
          <Text style={[styles.progressPercent, { color: theme.textColor }]}>
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
      style={[styles.gridBook, { backgroundColor: theme.shelfColor, borderColor: theme.accentColor }]}
      onPress={() => navigation.navigate('Reader', { bookId: book.id })}
    >
      <View style={[styles.gridCover, { borderColor: theme.accentColor }]}>
        <Text style={[styles.coverTextLarge, { color: theme.accentColor }]}>✦</Text>
      </View>
      <Text style={[styles.gridTitle, { color: theme.textColor }]} numberOfLines={2}>
        {book.title}
      </Text>
      <Text style={[styles.gridAuthor, { color: theme.accentColor }]} numberOfLines={1}>
        {book.author || '—'}
      </Text>
    </TouchableOpacity>
  );

  if (viewMode === 'shelf') {
    const bookWidth = (width - 48) / 3;

    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.accentColor }]}>
          <View>
            <Text style={[styles.headerTitle, { color: theme.accentColor }]}>
              ✦ Library ✦
            </Text>
            <Text style={[styles.headerSub, { color: theme.accentColor }]}>
              A Sacred Collection
            </Text>
          </View>
          <TouchableOpacity onPress={() => setViewMode('grid')} style={styles.headerBtn}>
            <Text style={[styles.headerBtnText, { color: theme.accentColor }]}>≡</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { borderBottomColor: theme.accentColor }]}>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.shelfColor,
                color: theme.textColor,
                borderColor: theme.accentColor,
              },
            ]}
            placeholder="Seek a manuscript..."
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
              <Text style={[styles.shelfLabel, { color: theme.accentColor }]}>
                ✦ Currently Reading
              </Text>
              <View style={[styles.shelf, { borderTopColor: theme.accentColor, borderTopWidth: 1 }]}>
                {recentBooks.map(book => (
                  <ShelfBook key={book.id} book={book} width={bookWidth} />
                ))}
              </View>
            </View>
          )}

          {/* All Books */}
          {filteredBooks.length > 0 && (
            <View style={styles.shelfSection}>
              <Text style={[styles.shelfLabel, { color: theme.accentColor }]}>
                ✦ Complete Collection ({filteredBooks.length})
              </Text>
              {Array.from({
                length: Math.ceil(filteredBooks.length / 3),
              }).map((_, shelfIndex) => (
                <View key={shelfIndex} style={[styles.shelf, { borderTopColor: theme.accentColor, borderTopWidth: 1 }]}>
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
              <Text style={[styles.emptyText, { color: theme.accentColor }]}>
                ✦ ✦ ✦
              </Text>
              <Text style={[styles.emptyTitle, { color: theme.textColor }]}>
                Your Library Awaits
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.accentColor }]}>
                Begin your sacred journey with a manuscript
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // Grid View
  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { borderBottomColor: theme.accentColor }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.accentColor }]}>
            ✦ Library ✦
          </Text>
          <Text style={[styles.headerSub, { color: theme.accentColor }]}>
            A Sacred Collection
          </Text>
        </View>
        <TouchableOpacity onPress={() => setViewMode('shelf')} style={styles.headerBtn}>
          <Text style={[styles.headerBtnText, { color: theme.accentColor }]}>⊞</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBar, { borderBottomColor: theme.accentColor }]}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.shelfColor,
              color: theme.textColor,
              borderColor: theme.accentColor,
            },
          ]}
          placeholder="Seek a manuscript..."
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
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: 3,
    fontFamily: 'Georgia',
  },
  headerSub: {
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 2,
    fontStyle: 'italic',
  },
  headerBtn: {
    padding: 8,
  },
  headerBtnText: {
    fontSize: 20,
    fontWeight: '300',
  },
  searchBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'Georgia',
    letterSpacing: 1,
  },
  shelfContainer: { padding: 16, paddingBottom: 32 },
  shelfSection: { marginBottom: 32 },
  shelfLabel: {
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 16,
    letterSpacing: 2,
    fontFamily: 'Georgia',
  },
  shelf: {
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 0,
    gap: 12,
    marginBottom: 0,
    minHeight: 160,
  },
  shelfBook: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bookCover: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 1,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  coverText: {
    fontSize: 36,
    fontWeight: '300',
  },
  progressOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  progressPercent: { fontSize: 9, fontWeight: '400', letterSpacing: 1 },
  bookSpine: { fontSize: 11, fontWeight: '400', textAlign: 'center', letterSpacing: 0.5, fontFamily: 'Georgia' },
  gridRow: { justifyContent: 'space-between', marginBottom: 16 },
  gridContent: { paddingHorizontal: 16, paddingVertical: 16 },
  gridBook: {
    width: '48%',
    borderRadius: 2,
    borderWidth: 1,
    padding: 12,
  },
  gridCover: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 1,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  coverTextLarge: {
    fontSize: 40,
    fontWeight: '300',
  },
  gridTitle: { fontSize: 12, fontWeight: '400', marginBottom: 4, fontFamily: 'Georgia', letterSpacing: 0.5 },
  gridAuthor: { fontSize: 10, letterSpacing: 1, fontStyle: 'italic' },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 28, marginBottom: 20, letterSpacing: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '300', marginBottom: 12, fontFamily: 'Georgia' },
  emptySubtext: { fontSize: 11, letterSpacing: 1, fontStyle: 'italic' },
});
