import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';

export default function StoreScreen() {
  const [category, setCategory] = useState('featured');

  const categories = ['Featured', 'Free Books', 'Bestsellers', 'Fiction', 'Science', 'Self-Help'];

  const books = [
    { id: 1, title: 'The Art of War', author: 'Sun Tzu', price: 'Free', rating: 4.8 },
    { id: 2, title: 'Pride and Prejudice', author: 'Jane Austen', price: 'Free', rating: 4.7 },
    { id: 3, title: 'Alice in Wonderland', author: 'Lewis Carroll', price: 'Free', rating: 4.6 },
    { id: 4, title: 'Sherlock Holmes', author: 'Arthur Conan Doyle', price: 'Free', rating: 4.9 },
    { id: 5, title: 'Emma', author: 'Jane Austen', price: 'Free', rating: 4.7 },
    { id: 6, title: 'Dracula', author: 'Bram Stoker', price: 'Free', rating: 4.5 },
  ];

  const BookCard = ({ book }: any) => (
    <TouchableOpacity style={styles.bookCard} activeOpacity={0.8}>
      <View style={styles.bookCover}>
        <Text style={styles.bookEmoji}>📖</Text>
      </View>
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
        <Text style={styles.bookAuthor}>{book.author}</Text>
        <View style={styles.bookMeta}>
          <Text style={styles.price}>{book.price}</Text>
          <View style={styles.rating}>
            <Text style={styles.stars}>⭐ {book.rating}</Text>
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
        <Text style={styles.bannerTitle}>📚 Discover Books</Text>
        <Text style={styles.bannerSubtitle}>50,000+ free and premium titles</Text>
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
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  banner: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  bannerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  bannerSubtitle: { fontSize: 13, color: '#e0e0e0' },
  categoryScroll: { borderBottomWidth: 1, borderBottomColor: '#333' },
  categoryContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    marginRight: 8,
  },
  categoryTabActive: { backgroundColor: '#4A90E2' },
  categoryText: { color: '#888', fontSize: 12, fontWeight: '600' },
  categoryTextActive: { color: '#fff' },
  booksContent: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 32 },
  bookCard: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    alignItems: 'center',
  },
  bookCover: {
    width: 50,
    height: 70,
    backgroundColor: '#333',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bookEmoji: { fontSize: 24 },
  bookInfo: { flex: 1 },
  bookTitle: { fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 4 },
  bookAuthor: { fontSize: 11, color: '#aaa', marginBottom: 6 },
  bookMeta: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  price: { fontSize: 12, fontWeight: '700', color: '#52C41A' },
  rating: { marginLeft: 'auto' },
  stars: { fontSize: 11, color: '#FFB800' },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  addBtnText: { fontSize: 18, color: '#fff', fontWeight: 'bold' },
});
