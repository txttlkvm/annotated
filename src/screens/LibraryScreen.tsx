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
import BookCover from '../components/BookCover';
import { colors, type as t, space, radius, elevation } from '../theme';

const { width } = Dimensions.get('window');

// Two columns inside listContent padding, minus card margins and card padding.
const GRID_COVER_W = Math.floor((width - space.xl) / 2 - space.md - space.xl);
const LIST_COVER_W = 58;

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

  const getItemTypeIcon = (type?: string) => {
    if (type === 'music') return '♪';
    if (type === 'art') return '✎';
    if (type === 'resource') return '◆';
    return '✦';
  };

  const getItemTypeMeta = (book: Book) => {
    if (book.itemType === 'music') return `${book.author} • Composition`;
    if (book.itemType === 'art') return `${book.author} • Artwork`;
    if (book.itemType === 'resource') return 'Reference • Study Material';
    return `${book.totalPages} pages • ${(book.fileSize / 1024 / 1024).toFixed(1)}MB`;
  };

  const BookCard = ({ book }: { book: Book }) => {
    const progress = book.totalPages > 0 ? (book.currentProgress / book.totalPages) * 100 : 0;

    if (viewMode === 'grid') {
      return (
        <TouchableOpacity
          style={[styles.gridCard, { backgroundColor: '#1a1328', borderColor: '#8b7355' }]}
          onPress={() => navigation.navigate('BookDetails', { bookId: book.id })}
        >
          <View style={styles.gridCoverWrap}>
            <BookCover
              uri={book.cover}
              title={book.title}
              author={book.author}
              itemType={book.itemType}
              width={GRID_COVER_W}
            />
          </View>
          <Text style={[styles.gridTitle, { color: colors.gold }]} numberOfLines={2}>
            {book.title}
          </Text>
          <Text style={[styles.gridAuthor, { color: colors.bronze }]} numberOfLines={1}>
            {book.author || '—'}
          </Text>
          {book.totalPages > 0 && (
            <>
              <View style={[styles.progressBar, { borderColor: '#8b7355' }]}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={[styles.progressText, { color: '#8b7355' }]}>
                {Math.round(progress)}%
              </Text>
            </>
          )}
          {book.itemType !== 'book' && (
            <Text style={[styles.typeTag, { color: '#8b7355' }]}>
              {book.itemType === 'music' ? 'Music' : book.itemType === 'art' ? 'Art' : 'Resource'}
            </Text>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.listCard, { backgroundColor: '#1a1328', borderColor: '#8b7355' }]}
        onPress={() => navigation.navigate('BookDetails', { bookId: book.id })}
      >
        <View style={styles.listCoverWrap}>
          <BookCover
            uri={book.cover}
            title={book.title}
            author={book.author}
            itemType={book.itemType}
            width={LIST_COVER_W}
          />
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
              {getItemTypeMeta(book)}
            </Text>
          </View>
          {book.totalPages > 0 && (
            <View style={[styles.progressBar, { borderColor: '#8b7355' }]}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          )}
        </View>
        <View style={styles.listStatus}>
          {book.totalPages > 0 ? (
            <>
              <Text style={[styles.pageNumber, { color: '#c9a961' }]}>{book.currentProgress}</Text>
              <Text style={[styles.pageLabel, { color: '#8b7355' }]}>p.</Text>
            </>
          ) : (
            <Text style={[styles.pageLabel, { color: '#8b7355' }]}>{book.itemType === 'music' ? '♪' : book.itemType === 'art' ? '✎' : '◆'}</Text>
          )}
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
    paddingTop: space.lg,
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerTitle: { ...t.display },
  addButton: {
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 1,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  addButtonText: { ...t.caption, letterSpacing: 0.8 },
  searchSection: {
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderBottomWidth: 1,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginBottom: space.md,
    ...t.body,
  },
  controls: {
    flexDirection: 'row',
    gap: space.sm,
  },
  sortButton: {
    flex: 1,
    paddingVertical: space.sm + 2,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  sortButtonText: { ...t.caption },
  viewButton: {
    width: 44,
    paddingVertical: space.sm + 2,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  viewButtonText: { fontSize: 15, color: colors.gold },
  listContent: { padding: space.md, paddingBottom: space.xxxl },
  listCard: {
    flexDirection: 'row',
    marginBottom: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.md,
    alignItems: 'center',
    ...elevation.card,
  },
  listCoverWrap: { marginRight: space.lg },
  listInfo: { flex: 1, justifyContent: 'center' },
  listTitle: { ...t.title, marginBottom: 3 },
  listAuthor: { ...t.caption, marginBottom: 6, fontStyle: 'italic' },
  listMeta: { marginBottom: space.sm },
  metaText: { ...t.overline, textTransform: 'uppercase' },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.gold, borderRadius: radius.pill },
  listStatus: { alignItems: 'center', marginLeft: space.md, minWidth: 30 },
  pageNumber: { ...t.heading, fontSize: 17 },
  pageLabel: { ...t.overline, marginTop: 2 },
  gridCard: {
    flex: 1,
    marginHorizontal: space.sm,
    marginBottom: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.md,
    ...elevation.card,
  },
  gridCoverWrap: { alignItems: 'center', marginBottom: space.md },
  gridTitle: { ...t.title, fontSize: 14, marginBottom: 3 },
  gridAuthor: { ...t.caption, marginBottom: space.sm, fontStyle: 'italic' },
  progressText: { ...t.overline, marginTop: 5 },
  typeTag: { ...t.overline, marginTop: 5, textTransform: 'uppercase' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xl },
  emptyIcon: { fontSize: 52, marginBottom: space.lg, color: colors.bronze, opacity: 0.5 },
  emptyText: { ...t.display, marginBottom: space.sm },
  emptySubtext: { ...t.body, textAlign: 'center' },
});
