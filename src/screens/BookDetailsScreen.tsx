import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { useApp } from '../context/AppContext';
import { DatabaseService } from '../services/DatabaseService';
import { READER_THEMES } from '../types';

export default function BookDetailsScreen({ route, navigation }: any) {
  const { bookId } = route.params;
  const { books, bookmarks, highlights, setCurrentBook, deleteBook, loadBookmarks, loadHighlights, updateBook, settings } = useApp();
  const [stats, setStats] = useState({ totalMinutes: 0, sessionCount: 0 });
  const book = books.find(b => b.id === bookId);
  const theme = READER_THEMES[settings.theme];

  useEffect(() => {
    if (book) {
      loadBookmarks(bookId);
      loadHighlights(bookId);
      loadStats();
    }
  }, [bookId]);

  const loadStats = async () => {
    const bookStats = await DatabaseService.getReadingStats(bookId);
    setStats(bookStats);
  };

  if (!book) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.errorText, { color: theme.textColor }]}>Book not found</Text>
      </View>
    );
  }

  const progress = (book.currentProgress / book.totalPages) * 100;

  const handleStartReading = () => {
    setCurrentBook(book);
    navigation.navigate('Reading', { screen: 'ReaderHome' });
  };

  const handleToggleFavorite = async () => {
    await updateBook(bookId, { isFavorite: !book.isFavorite });
  };

  const handleToggleFinished = async () => {
    await updateBook(bookId, { isFinished: !book.isFinished });
  };

  const handleDeleteBook = () => {
    Alert.alert('Delete Book', 'Are you sure? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteBook(bookId);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.selectionColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Book Cover */}
      <View style={styles.coverContainer}>
        <View style={[styles.cover, { backgroundColor: theme.selectionColor }]}>
          <Text style={styles.coverEmoji}>📖</Text>
        </View>
      </View>

      {/* Book Info */}
      <View style={styles.infoSection}>
        <Text style={[styles.title, { color: theme.textColor }]}>{book.title}</Text>
        <Text style={[styles.author, { color: theme.textColor }]}>{book.author || 'Unknown Author'}</Text>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.selectionColor }]}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={[styles.progressText, { color: theme.textColor }]}>
            {Math.round(progress)}% • Page {book.currentProgress} of {book.totalPages}
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: theme.selectionColor }]}>
            <Text style={[styles.statLabel, { color: theme.textColor }]}>Reading Time</Text>
            <Text style={[styles.statValue, { color: theme.accentColor }]}>
              {Math.floor(stats.totalMinutes / 60)}h {stats.totalMinutes % 60}m
            </Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: theme.selectionColor }]}>
            <Text style={[styles.statLabel, { color: theme.textColor }]}>Sessions</Text>
            <Text style={[styles.statValue, { color: theme.accentColor }]}>{stats.sessionCount}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: theme.selectionColor }]}>
            <Text style={[styles.statLabel, { color: theme.textColor }]}>File Size</Text>
            <Text style={[styles.statValue, { color: theme.accentColor }]}>
              {(book.fileSize / 1024 / 1024).toFixed(1)}MB
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: '#4A90E2' }]}
          onPress={handleStartReading}
        >
          <Text style={styles.buttonText}>📖 Continue Reading</Text>
        </TouchableOpacity>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, book.isFavorite && { backgroundColor: '#FFB84D' }]}
            onPress={handleToggleFavorite}
          >
            <Text style={styles.smallButtonText}>{book.isFavorite ? '★' : '☆'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, book.isFinished && { backgroundColor: '#52C41A' }]}
            onPress={handleToggleFinished}
          >
            <Text style={styles.smallButtonText}>{book.isFinished ? '✓' : '○'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: '#F5222D' }]}
            onPress={handleDeleteBook}
          >
            <Text style={styles.smallButtonText}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bookmarks */}
      {bookmarks.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>🔖 Bookmarks ({bookmarks.length})</Text>
          {bookmarks.slice(0, 5).map(bookmark => (
            <View
              key={bookmark.id}
              style={[styles.bookmarkItem, { backgroundColor: theme.selectionColor, borderLeftColor: theme.accentColor }]}
            >
              <View>
                <Text style={[styles.bookmarkPage, { color: theme.textColor }]}>Page {bookmark.page}</Text>
                {bookmark.note && <Text style={[styles.bookmarkNote, { color: theme.textColor }]}>{bookmark.note}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>✓ Highlights ({highlights.length})</Text>
          {highlights.slice(0, 3).map(highlight => (
            <View
              key={highlight.id}
              style={[styles.highlightItem, { backgroundColor: theme.selectionColor, borderLeftColor: highlight.color }]}
            >
              <Text style={[styles.highlightText, { color: theme.textColor }]}>"{highlight.text}"</Text>
              <Text style={[styles.highlightPage, { color: theme.textColor }]}>Page {highlight.page}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1 },
  backButton: { fontSize: 16, color: '#4A90E2', fontWeight: '600' },
  coverContainer: { alignItems: 'center', marginBottom: 24 },
  cover: { width: 120, height: 160, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  coverEmoji: { fontSize: 60 },
  infoSection: { marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  author: { fontSize: 14, marginBottom: 16 },
  progressContainer: { marginBottom: 20 },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: '#4A90E2' },
  progressText: { fontSize: 12 },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, padding: 12, borderRadius: 8 },
  statLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: 'bold' },
  actionsSection: { marginBottom: 24 },
  primaryButton: { paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  secondaryButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  smallButtonText: { fontSize: 18 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  bookmarkItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  bookmarkPage: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  bookmarkNote: { fontSize: 12 },
  highlightItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  highlightText: { fontSize: 13, fontStyle: 'italic', marginBottom: 4 },
  highlightPage: { fontSize: 11 },
  errorText: { fontSize: 16, textAlign: 'center', marginTop: 50 },
});
