import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text, FlatList } from 'react-native';
import { useApp } from '../context/AppContext';

export default function KidsModeScreen() {
  const { books, setCurrentBook } = useApp();
  const [selectedBook, setSelectedBook] = useState<string | null>(null);

  const kidsBooks = books.filter(b =>
    b.title.toLowerCase().includes('kid') ||
    b.title.toLowerCase().includes('story') ||
    b.author?.toLowerCase().includes('seuss')
  ).length > 0
    ? books.filter(b =>
        b.title.toLowerCase().includes('kid') ||
        b.title.toLowerCase().includes('story') ||
        b.author?.toLowerCase().includes('seuss')
      )
    : books.slice(0, 4);

  const LargeBookCard = ({ book, onPress }: any) => (
    <TouchableOpacity
      style={styles.largeCard}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.largeCover}>
        <Text style={styles.largeEmoji}>📖</Text>
      </View>
      <Text style={styles.largeTitle}>{book.title}</Text>
      <Text style={styles.largeAuthor}>{book.author || 'Unknown'}</Text>
      <View style={styles.largeProgress}>
        <View style={[styles.progressFill, { width: `${(book.currentProgress / book.totalPages) * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {Math.round((book.currentProgress / book.totalPages) * 100)}% read
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎉 Kids Mode</Text>
        <Text style={styles.headerSubtitle}>Fun Reading Time!</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>📚 My Stories</Text>
        <View style={styles.gridRow}>
          {kidsBooks.slice(0, 2).map(book => (
            <View key={book.id} style={{ width: '48%' }}>
              <LargeBookCard
                book={book}
                onPress={() => {
                  setCurrentBook(book);
                  setSelectedBook(book.id);
                }}
              />
            </View>
          ))}
        </View>

        <View style={styles.gridRow}>
          {kidsBooks.slice(2, 4).map(book => (
            <View key={book.id} style={{ width: '48%' }}>
              <LargeBookCard
                book={book}
                onPress={() => {
                  setCurrentBook(book);
                  setSelectedBook(book.id);
                }}
              />
            </View>
          ))}
        </View>

        <View style={styles.featureSection}>
          <Text style={styles.featureTitle}>🎯 Reading Goals</Text>
          <View style={styles.goalCard}>
            <Text style={styles.goalText}>Read 3 books this week!</Text>
            <View style={styles.goalProgress}>
              <View style={styles.goalFill} />
              <Text style={styles.goalPercent}>2/3</Text>
            </View>
          </View>
        </View>

        <View style={styles.featureSection}>
          <Text style={styles.featureTitle}>🏆 Achievements</Text>
          <View style={styles.achievementRow}>
            <View style={styles.achievement}>
              <Text style={styles.achievementIcon}>🌟</Text>
              <Text style={styles.achievementLabel}>Read 10 pages</Text>
            </View>
            <View style={styles.achievement}>
              <Text style={styles.achievementIcon}>✨</Text>
              <Text style={styles.achievementLabel}>Added bookmark</Text>
            </View>
            <View style={[styles.achievement, styles.achievementLocked]}>
              <Text style={styles.achievementIcon}>🎉</Text>
              <Text style={styles.achievementLabel}>Complete book</Text>
            </View>
          </View>
        </View>

        <View style={styles.featureSection}>
          <Text style={styles.featureTitle}>🎨 Text-to-Speech</Text>
          <Text style={styles.featureText}>Tap the read icon to hear your story!</Text>
          <TouchableOpacity style={styles.featureButton}>
            <Text style={styles.featureButtonText}>▶ Listen Now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: '#FF6B9D',
    paddingVertical: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#ffdd88' },
  content: { padding: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 16 },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  largeCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFB6C1',
  },
  largeCover: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#FFE4E1',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#FF69B4',
  },
  largeEmoji: { fontSize: 48 },
  largeTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 4, textAlign: 'center' },
  largeAuthor: { fontSize: 12, color: '#888', marginBottom: 8 },
  largeProgress: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: { height: '100%', backgroundColor: '#4CAF50' },
  progressText: { fontSize: 11, color: '#666', fontWeight: '600' },
  featureSection: { marginTop: 24, marginBottom: 16 },
  featureTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  featureText: { fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 18 },
  featureButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  featureButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  goalCard: {
    backgroundColor: '#FFF9C4',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FBC02D',
  },
  goalText: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  goalProgress: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalFill: { height: '100%', backgroundColor: '#FBC02D', width: '66%' },
  goalPercent: { fontSize: 10, color: '#fff', fontWeight: 'bold', marginLeft: 4 },
  achievementRow: { flexDirection: 'row', gap: 12 },
  achievement: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  achievementLocked: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ccc',
    opacity: 0.6,
  },
  achievementIcon: { fontSize: 24, marginBottom: 4 },
  achievementLabel: { fontSize: 11, fontWeight: '600', color: '#333', textAlign: 'center' },
});
