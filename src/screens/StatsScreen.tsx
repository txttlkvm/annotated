import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { useApp } from '../context/AppContext';
import BookCover from '../components/BookCover';
import { colors, fonts, space, radius, type, elevation } from '../theme';

import Shell from '../components/Shell';
/* ------------------------------------------------------------------ *
 * Building blocks
 * ------------------------------------------------------------------ */

/**
 * A single figure, set large in the display serif with a hairline above and a
 * small-caps label beneath. The old version was a 28px number on a flat
 * 2px-radius tile; the weight of the numeral is what carries this now.
 */
function StatBlock({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: number | string;
  unit?: string;
  note?: string;
}) {
  return (
    <View style={styles.statBlock}>
      <View style={styles.statAccent} />
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statFigureRow}>
        <Text style={styles.statFigure} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {!!unit && <Text style={styles.statUnit}>{unit}</Text>}
      </View>
      {!!note && <Text style={styles.statNote}>{note}</Text>}
    </View>
  );
}

/** Slim gold meter used for completion and per-book progress. */
function Meter({ percent, thin }: { percent: number; thin?: boolean }) {
  const clamped = Math.max(0, Math.min(100, isFinite(percent) ? percent : 0));
  return (
    <View style={[styles.meterTrack, thin && styles.meterTrackThin]}>
      <View style={[styles.meterFill, thin && styles.meterFillThin, { width: `${clamped}%` }]} />
    </View>
  );
}

