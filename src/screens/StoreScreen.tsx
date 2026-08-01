import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';

export default function StoreScreen() {
  const [category, setCategory] = useState('featured');

  const categories = ['Featured', 'Free Books', 'Classics', 'Philosophy', 'Poetry', 'Sacred Texts'];

  const books = [
    { id: 1, title: 'The Art of War', author: 'Sun Tzu', price: 'Free', rating: 4.8 },
    { id: 2, title: 'Pride and Prejudice', author: 'Jane Austen', price: 'Free', rating: 4.7 },
    { id: 3, title: 'The Divine Comedy', author: 'Dante Alighieri', price: 'Free', rating: 4.9 },
    { id: 4, title: 'Paradise Lost', author: 'John Milton', price: 'Free', rating: 4.8 },
    { id: 5, title: 'Jane Eyre', author: 'Charlotte Brontë', price: 'Free', rating: 4.7 },
    { id: 6, title: 'Wuthering Heights', author: 'Emily Brontë', price: 'Free', rating: 4.6 },
  ];

  const BookCard = ({ book }: any) => (
    <TouchableOpacity style={styles.bookCard} activeOpacity={0.8}>
      <View style={styles.bookCover}>
        <Text style={styles.bookSymbol}>✦</Text>
      </View>
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
        <Text style={styles.bookAuthor}>{book.author}</Text>
        <View style={styles.bookMeta}>
          <Text style={styles.price}>{book.price}</Text>
          <View style={styles.rating}>
            <Text style={styles.stars}>✦ {book.rating}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.addBtn}>
        <Text style={styles.addBtnText}>+</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Featured Banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>✦ Discover Manuscripts ✦</Text>
        <Text style={styles.bannerSubtitle}>50,000+ volumes across worlds and ages</Text>
      </View>

      {/* Category Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}
      >
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryTab,
              category === cat.toLowerCase() && styles.categoryTabActive,
            ]}
            onPress={() => setCategory(cat.toLowerCase())}
          >
            <Text
              style={[
                styles.categoryText,
                category === cat.toLowerCase() && styles.categoryTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Books Grid */}
      <ScrollView contentContainerStyle={styles.booksContent}>
        {books.map(book => (
          <BookCard key={book.id} book={book} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0a1a' },
  banner: {
    backgroundColor: '#1a1328',
    paddingHorizontal: 16,
    paddingVertical: 28,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#c9a961',
  },
  bannerTitle: { fontSize: 22, fontWeight: '400', color: '#c9a961', marginBottom: 8, letterSpacing: 2, fontFamily: 'Georgia' },
  bannerSubtitle: { fontSize: 11, color: '#8b7355', letterSpacing: 1, fontStyle: 'italic' },
  categoryScroll: { borderBottomWidth: 1, borderBottomColor: '#3d3730' },
  categoryContent: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 2,
    backgroundColor: '#2d1b4e',
    borderWidth: 1,
    borderColor: '#8b7355',
    marginRight: 8,
  },
  categoryTabActive: { backgroundColor: '#3d3730', borderColor: '#c9a961' },
  categoryText: { color: '#8b7355', fontSize: 11, fontWeight: '400', letterSpacing: 1, fontFamily: 'Georgia' },
  categoryTextActive: { color: '#c9a961' },
  booksContent: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 32 },
  bookCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1328',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#8b7355',
    marginBottom: 12,
    padding: 12,
    alignItems: 'center',
  },
  bookCover: {
    width: 50,
    height: 70,
    backgroundColor: '#2d1b4e',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: '#c9a961',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bookSymbol: { fontSize: 28, color: '#c9a961', fontWeight: '300' },
  bookInfo: { flex: 1 },
  bookTitle: { fontSize: 12, fontWeight: '400', color: '#c9a961', marginBottom: 4, fontFamily: 'Georgia' },
  bookAuthor: { fontSize: 10, color: '#8b7355', marginBottom: 6, letterSpacing: 0.5 },
  bookMeta: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  price: { fontSize: 11, fontWeight: '400', color: '#c9a961', letterSpacing: 1 },
  rating: { marginLeft: 'auto' },
  stars: { fontSize: 10, color: '#8b7355', letterSpacing: 1 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 2,
    backgroundColor: '#2d1b4e',
    borderWidth: 1,
    borderColor: '#c9a961',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  addBtnText: { fontSize: 18, color: '#c9a961', fontWeight: '300' },
});
