import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, Dimensions } from 'react-native';
import { useApp } from '../context/AppContext';
import { DatabaseService } from '../services/DatabaseService';
import { READER_THEMES } from '../types';

export default function StatsScreen() {
  const { books, settings } = useApp();
  const [stats, setStats] = useState({ totalPages: 0, totalMinutes: 0, booksRead: 0 });

  useEffect(() => {
    calculateStats();
  }, [books]);

  const calculateStats = async () => {
    let totalPages = 0;
    let totalMinutes = 0;
    let booksRead = 0;

    for (const book of books) {
      totalPages += book.currentProgress;
      if (book.readingTimeMinutes) totalMinutes += book.readingTimeMinutes;
      if (book.isFinished) booksRead++;
    }

    setStats({ totalPages, totalMinutes, booksRead });
  };

  const StatCard = ({ title, value, unit }: { title: string; value: number | string; unit?: string }) => (
    <View style={[styles.statCard, { backgroundColor: '#2d1b4e', borderColor: '#8b7355' }]}>
      <Text style={[styles.statTitle, { color: '#8b7355' }]}>{title}</Text>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, { color: '#c9a961' }]}>{value}</Text>
        {unit && <Text style={[styles.statUnit, { color: '#c9a961' }]}>{unit}</Text>}
      </View>
    </View>
  );

  const averageReadingTime = books.length > 0 ? Math.round(stats.totalMinutes / books.length) : 0;
  const totalBooks = books.length;
  const finishRate = totalBooks > 0 ? Math.round((stats.booksRead / totalBooks) * 100) : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: '#0f0a1a' }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: '#c9a961' }]}>✦ Reading Wisdom</Text>

      {/* Main Stats */}
      <View style={styles.statsGrid}>
        <StatCard title="Manuscripts" value={totalBooks} />
        <StatCard title="Completed" value={stats.booksRead} />
        <StatCard title="Pages Read" value={stats.totalPages} />
        <StatCard title="Hours" value={(stats.totalMinutes / 60).toFixed(1)} unit="hrs" />
      </View>

      {/* Detailed Stats */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: '#c9a961' }]}>✦ Summary</Text>

        <View style={[styles.infoRow, { borderBottomColor: '#8b7355' }]}>
          <Text style={[styles.infoLabel, { color: '#c9a961' }]}>Average Reading Time</Text>
          <Text style={[styles.infoValue, { color: '#8b7355' }]}>{averageReadingTime} mins</Text>
        </View>

        <View style={[styles.infoRow, { borderBottomColor: '#8b7355' }]}>
          <Text style={[styles.infoLabel, { color: '#c9a961' }]}>Completion Rate</Text>
          <Text style={[styles.infoValue, { color: '#8b7355' }]}>{finishRate}%</Text>
        </View>

        <View style={[styles.infoRow, { borderBottomColor: '#8b7355' }]}>
          <Text style={[styles.infoLabel, { color: '#c9a961' }]}>In Progress</Text>
          <Text style={[styles.infoValue, { color: '#8b7355' }]}>{totalBooks - stats.booksRead}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: '#c9a961' }]}>Average Pages</Text>
          <Text style={[styles.infoValue, { color: '#8b7355' }]}>
            {books.length > 0 ? Math.round(stats.totalPages / books.length) : 0}
          </Text>
        </View>
      </View>

      {/* Reading Goals */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: '#c9a961' }]}>✦ Reading Intentions</Text>
        <Text style={[styles.goalText, { color: '#8b7355' }]}>
          Establish reading goals and maintain a consistent contemplative practice. Set targets for pages read or time spent in deep engagement with your manuscripts.
        </Text>
      </View>

      {/* Recently Read */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: '#c9a961' }]}>✦ Recently Contemplated</Text>
        {books.slice(0, 5).map(book => (
          <View key={book.id} style={[styles.recentBook, { borderBottomColor: '#8b7355' }]}>
            <View>
              <Text style={[styles.recentTitle, { color: '#c9a961' }]} numberOfLines={1}>
                {book.title}
              </Text>
              <Text style={[styles.recentAuthor, { color: '#8b7355' }]}>
                {Math.round((book.currentProgress / book.totalPages) * 100)}% complete
              </Text>
            </View>
            <Text style={[styles.recentPages, { color: '#c9a961' }]}>{book.currentProgress} / {book.totalPages}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '400', marginBottom: 20, letterSpacing: 2, fontFamily: 'Georgia' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    borderRadius: 2,
    borderWidth: 1,
    padding: 16,
  },
  statTitle: { fontSize: 11, fontWeight: '400', marginBottom: 8, letterSpacing: 1, fontFamily: 'Georgia' },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statValue: { fontSize: 28, fontWeight: '300' },
  statUnit: { fontSize: 11, letterSpacing: 1 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '400', marginBottom: 12, letterSpacing: 2, fontFamily: 'Georgia' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: { fontSize: 13, fontFamily: 'Georgia' },
  infoValue: { fontSize: 13, fontWeight: '400', letterSpacing: 1 },
  goalText: { fontSize: 12, lineHeight: 20, fontFamily: 'Georgia', letterSpacing: 0.5 },
  recentBook: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  recentTitle: { fontSize: 13, fontWeight: '400', marginBottom: 4, fontFamily: 'Georgia' },
  recentAuthor: { fontSize: 11, letterSpacing: 0.5 },
  recentPages: { fontSize: 12, fontWeight: '400', letterSpacing: 1 },
});
