import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FileService, ParsedBook } from '../services/FileService';
import { useBooks } from '../context/BookContext';
import { Book } from '../context/BookContext';

export default function LibraryScreen() {
  const { books, addBook, removeBook, setCurrentBook } = useBooks();
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Refresh library on screen focus
    }, [])
  );

  const handleUploadBook = async () => {
    setLoading(true);
    try {
      const file = await FileService.pickMobiFile();
      if (!file) return;

      const filePath = await FileService.copyFileToAppDirectory(
        file.uri,
        file.name
      );

      const parsed = await FileService.parseMobiFile(filePath);

      const newBook: Book = {
        id: `book_${Date.now()}`,
        title: parsed.title,
        author: 'Unknown',
        filePath,
        fileName: file.name,
        currentPage: 0,
        totalPages: parsed.chapters.reduce((acc, c) => acc + Math.ceil(c.content.length / 500), 0),
        lastRead: new Date(),
        content: parsed.chapters.map(c => c.content).join('\n\n'),
      };

      addBook(newBook);
      Alert.alert('Success', `Added "${newBook.title}" to library`);
    } catch (error) {
      Alert.alert('Error', 'Failed to upload book');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = (id: string) => {
    Alert.alert('Delete Book', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removeBook(id),
      },
    ]);
  };

  const BookItem = ({ book }: { book: Book }) => (
    <TouchableOpacity
      style={styles.bookCard}
      onPress={() => setCurrentBook(book)}
    >
      <View style={styles.bookCover}>
        <Text style={styles.coverEmoji}>📖</Text>
      </View>
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={styles.bookAuthor}>{book.author}</Text>
        <Text style={styles.bookProgress}>
          Page {book.currentPage} / {book.totalPages}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteBook(book.id)}
      >
        <Text>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📚 My Library</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handleUploadBook}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.uploadButtonText}>+ Add Book</Text>
          )}
        </TouchableOpacity>
      </View>

      {books.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyText}>No books yet</Text>
          <Text style={styles.emptySubtext}>
            Tap "Add Book" to upload your MOBI files
          </Text>
        </View>
      ) : (
        <FlatList
          data={books}
          renderItem={({ item }) => <BookItem book={item} />}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomColor: '#333',
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  uploadButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  bookCard: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    alignItems: 'center',
  },
  bookCover: {
    width: 60,
    height: 80,
    backgroundColor: '#333',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  coverEmoji: {
    fontSize: 32,
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  bookAuthor: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 4,
  },
  bookProgress: {
    fontSize: 12,
    color: '#888',
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#aaa',
  },
});
