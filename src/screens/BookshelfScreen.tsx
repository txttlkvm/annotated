import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { useApp } from '../context/AppContext';

const SHELF_WIDTH = Dimensions.get('window').width;
const BOOK_WIDTH = (SHELF_WIDTH - 48) / 3;
const BOOK_HEIGHT = BOOK_WIDTH * 1.5;

export default function BookshelfScreen() {
  const { books, settings } = useApp();
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);

  const bgColor = settings.theme === 'light' ? '#f5f5f5' : '#0f0a1a';
  const textColor = settings.theme === 'light' ? '#333' : '#c9a961';
  const secondaryColor = settings.theme === 'light' ? '#666' : '#8b7355';
  const shelfColor = settings.theme === 'light' ? '#d4a574' : '#8b7355';
  const shadowColor = settings.theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.5)';

  const currentlyReading = books.filter(b => !b.isFinished && b.currentProgress > 0);
  const finished = books.filter(b => b.isFinished);
  const toRead = books.filter(b => !b.isFinished && b.currentProgress === 0);

  const BookCover = ({ book }: { book: any }) => {
    const coverColor = book.coverColor || '#2d1b4e';
    return (
      <TouchableOpacity
        style={[
          styles.bookCover,
          {
            width: BOOK_WIDTH,
            height: BOOK_HEIGHT,
            backgroundColor: coverColor,
            borderColor: textColor,
          },
        ]}
        onPress={() => setExpandedBookId(expandedBookId === book.id ? null : book.id)}
      >
        <View style={styles.bookContent}>
          <Text style={[styles.bookSymbol, { color: '#c9a961' }]}>✦</Text>
          <Text
            style={[styles.bookTitle, { color: '#c9a961' }]}
            numberOfLines={2}
          >
            {book.title}
          </Text>
          <Text
            style={[styles.bookAuthor, { color: '#a8a478' }]}
            numberOfLines={1}
          >
            {book.author || 'Unknown'}
          </Text>
        </View>

        {/* Progress Bar */}
        {book.currentProgress > 0 && !book.isFinished && (
          <View style={[styles.progressBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(book.currentProgress, 100)}%`,
                  backgroundColor: '#c9a961',
                },
              ]}
            />
          </View>
        )}

        {/* Finished Badge */}
        {book.isFinished && (
          <View style={[styles.finishedBadge, { backgroundColor: '#c9a961' }]}>
            <Text style={[styles.finishedText, { color: '#0f0a1a' }]}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const ShelfSection = ({
    title,
    books: sectionBooks,
    icon,
  }: {
    title: string;
    books: any[];
    icon: string;
  }) => (
    <View style={styles.shelfSection}>
      {/* Shelf Top */}
      <View style={[styles.shelfTop, { backgroundColor: shelfColor }]} />

      {/* Section Title */}
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        {icon} {title}
      </Text>

      {/* Books Grid */}
      <View style={styles.booksGrid}>
        {sectionBooks.length === 0 ? (
          <View style={[styles.emptyShelf, { width: SHELF_WIDTH - 32 }]}>
            <Text style={[styles.emptyText, { color: secondaryColor }]}>
              No books yet
            </Text>
          </View>
        ) : (
          sectionBooks.map((book) => (
            <View key={book.id} style={{ marginBottom: 16 }}>
              <BookCover book={book} />

              {/* Expanded Details */}
              {expandedBookId === book.id && (
                <View
                  style={[
                    styles.bookDetails,
                    {
                      backgroundColor: '#2d1b4e',
                      borderColor: textColor,
                      width: BOOK_WIDTH,
                    },
                  ]}
                >
                  <Text
                    style={[styles.detailsTitle, { color: textColor }]}
                    numberOfLines={2}
                  >
                    {book.title}
                  </Text>
                  {book.description && (
                    <Text
                      style={[styles.detailsDescription, { color: secondaryColor }]}
                      numberOfLines={3}
                    >
                      {book.description}
                    </Text>
                  )}
                  <Text
                    style={[styles.detailsMeta, { color: secondaryColor }]}
                  >
                    {book.currentProgress}% complete
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* Shelf Bottom */}
      <View style={[styles.shelfBottom, { backgroundColor: shelfColor }]} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>✦ Personal Library ✦</Text>
        <Text style={[styles.subtitle, { color: secondaryColor }]}>
          {books.length} book{books.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.shelves}>
        {currentlyReading.length > 0 && (
          <ShelfSection
            title="Currently Reading"
            books={currentlyReading}
            icon="📖"
          />
        )}

        {toRead.length > 0 && (
          <ShelfSection
            title="To Read"
            books={toRead}
            icon="📚"
          />
        )}

        {finished.length > 0 && (
          <ShelfSection
            title="Finished Reading"
            books={finished}
            icon="✓"
          />
        )}

        {books.length === 0 && (
          <View style={[styles.emptyLibrary, { backgroundColor: '#2d1b4e' }]}>
            <Text style={[styles.emptyTitle, { color: textColor }]}>
              Your library is empty
            </Text>
            <Text style={[styles.emptyMessage, { color: secondaryColor }]}>
              Add books to see them displayed on your personal bookshelf
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  title: { fontSize: 22, fontWeight: '400', fontFamily: 'Georgia', letterSpacing: 1, marginBottom: 4 },
  subtitle: { fontSize: 12, letterSpacing: 0.5 },
  shelves: { paddingHorizontal: 16, paddingVertical: 16 },
  shelfSection: {
    marginBottom: 32,
  },
  shelfTop: {
    height: 8,
    borderRadius: 2,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  sectionTitle: { fontSize: 14, fontWeight: '400', fontFamily: 'Georgia', letterSpacing: 1, marginBottom: 12 },
  booksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  bookCover: {
    borderWidth: 2,
    borderRadius: 2,
    padding: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookSymbol: { fontSize: 36, marginBottom: 8 },
  bookTitle: { fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 14 },
  bookAuthor: { fontSize: 9, textAlign: 'center', marginTop: 4 },
  progressBar: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: { height: '100%' },
  finishedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishedText: { fontWeight: 'bold', fontSize: 14 },
  bookDetails: {
    padding: 8,
    borderRadius: 2,
    borderWidth: 1,
    marginTop: -4,
  },
  detailsTitle: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  detailsDescription: { fontSize: 9, lineHeight: 12, marginBottom: 4 },
  detailsMeta: { fontSize: 9 },
  shelfBottom: {
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  emptyShelf: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 100,
  },
  emptyText: { fontSize: 13, fontStyle: 'italic' },
  emptyLibrary: {
    marginTop: 40,
    paddingHorizontal: 16,
    paddingVertical: 40,
    borderRadius: 2,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyMessage: { fontSize: 12, textAlign: 'center', lineHeight: 16 },
});
