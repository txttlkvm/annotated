import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';

interface Chapter {
  id: string;
  title: string;
  page: number;
  level: number; // For nested chapters
  children?: Chapter[];
}

export default function TableOfContentsScreen({ route, navigation }: any) {
  const { currentBook, settings } = useApp();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const bgColor = settings.theme === 'light' ? '#f5f5f5' : '#0f0a1a';
  const textColor = settings.theme === 'light' ? '#333' : '#c9a961';
  const secondaryColor = settings.theme === 'light' ? '#666' : '#8b7355';
  const accentColor = settings.theme === 'light' ? '#e0e0e0' : '#2d1b4e';
  const borderColor = settings.theme === 'light' ? '#ddd' : '#c9a961';

  useEffect(() => {
    // Generate sample chapters based on book
    generateChapters();
  }, [currentBook]);

  const generateChapters = () => {
    // This would normally parse EPUB or extract from the actual file
    // For now, we'll generate sample chapters
    if (!currentBook) return;

    const totalPages = currentBook.totalPages || 300;
    const chapterCount = Math.ceil(totalPages / 30);

    const sampleChapters: Chapter[] = [];
    for (let i = 1; i <= Math.min(chapterCount, 20); i++) {
      sampleChapters.push({
        id: `ch-${i}`,
        title: `Chapter ${i}: ${['Introduction', 'The Beginning', 'Exploration', 'Conflict', 'Resolution', 'Discovery'][i % 6] || 'Continuation'}`,
        page: i * 30,
        level: 0,
      });
    }

    setChapters(sampleChapters);
  };

  const toggleChapter = (id: string) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedChapters(newExpanded);
  };

  const handleJumpToChapter = (page: number) => {
    // Would navigate to reader and jump to page
    Alert.alert('Jump to Page', `Go to page ${page}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Go',
        onPress: () => {
          // navigation.navigate('Reading', { screen: 'ReaderHome', params: { jumpToPage: page } });
          navigation.goBack();
        },
      },
    ]);
  };

  const ChapterItem = ({ chapter, level = 0 }: { chapter: Chapter; level?: number }) => {
    const isExpanded = expandedChapters.has(chapter.id);

    return (
      <View key={chapter.id}>
        <TouchableOpacity
          style={[
            styles.chapterItem,
            {
              marginLeft: level * 16,
              borderColor,
              backgroundColor: level > 0 ? accentColor : 'transparent',
            },
          ]}
          onPress={() => {
            if (chapter.children && chapter.children.length > 0) {
              toggleChapter(chapter.id);
            } else {
              handleJumpToChapter(chapter.page);
            }
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.chapterTitle,
                { color: textColor, marginLeft: level > 0 ? 12 : 0 },
              ]}
              numberOfLines={2}
            >
              {chapter.children && chapter.children.length > 0 ? (isExpanded ? '▼' : '▶') + ' ' : ''}
              {chapter.title}
            </Text>
          </View>
          <Text style={[styles.pageNumber, { color: secondaryColor }]}>
            p. {chapter.page}
          </Text>
        </TouchableOpacity>

        {isExpanded &&
          chapter.children &&
          chapter.children.map((child) => (
            <ChapterItem key={child.id} chapter={child} level={level + 1} />
          ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: textColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: textColor }]}>✦ Contents ✦</Text>
      </View>

      {/* Book Info */}
      {currentBook && (
        <View style={[styles.bookInfo, { backgroundColor: accentColor, borderColor }]}>
          <Text style={[styles.bookTitle, { color: textColor }]} numberOfLines={1}>
            {currentBook.title}
          </Text>
          <Text style={[styles.bookAuthor, { color: secondaryColor }]} numberOfLines={1}>
            {currentBook.author}
          </Text>
        </View>
      )}

      {/* Chapters List */}
      <ScrollView contentContainerStyle={styles.content}>
        {chapters.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: accentColor, borderColor }]}>
            <Text style={[styles.emptyText, { color: secondaryColor }]}>
              No chapters found.\n\nThis feature works with books that have chapter information.
            </Text>
          </View>
        ) : (
          chapters.map((chapter) => <ChapterItem key={chapter.id} chapter={chapter} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    gap: 12,
  },
  backButton: { fontSize: 15, fontWeight: '400', letterSpacing: 1 },
  title: { fontSize: 18, fontWeight: '400', fontFamily: 'Georgia', letterSpacing: 1, flex: 1 },
  bookInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderLeftWidth: 2,
  },
  bookTitle: { fontSize: 14, fontWeight: '600', fontFamily: 'Georgia', marginBottom: 2 },
  bookAuthor: { fontSize: 12, letterSpacing: 0.5 },
  content: { paddingHorizontal: 16, paddingVertical: 12 },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 4,
    borderRadius: 2,
    borderWidth: 1,
    borderLeftWidth: 2,
  },
  chapterTitle: { fontSize: 14, fontWeight: '400', lineHeight: 18, letterSpacing: 0.3 },
  pageNumber: { fontSize: 12, marginLeft: 12, fontWeight: '400' },
  emptyState: {
    paddingHorizontal: 12,
    paddingVertical: 24,
    borderRadius: 2,
    borderWidth: 1,
    borderLeftWidth: 2,
    marginVertical: 20,
    alignItems: 'center',
  },
  emptyText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
