import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, Dimensions } from 'react-native';
import { useApp } from '../context/AppContext';
import { DatabaseService } from '../services/DatabaseService';
import { READER_THEMES } from '../types';

export default function StatsScreen() {
  const { books, settings } = useApp();
  const [stats, setStats] = useState({ totalPages: 0, totalMinutes: 0, booksRead: 0 });
  const theme = READER_THEMES[settings.theme];

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
    <View style={[styles.statCard, { backgroundColor: theme.selectionColor }]}>
      <Text style={[styles.statTitle, { color: theme.textColor }]}>{title}</Text>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, { color: theme.accentColor }]}>{value}</Text>
        {unit && <Text style={[styles.statUnit, { color: theme.textColor }]}>{unit}</Text>}
      </View>
    </View>
  );

  const averageReadingTime = books.length > 0 ? Math.round(stats.totalMinutes / books.length) : 0;
  const totalBooks = books.length;
  const finishRate = totalBooks > 0 ? Math.round((stats.booksRead / totalBooks) * 100) : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.textColor }]}>📊 Reading Statistics</Text>

      {/* Main Stats */}
      <View style={styles.statsGrid}>
        <StatCard title="Books in Library" value={totalBooks} />
        <StatCard title="Books Completed" value={stats.booksRead} />
        <StatCard title="Total Pages Read" value={stats.totalPages} />
        <StatCard title="Reading Hours" value={(stats.totalMinutes / 60).toFixed(1)} unit="hrs" />
      </View>

      {/* Detailed Stats */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>📈 Summary</Text>

        <View style={[styles.infoRow, { borderBottomColor: theme.selectionColor }]}>
          <Text style={[styles.infoLabel, { color: theme.textColor }]}>Average Reading Time/Book</Text>
          <Text style={[styles.infoValue, { color: theme.accentColor }]}>{averageReadingTime} mins</Text>
        </View>

        <View style={[styles.infoRow, { borderBottomColor: theme.selectionColor }]}>
          <Text style={[styles.infoLabel, { color: theme.textColor }]}>Completion Rate</Text>
          <Text style={[styles.infoValue, { color: theme.accentColor }]}>{finishRate}%</Text>
        </View>

        <View style={[styles.infoRow, { borderBottomColor: theme.selectionColor }]}>
          <Text style={[styles.infoLabel, { color: theme.textColor }]}>Books in Progress</Text>
          <Text style={[styles.infoValue, { color: theme.accentColor }]}>{totalBooks - stats.booksRead}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.textColor }]}>Average Pages/Book</Text>
          <Text style={[styles.infoValue, { color: theme.accentColor }]}>
            {books.length > 0 ? Math.round(stats.totalPages / books.length) : 0}
          </Text>
        </View>
      </View>

      {/* Reading Streak */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>🔥 Reading Goals</Text>
        <Text style={[styles.goalText, { color: theme.textColor }]}>
          Keep track of your reading goals and maintain a consistent reading habit. Set targets for pages read or
          time spent reading.
        </Text>
      </View>

      {/* Recent Books */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>📚 Recently Read</Text>
        {books.slice(0, 5).map(book => (
          <View key={book.id} style={[styles.recentBook, { borderBottomColor: theme.selectionColor }]}>
            <View>
              <Text style={[styles.recentTitle, { color: theme.textColor }]} numberOfLines={1}>
                {book.title}
              </Text>
              <Text style={[styles.recentAuthor, { color: theme.textColor }]}>
                {Math.round((book.currentProgress / book.totalPages) * 100)}% complete
              </Text>
            </View>
            <Text style={[styles.recentPages, { color: theme.accentColor }]}>{book.currentProgress} / {book.totalPages}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
  },
  statTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statValue: { fontSize: 28, fontWeight: 'bold' },
  statUnit: { fontSize: 12 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  goalText: { fontSize: 13, lineHeight: 20 },
  recentBook: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  recentTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  recentAuthor: { fontSize: 12 },
  recentPages: { fontSize: 13, fontWeight: '600' },
});