function SectionTitle({ children, caption }: { children: string; caption?: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {!!caption && <Text style={styles.sectionCaption}>{caption}</Text>}
    </View>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Screen
 * ------------------------------------------------------------------ */

export default function StatsScreen() {
  const { books } = useApp();
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

  const totalBooks = books.length;
  const averageReadingTime = totalBooks > 0 ? Math.round(stats.totalMinutes / totalBooks) : 0;
  const averagePages = totalBooks > 0 ? Math.round(stats.totalPages / totalBooks) : 0;
  const finishRate = totalBooks > 0 ? Math.round((stats.booksRead / totalBooks) * 100) : 0;
  const inProgress = totalBooks - stats.booksRead;
  const hours = (stats.totalMinutes / 60).toFixed(1);

  const recent = books.slice(0, 5);

  return (
    <Shell scroll gutter={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Your reading</Text>
        <Text style={styles.title}>Reading Wisdom</Text>
        <Text style={styles.subtitle}>
          What you have read, and what still waits on the shelf.
        </Text>
        <View style={styles.headerRule} />
      </View>

      {/* Figures */}
      <View style={styles.statsGrid}>
        <StatBlock label="Manuscripts" value={totalBooks} note="in the library" />
        <StatBlock label="Completed" value={stats.booksRead} note={`${finishRate}% of the shelf`} />
        <StatBlock label="Pages read" value={stats.totalPages} />
        <StatBlock label="Time spent" value={hours} unit="hrs" />
      </View>

      {/* Completion */}
      <View style={styles.section}>
        <SectionTitle caption="How much of the shelf you have finished.">Progress</SectionTitle>
        <View style={styles.card}>
          <View style={styles.completionHead}>
            <Text style={styles.completionFigure}>{finishRate}</Text>
            <Text style={styles.completionUnit}>%</Text>
            <Text style={styles.completionCaption}>
              {stats.booksRead} of {totalBooks || 0} finished
            </Text>
          </View>
          <Meter percent={finishRate} />
        </View>
      </View>

      {/* Summary */}
      <View style={styles.section}>
        <SectionTitle>Summary</SectionTitle>
        <View style={styles.card}>
          <InfoRow label="Average reading time" value={`${averageReadingTime} min`} />
          <InfoRow label="Average pages per book" value={String(averagePages)} />
          <InfoRow label="In progress" value={String(inProgress)} />
          <InfoRow label="Total hours" value={`${hours} hrs`} last />
        </View>
      </View>

      {/* Intentions */}
      <View style={styles.section}>
        <SectionTitle>Reading Intentions</SectionTitle>
        <View style={styles.card}>
          <Text style={styles.quote}>
            Establish reading goals and maintain a consistent contemplative
            practice. Set targets for pages read or time spent in deep engagement
            with your manuscripts.
          </Text>
        </View>
      </View>

      {/* Recently read */}
      <View style={styles.section}>
        <SectionTitle>Recently Contemplated</SectionTitle>
        <View style={styles.card}>
          {recent.length === 0 ? (
            <Text style={styles.empty}>
              Nothing opened yet. Choose a volume from the library to begin.
            </Text>
          ) : (
            recent.map((book, i) => {
              const pct =
                book.totalPages > 0
                  ? Math.round((book.currentProgress / book.totalPages) * 100)
                  : 0;
              return (
                <View
                  key={book.id}
                  style={[styles.recentRow, i === recent.length - 1 && styles.infoRowLast]}
                >
                  <BookCover
                    uri={book.cover}
                    title={book.title}
                    author={book.author}
                    itemType={book.itemType}
                    width={40}
                  />
                  <View style={styles.recentBody}>
                    <Text style={styles.recentTitle} numberOfLines={1}>
                      {book.title}
                    </Text>
                    {!!book.author && (
                      <Text style={styles.recentAuthor} numberOfLines={1}>
                        {book.author}
                      </Text>
                    )}
                    <Meter percent={pct} thin />
                  </View>
                  <View style={styles.recentFigures}>
                    <Text style={styles.recentPercent}>{pct}%</Text>
                    <Text style={styles.recentPages}>
                      {book.currentProgress} / {book.totalPages}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * Styles
 * ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxxl },

  header: { marginTop: space.sm, marginBottom: space.xl },
  eyebrow: {
    ...type.overline,
    color: colors.bronze,
    textTransform: 'uppercase',
    marginBottom: space.xs,
  },
  title: { ...type.display, color: colors.gold },
  subtitle: { ...type.body, color: colors.inkMuted, marginTop: space.sm },
  headerRule: { height: 1, backgroundColor: colors.rule, marginTop: space.lg },

  /* Figures */
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    marginBottom: space.xxl,
  },
  statBlock: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    overflow: 'hidden',
    ...elevation.card,
  },
  statAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.gold,
    opacity: 0.5,
  },
  statLabel: {
    ...type.overline,
    color: colors.bronze,
    textTransform: 'uppercase',
    marginBottom: space.sm,
  },
  statFigureRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  statFigure: {
    fontFamily: fonts.display,
    fontSize: 38,
    lineHeight: 44,
    color: colors.goldBright,
    letterSpacing: 0.5,
  },
  statUnit: { ...type.caption, color: colors.bronze },
  statNote: { ...type.caption, color: colors.inkMuted, marginTop: space.xs },

  /* Sections */
  section: { marginBottom: space.xxl },
  sectionHead: { marginBottom: space.sm },
  sectionTitle: { ...type.heading, color: colors.goldBright },
  sectionCaption: { ...type.caption, color: colors.inkMuted, marginTop: space.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
    marginTop: space.sm,
    ...elevation.card,
  },

  /* Completion */
  completionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
    paddingTop: space.lg,
    marginBottom: space.md,
  },
  completionFigure: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    color: colors.goldBright,
  },
  completionUnit: { ...type.caption, color: colors.bronze, fontSize: 14 },
  completionCaption: { ...type.caption, color: colors.inkMuted, marginLeft: space.sm },

  /* Meter */
  meterTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.rule,
    overflow: 'hidden',
    marginBottom: space.lg,
  },
  meterTrackThin: { height: 3, borderWidth: 0, marginBottom: 0, marginTop: space.sm },
  meterFill: { height: '100%', backgroundColor: colors.gold, borderRadius: radius.pill },
  meterFillThin: { backgroundColor: colors.bronze },

  /* Summary rows */
  infoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { ...type.body, color: colors.ink },
  infoValue: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.gold,
    letterSpacing: 0.2,
  },

  quote: {
    ...type.body,
    fontFamily: fonts.reading,
    fontSize: 15,
    lineHeight: 24,
    color: colors.inkMuted,
    paddingVertical: space.lg,
  },
  empty: { ...type.body, color: colors.inkMuted, paddingVertical: space.lg },

  /* Recent */
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  recentBody: { flex: 1 },
  recentTitle: { ...type.title, color: colors.ink },
  recentAuthor: { ...type.caption, color: colors.bronze, marginTop: 2 },
  recentFigures: { alignItems: 'flex-end' },
  recentPercent: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.gold,
  },
  recentPages: { ...type.caption, color: colors.inkMuted, marginTop: 2 },
});
