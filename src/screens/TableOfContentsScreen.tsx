import React, { useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { GutenbergService } from '../services/GutenbergService';
import Shell from '../components/Shell';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import { colors, space, radius, type as t, elevation } from '../theme';

/**
 * Real chapters from the currently-loaded book, not the old hardcoded
 * "Chapter 1: Introduction" / "Chapter 2: The Beginning" placeholder list
 * that ignored which book was actually open. Parses the same content
 * ReaderScreen already holds — no separate fetch, no separate source of
 * truth to drift out of sync with what the reader shows.
 */
export default function TableOfContentsScreen() {
  const navigation = useNavigation<any>();
  const { currentBook } = useApp();

  const chapters = useMemo(() => {
    if (!currentBook?.content) return [];
    return GutenbergService.parse(GutenbergService.stripBoilerplate(currentBook.content)).chapters;
  }, [currentBook?.content]);

  const jumpTo = (chapterIndex: number) => {
    navigation.navigate('ReaderHome', { jumpToChapter: chapterIndex });
  };

  return (
    <Shell scroll gutter={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <ChevronLeftIcon size={16} color={colors.gold} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.title}>Contents</Text>
        <View style={{ width: 16 }} />
      </View>

      {!!currentBook && (
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={1}>
            {currentBook.title}
          </Text>
          {!!currentBook.author && (
            <Text style={styles.bookAuthor} numberOfLines={1}>
              {currentBook.author}
            </Text>
          )}
        </View>
      )}

      {chapters.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {currentBook?.content
              ? 'No chapter headings were detected in this text.'
              : 'Open the book to load its contents first.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={chapters}
          keyExtractor={(c) => String(c.index)}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => jumpTo(item.index)}
              accessibilityRole="button"
              accessibilityLabel={`Go to ${item.title}`}
            >
              <Text style={styles.rowTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <ChevronRightIcon size={14} color={colors.bronze} strokeWidth={1.8} />
            </TouchableOpacity>
          )}
        />
      )}
    </Shell>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xxxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  title: { ...t.heading, color: colors.gold },
  bookInfo: { marginBottom: space.lg },
  bookTitle: { ...t.title, color: colors.gold, marginBottom: 2 },
  bookAuthor: { ...t.caption, color: colors.bronze, fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: space.sm,
    ...elevation.card,
  },
  rowTitle: { ...t.body, color: colors.ink, flex: 1, marginRight: space.sm },
  empty: { paddingVertical: space.xxl, alignItems: 'center' },
  emptyText: { ...t.body, color: colors.bronze, textAlign: 'center' },
});
