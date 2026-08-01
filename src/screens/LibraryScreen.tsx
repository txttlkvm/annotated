import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  TextInput,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { EbookService } from '../services/EbookService';
import { Book } from '../types';

const { width } = Dimensions.get('window');

export default function LibraryScreen({ navigation }: any) {
  const { books, addBook, settings } = useApp();
  const [filteredBooks, setFilteredBooks] = useState<Book[]>(books);
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'author'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isLoading, setIsLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      updateFilteredBooks();
    }, [books, searchText, sortBy])
  );

  const updateFilteredBooks = () => {
    let filtered = books.filter(b =>
      b.title.toLowerCase().includes(searchText.toLowerCase()) ||
      (b.author?.toLowerCase().includes(searchText.toLowerCase()))
    );

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'author':
          return (a.author || '').localeCompare(b.author || '');
        case 'recent':
        default:
          return b.lastReadDate - a.lastReadDate;
      }
    });

    setFilteredBooks(filtered);
  };

  const handleUploadBook = async () => {
    setIsLoading(true);
    try {
      const file = await EbookService.pickFile();
      if (!file) {
        setIsLoading(false);
        return;
      }

      const filePath = await EbookService.copyToLibrary(file.uri, file.name);
      const format = EbookService.getFileFormat(file.name);
      const parsed = await EbookService.parseEbook(filePath, format);

      const newBook: Omit<Book, 'id'> = {
        title: parsed.title || 'Untitled',
        author: parsed.author,
        filePath,
        fileName: file.name,
        fileFormat: format,
        fileSize: file.size || 0,
        currentProgress: 0,
        totalPages: parsed.totalPages,
        addedDate: Date.now(),
        lastReadDate: Date.now(),
        readingTimeMinutes: 0,
        isFinished: false,
        isFavorite: false,
      };

      await addBook(newBook);
      Alert.alert('Success', `Added "${newBook.title}" to your library`);
    } catch (error) {
      Alert.alert('Error', 'Failed to upload book. Please try again.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const BookCard = ({ book }: { book: Book }) => {
    const progress = (book.currentProgress / book.totalPages) * 100;

    if (viewMode === 'grid') {
      return (
        <TouchableOpacity
          style={[styles.gridCard, { backgroundColor: '#1a1328', borderColor: '#8b7355' }]}
          onPress={() => navigation.navigate('BookDetails', { bookId: book.id })}
        >
          <View style={[styles.gridCover, { borderColor: '#c9a961' }]}>
            <Text style={styles.coverSymbol}>✦</Text>
          </View>
          <Text style={[styles.gridTitle, { color: '#c9a961' }]} numberOfLines={2}>
            {book.title}
          </Text>
          <Text style={[styles.gridAuthor, { color: '#8b7355' }]} numberOfLines={1}>
            {book.author || '—'}
          </Text>
          <View style={[styles.progressBar, { borderColor: '#8b7355' }]}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={[styles.progressText, { color: '#8b7355' }]}>
            {Math.round(progress)}%
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.listCard, { backgroundColor: '#1a1328', borderColor: '#8b7355' }]}
        onPress={() => navigation.navigate('BookDetails', { bookId: book.id })}
      >
        <View style={[styles.listCover, { backgroundColor: '#2d1b4e', borderColor: '#c9a961' }]}>
          <Text style={styles.coverSymbolList}>✦</Text>
        </View>
        <View style={styles.listInfo}>
          <Text style={[styles.listTitle, { color: '#c9a961' }]} numberOfLines={1}>
            {book.title}
          </Text>
          <Text style={[styles.listAuthor, { color: '#8b7355' }]}>
            {book.author || '—'}
          </Text>
          <View style={styles.listMeta}>
            <Text style={[styles.metaText, { color: '#8b7355' }]}>
              {book.totalPages} pages • {(book.fileSize / 1024 / 1024).toFixed(1)}MB
            </Text>
          </View>
          <View style={[styles.progressBar, { borderColor: '#8b7355' }]}>
            <View style={[styles.progressFill, { width: `${(book.currentProgress / book.totalPages) * 100}%` }]} />
          </View>
        </View>
        <View style={styles.listStatus}>
          <Text style={[styles.pageNumber, { color: '#c9a961' }]}>{book.currentProgress}</Text>
          <Text style={[styles.pageLabel, { color: '#8b7355' }]}>p.</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: '#0f0a1a' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#1a1328', borderBottomColor: '#c9a961' }]}>
        <Text style={[styles.headerTitle, { color: '#c9a961' }]}>
          ✦ My Library
        </Text>
        <TouchableOpacity style={[styles.addButton, { borderColor: '#c9a961' }]} onPress={handleUploadBook} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#c9a961" size="small" />
          ) : (
            <Text style={[styles.addButtonText, { color: '#c9a961' }]}>+ Add</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Search & Filters */}
      <View style={[styles.searchSection, { backgroundColor: '#1a1328', borderBottomColor: '#8b7355' }]}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: '#2d1b4e',
              color: '#c9a961',
              borderColor: '#8b7355',
            },
          ]}
          placeholder="Seek a manuscript..."
          placeholderTextColor="#8b7355"
          value={searchText}
          onChangeText={setSearchText}
        />

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.sortButton, { borderColor: '#8b7355' }, sortBy === 'recent' && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' }]}
            onPress={() => setSortBy('recent')}
          >
            <Text style={[styles.sortButtonText, { color: '#c9a961' }]}>Recent</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, { borderColor: '#8b7355' }, sortBy === 'title' && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' }]}
            onPress={() => setSortBy('title')}
          >
            <Text style={[styles.sortButtonText, { color: '#c9a961' }]}>Title</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewButton, { borderColor: '#8b7355' }, viewMode === 'grid' && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' }]}
            onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          >
            <Text style={[styles.viewButtonText, { color: '#c9a961' }]}>{viewMode === 'list' ? '⊞' : '≡'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Books List/Grid */}
      {filteredBooks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✦</Text>
          <Text style={[styles.emptyText, { color: '#c9a961' }]}>
            {books.length === 0 ? 'Your Library Awaits' : 'No results found'}
          </Text>
          <Text style={[styles.emptySubtext, { color: '#8b7355' }]}>
            {books.length === 0 ? 'Tap "Add" to bring manuscripts into your collection' : 'Try a different search'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredBooks}
          renderItem={({ item }) => <BookCard book={item} />}
          keyExtractor={item => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          contentContainerStyle={styles.listContent}
          scrollEnabled={true}
        />
      )}
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
    borderBottomWidth: 2,
  },
  headerTitle: { fontSize: 20, fontWeight: '400', letterSpacing: 2, fontFamily: 'Georgia' },
  addButton: {
    backgroundColor: '#1a1328',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 2,
    borderWidth: 1,
  },
  addButtonText: { fontWeight: '400', letterSpacing: 1, fontSize: 12 },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 13,
    fontFamily: 'Georgia',
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#1a1328',
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
  },
  sortButtonText: { fontSize: 11, fontWeight: '400', letterSpacing: 1 },
  viewButton: {
    width: 40,
    paddingVertical: 8,
    backgroundColor: '#1a1328',
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
  },
  viewButtonText: { fontSize: 13, fontWeight: '300' },
  listContent: { padding: 12 },
  listCard: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 2,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  listCover: {
    width: 50,
    height: 70,
    borderRadius: 1,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  coverSymbolList: { fontSize: 28, fontWeight: '300' },
  listInfo: { flex: 1 },
  listTitle: { fontSize: 13, fontWeight: '400', marginBottom: 4, fontFamily: 'Georgia' },
  listAuthor: { fontSize: 11, marginBottom: 4, letterSpacing: 0.5 },
  listMeta: { marginBottom: 8 },
  metaText: { fontSize: 10, letterSpacing: 0.5 },
  progressBar: {
    height: 2,
    backgroundColor: '#3d3730',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#c9a961' },
  listStatus: { alignItems: 'center', marginLeft: 12 },
  pageNumber: { fontSize: 12, fontWeight: '300', letterSpacing: 1 },
  pageLabel: { fontSize: 9, marginTop: 2, letterSpacing: 1 },
  gridCard: {
    flex: 1,
    marginHorizontal: 6,
    marginBottom: 12,
    borderRadius: 2,
    borderWidth: 1,
    padding: 12,
  },
  gridCover: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#2d1b4e',
    borderRadius: 1,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  coverSymbol: { fontSize: 40, fontWeight: '300' },
  gridTitle: { fontSize: 12, fontWeight: '400', marginBottom: 4, fontFamily: 'Georgia' },
  gridAuthor: { fontSize: 10, marginBottom: 8, letterSpacing: 0.5 },
  progressText: { fontSize: 10, marginTop: 4, letterSpacing: 0.5 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: '400', marginBottom: 8, fontFamily: 'Georgia', letterSpacing: 1 },
  emptySubtext: { fontSize: 12, letterSpacing: 0.5 },
});
