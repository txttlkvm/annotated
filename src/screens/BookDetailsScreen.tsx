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
      <View style={[styles.container, { backgroundColor: '#0f0a1a' }]}>
        <Text style={[styles.errorText, { color: '#c9a961' }]}>Manuscript not found</Text>
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
    Alert.alert('Remove Manuscript', 'Are you certain? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
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
      style={[styles.container, { backgroundColor: '#0f0a1a' }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: '#c9a961' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: '#c9a961' }]}>← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Book Cover */}
      <View style={styles.coverContainer}>
        <View style={[styles.cover, { backgroundColor: '#2d1b4e', borderColor: '#c9a961' }]}>
          <Text style={[styles.coverSymbol, { color: '#c9a961' }]}>✦</Text>
        </View>
      </View>

      {/* Book Info */}
      <View style={styles.infoSection}>
        <Text style={[styles.title, { color: '#c9a961' }]}>{book.title}</Text>
        <Text style={[styles.author, { color: '#8b7355' }]}>{book.author || '—'}</Text>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: '#3d3730', borderColor: '#8b7355' }]}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={[styles.progressText, { color: '#c9a961' }]}>
            {Math.round(progress)}% • Page {book.currentProgress} of {book.totalPages}
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: '#1a1328', borderColor: '#8b7355' }]}>
            <Text style={[styles.statLabel, { color: '#8b7355' }]}>Reading Time</Text>
            <Text style={[styles.statValue, { color: '#c9a961' }]}>
              {Math.floor(stats.totalMinutes / 60)}h {stats.totalMinutes % 60}m
            </Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#1a1328', borderColor: '#8b7355' }]}>
            <Text style={[styles.statLabel, { color: '#8b7355' }]}>Sessions</Text>
            <Text style={[styles.statValue, { color: '#c9a961' }]}>{stats.sessionCount}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#1a1328', borderColor: '#8b7355' }]}>
            <Text style={[styles.statLabel, { color: '#8b7355' }]}>File Size</Text>
            <Text style={[styles.statValue, { color: '#c9a961' }]}>
              {(book.fileSize / 1024 / 1024).toFixed(1)}MB
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: '#2d1b4e', borderColor: '#c9a961' }]}
          onPress={handleStartReading}
        >
          <Text style={[styles.buttonText, { color: '#c9a961' }]}>✦ Continue Reading</Text>
        </TouchableOpacity>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: '#8b7355' }, book.isFavorite && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' }]}
            onPress={handleToggleFavorite}
          >
            <Text style={[styles.smallButtonText, { color: '#c9a961' }]}>{book.isFavorite ? '✦' : '○'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: '#8b7355' }, book.isFinished && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' }]}
            onPress={handleToggleFinished}
          >
            <Text style={[styles.smallButtonText, { color: '#c9a961' }]}>{book.isFinished ? '✓' : '○'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: '#8b7355' }]}
            onPress={handleDeleteBook}
          >
            <Text style={[styles.smallButtonText, { color: '#c9a961' }]}>—</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bookmarks */}
      {bookmarks.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#c9a961' }]}>✦ Bookmarks ({bookmarks.length})</Text>
          {bookmarks.slice(0, 5).map(bookmark => (
            <View
              key={bookmark.id}
              style={[styles.bookmarkItem, { backgroundColor: '#1a1328', borderColor: '#8b7355' }]}
            >
              <View>
                <Text style={[styles.bookmarkPage, { color: '#c9a961' }]}>Page {bookmark.page}</Text>
                {bookmark.note && <Text style={[styles.bookmarkNote, { color: '#8b7355' }]}>{bookmark.note}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#c9a961' }]}>✦ Passages ({highlights.length})</Text>
          {highlights.slice(0, 3).map(highlight => (
            <View
              key={highlight.id}
              style={[styles.highlightItem, { backgroundColor: '#1a1328', borderColor: highlight.color || '#8b7355' }]}
            >
              <Text style={[styles.highlightText, { color: '#c9a961' }]}>"{highlight.text}"</Text>
              <Text style={[styles.highlightPage, { color: '#8b7355' }]}>Page {highlight.page}</Text>
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
  header: { flexDirection: 'row', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 2 },
  backButton: { fontSize: 15, fontWeight: '400', letterSpacing: 1 },
  coverContainer: { alignItems: 'center', marginBottom: 24 },
  cover: { width: 120, height: 160, borderRadius: 2, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  coverSymbol: { fontSize: 60, fontWeight: '300' },
  infoSection: { marginBottom: 24 },
  title: { fontSize: 20, fontWeight: '400', marginBottom: 4, fontFamily: 'Georgia', letterSpacing: 1 },
  author: { fontSize: 13, marginBottom: 16, letterSpacing: 0.5 },
  progressContainer: { marginBottom: 20 },
  progressBar: { height: 3, borderRadius: 1, overflow: 'hidden', marginBottom: 8, borderWidth: 1 },
  progressFill: { height: '100%', backgroundColor: '#c9a961' },
  progressText: { fontSize: 11, letterSpacing: 1, fontFamily: 'Georgia' },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, padding: 12, borderRadius: 2, borderWidth: 1 },
  statLabel: { fontSize: 10, fontWeight: '400', marginBottom: 4, letterSpacing: 1, fontFamily: 'Georgia' },
  statValue: { fontSize: 15, fontWeight: '300' },
  actionsSection: { marginBottom: 24 },
  primaryButton: { paddingVertical: 12, borderRadius: 2, borderWidth: 1, alignItems: 'center', marginBottom: 12 },
  buttonText: { fontWeight: '400', fontSize: 13, letterSpacing: 1 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  secondaryButton: { flex: 1, paddingVertical: 10, borderRadius: 2, borderWidth: 1, alignItems: 'center' },
  smallButtonText: { fontSize: 16, fontWeight: '300' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '400', marginBottom: 12, letterSpacing: 2, fontFamily: 'Georgia' },
  bookmarkItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 2,
    marginBottom: 8,
    borderLeftWidth: 2,
  },
  bookmarkPage: { fontSize: 11, fontWeight: '400', marginBottom: 4, letterSpacing: 1, fontFamily: 'Georgia' },
  bookmarkNote: { fontSize: 11, letterSpacing: 0.5 },
  highlightItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 2,
    marginBottom: 8,
    borderLeftWidth: 2,
  },
  highlightText: { fontSize: 12, fontStyle: 'italic', marginBottom: 4, fontFamily: 'Georgia' },
  highlightPage: { fontSize: 10, letterSpacing: 1 },
  errorText: { fontSize: 15, textAlign: 'center', marginTop: 50, letterSpacing: 1 },
});
