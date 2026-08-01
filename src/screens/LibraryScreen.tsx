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
          style={[styles.gridCard, { backgroundColor: settings.theme === 'light' ? '#f5f5f5' : '#2a2a2a' }]}
          onPress={() => navigation.navigate('BookDetails', { bookId: book.id })}
        >
          <View style={styles.gridCover}>
            <Text style={styles.coverEmoji}>📖</Text>
          </View>
          <Text style={[styles.gridTitle, { color: settings.theme === 'light' ? '#000' : '#fff' }]} numberOfLines={2}>
            {book.title}
          </Text>
          <Text style={[styles.gridAuthor, { color: settings.theme === 'light' ? '#666' : '#aaa' }]} numberOfLines={1}>
            {book.author || 'Unknown'}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={[styles.progressText, { color: settings.theme === 'light' ? '#666' : '#aaa' }]}>
            {Math.round(progress)}%
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.listCard, { backgroundColor: settings.theme === 'light' ? '#f5f5f5' : '#2a2a2a' }]}
        onPress={() => navigation.navigate('BookDetails', { bookId: book.id })}
      >
        <View style={styles.listCover}>
          <Text style={styles.coverEmojiList}>📖</Text>
        </View>
        <View style={styles.listInfo}>
          <Text style={[styles.listTitle, { color: settings.theme === 'light' ? '#000' : '#fff' }]} numberOfLines={1}>
            {book.title}
          </Text>
          <Text style={[styles.listAuthor, { color: settings.theme === 'light' ? '#666' : '#aaa' }]}>
            {book.author || 'Unknown Author'}
          </Text>
          <View style={styles.listMeta}>
            <Text style={[styles.metaText, { color: settings.theme === 'light' ? '#999' : '#888' }]}>
              {book.totalPages} pages • {(book.fileSize / 1024 / 1024).toFixed(1)}MB
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(book.currentProgress / book.totalPages) * 100}%` }]} />
          </View>
        </View>
        <View style={styles.listStatus}>
          <Text style={styles.pageNumber}>{book.currentProgress}</Text>
          <Text style={[styles.pageLabel, { color: settings.theme === 'light' ? '#999' : '#888' }]}>pages</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: settings.theme === 'light' ? '#fff' : '#1a1a1a' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: settings.theme === 'light' ? '#f5f5f5' : '#1a1a1a' }]}>
        <Text style={[styles.headerTitle, { color: settings.theme === 'light' ? '#000' : '#fff' }]}>
          My Library
        </Text>
        <TouchableOpacity style={styles.addButton} onPress={handleUploadBook} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.addButtonText}>+ Add</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Search & Filters */}
      <View style={[styles.searchSection, { backgroundColor: settings.theme === 'light' ? '#f5f5f5' : '#1a1a1a' }]}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: settings.theme === 'light' ? '#e0e0e0' : '#2a2a2a',
              color: settings.theme === 'light' ? '#000' : '#fff',
              borderColor: settings.theme === 'light' ? '#d0d0d0' : '#333',
            },
          ]}
          placeholder="Search books..."
          placeholderTextColor={settings.theme === 'light' ? '#999' : '#666'}
          value={searchText}
          onChangeText={setSearchText}
        />

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'recent' && styles.sortButtonActive]}
            onPress={() => setSortBy('recent')}
          >
            <Text style={styles.sortButtonText}>Recent</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'title' && styles.sortButtonActive]}
            onPress={() => setSortBy('title')}
          >
            <Text style={styles.sortButtonText}>Title</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewButton, viewMode === 'grid' && styles.viewButtonActive]}
            onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          >
            <Text style={styles.viewButtonText}>{viewMode === 'list' ? '⊞' : '≡'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Books List/Grid */}
      {filteredBooks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={[styles.emptyText, { color: settings.theme === 'light' ? '#000' : '#fff' }]}>
            {books.length === 0 ? 'No books yet' : 'No results found'}
          </Text>
          <Text style={[styles.emptySubtext, { color: settings.theme === 'light' ? '#666' : '#aaa' }]}>
            {books.length === 0 ? 'Tap "Add" to upload your ebooks' : 'Try a different search'}
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
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  addButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    alignItems: 'center',
  },
  sortButtonActive: { backgroundColor: '#4A90E2' },
  sortButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  viewButton: {
    width: 40,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    alignItems: 'center',
  },
  viewButtonActive: { backgroundColor: '#4A90E2' },
  viewButtonText: { color: '#fff', fontSize: 14 },
  listContent: { padding: 12 },
  listCard: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  listCover: {
    width: 50,
    height: 70,
    backgroundColor: '#333',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  coverEmojiList: { fontSize: 24 },
  listInfo: { flex: 1 },
  listTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  listAuthor: { fontSize: 12, marginBottom: 4 },
  listMeta: { marginBottom: 8 },
  metaText: { fontSize: 11 },
  progressBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#4A90E2' },
  listStatus: { alignItems: 'center', marginLeft: 12 },
  pageNumber: { fontSize: 14, fontWeight: 'bold', color: '#4A90E2' },
  pageLabel: { fontSize: 10, marginTop: 2 },
  gridCard: {
    flex: 1,
    marginHorizontal: 6,
    marginBottom: 12,
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
    marginBottom: 10,
  },
  coverEmoji: { fontSize: 40 },
  gridTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  gridAuthor: { fontSize: 11, marginBottom: 8 },
  progressText: { fontSize: 11, marginTop: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { fontSize: 14 },
});
