import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { useApp } from '../context/AppContext';

export default function KidsModeScreen() {
  const { books, setCurrentBook } = useApp();
  const kidBooks = books.slice(0, 4);

  const LargeBookCard = ({ book, onPress }: any) => (
    <TouchableOpacity
      style={styles.largeCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.largeCover}>
        <Text style={styles.largeSymbol}>✦</Text>
      </View>
      <Text style={styles.largeTitle}>{book.title}</Text>
      <Text style={styles.largeAuthor}>{book.author || '—'}</Text>
      <View style={styles.largeProgress}>
        <View style={[styles.progressFill, { width: `${(book.currentProgress / book.totalPages) * 100}%` }]} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>✦ Young Reader ✦</Text>
        <Text style={styles.headerSubtitle}>A Solemn Journey Through Stories</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* My Stories Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✦ My Manuscripts</Text>
          <View style={styles.gridRow}>
            {kidBooks.slice(0, 2).map(book => (
              <View key={book.id} style={{ width: '48%' }}>
                <LargeBookCard
                  book={book}
                  onPress={() => setCurrentBook(book)}
                />
              </View>
            ))}
          </View>
          <View style={styles.gridRow}>
            {kidBooks.slice(2, 4).map(book => (
              <View key={book.id} style={{ width: '48%' }}>
                <LargeBookCard
                  book={book}
                  onPress={() => setCurrentBook(book)}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Reading Quest */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✦ Reading Quest</Text>
          <View style={styles.questCard}>
            <Text style={styles.questLabel}>Complete Three Manuscripts</Text>
            <View style={styles.questProgress}>
              <View style={styles.questFill} />
            </View>
            <Text style={styles.questStat}>2 of 3 Completed</Text>
          </View>
        </View>

        {/* Virtues & Deeds */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✦ Virtues Earned</Text>
          <View style={styles.virtuesRow}>
            <View style={styles.virtue}>
              <Text style={styles.virtueSymbol}>✦</Text>
              <Text style={styles.virtueLabel}>Perseverance</Text>
            </View>
            <View style={styles.virtue}>
              <Text style={styles.virtueSymbol}>✦</Text>
              <Text style={styles.virtueLabel}>Contemplation</Text>
            </View>
            <View style={[styles.virtue, styles.virtueLocked]}>
              <Text style={styles.virtueSymbol}>◯</Text>
              <Text style={styles.virtueLabel}>Wisdom</Text>
            </View>
          </View>
        </View>

        {/* Listen Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✦ Hear the Words</Text>
          <Text style={styles.listenText}>
            Listen as a voice reads your manuscript aloud
          </Text>
          <TouchableOpacity style={styles.listenButton}>
            <Text style={styles.listenButtonText}>▶ Begin Listening</Text>
          </TouchableOpacity>
        </View>

        {/* Wisdom Quote */}
        <View style={styles.wisdomBox}>
          <Text style={styles.wisdomSymbol}>✦</Text>
          <Text style={styles.wisdomText}>
            "Every book is a doorway to understanding. Approach with reverence."
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1328' },
  header: {
    backgroundColor: '#2d1b4e',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#c9a961',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '400',
    color: '#c9a961',
    marginBottom: 4,
    letterSpacing: 3,
    fontFamily: 'Georgia',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#8b7355',
    letterSpacing: 2,
    fontStyle: 'italic',
  },
  content: { padding: 16, paddingBottom: 32 },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 13,
    color: '#c9a961',
    marginBottom: 16,
    letterSpacing: 2,
    fontFamily: 'Georgia',
  },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  largeCard: {
    backgroundColor: '#2d1b4e',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#8b7355',
    padding: 10,
    alignItems: 'center',
  },
  largeCover: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#1a1328',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: '#c9a961',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  largeSymbol: { fontSize: 40, color: '#c9a961', fontWeight: '300' },
  largeTitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#c9a961',
    marginBottom: 2,
    textAlign: 'center',
    fontFamily: 'Georgia',
  },
  largeAuthor: { fontSize: 10, color: '#8b7355', marginBottom: 8, letterSpacing: 1 },
  largeProgress: {
    width: '100%',
    height: 2,
    backgroundColor: '#3d3730',
    borderWidth: 1,
    borderColor: '#8b7355',
  },
  progressFill: { height: '100%', backgroundColor: '#c9a961' },
  questCard: {
    backgroundColor: '#2d1b4e',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#8b7355',
    padding: 14,
  },
  questLabel: { fontSize: 12, fontWeight: '400', color: '#c9a961', marginBottom: 8, fontFamily: 'Georgia' },
  questProgress: {
    height: 3,
    backgroundColor: '#1a1328',
    borderWidth: 1,
    borderColor: '#8b7355',
    overflow: 'hidden',
    marginBottom: 8,
  },
  questFill: { height: '100%', backgroundColor: '#c9a961', width: '66%' },
  questStat: { fontSize: 10, color: '#8b7355', letterSpacing: 1 },
  virtuesRow: { flexDirection: 'row', gap: 10 },
  virtue: {
    flex: 1,
    backgroundColor: '#2d1b4e',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#8b7355',
    paddingVertical: 14,
    alignItems: 'center',
  },
  virtueLocked: { opacity: 0.5 },
  virtueSymbol: { fontSize: 20, color: '#c9a961', marginBottom: 4 },
  virtueLabel: { fontSize: 10, color: '#c9a961', textAlign: 'center', letterSpacing: 1 },
  listenText: { fontSize: 12, color: '#8b7355', marginBottom: 12, lineHeight: 18, fontStyle: 'italic' },
  listenButton: {
    backgroundColor: '#2d1b4e',
    borderWidth: 1,
    borderColor: '#c9a961',
    paddingVertical: 12,
    borderRadius: 2,
    alignItems: 'center',
  },
  listenButtonText: { color: '#c9a961', fontSize: 13, fontWeight: '400', letterSpacing: 1 },
  wisdomBox: {
    backgroundColor: '#2d1b4e',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#8b7355',
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  wisdomSymbol: { fontSize: 16, color: '#c9a961', marginBottom: 8 },
  wisdomText: {
    fontSize: 11,
    color: '#c9a961',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 16,
    fontFamily: 'Georgia',
  },
});
