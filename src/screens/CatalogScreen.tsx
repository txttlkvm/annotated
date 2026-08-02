import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useApp } from '../context/AppContext';

export default function CatalogScreen() {
  const { getClassicalLibrary, books, addClassicalLibraryItem, settings } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filteredItems, setFilteredItems] = useState([]);

  const bgColor = settings.theme === 'light' ? '#f5f5f5' : '#0f0a1a';
  const textColor = settings.theme === 'light' ? '#333' : '#c9a961';
  const secondaryColor = settings.theme === 'light' ? '#666' : '#8b7355';
  const accentColor = settings.theme === 'light' ? '#e0e0e0' : '#2d1b4e';
  const borderColor = settings.theme === 'light' ? '#ddd' : '#c9a961';

  useEffect(() => {
    performSearch();
  }, [searchQuery]);

  const performSearch = () => {
    setIsSearching(true);

    try {
      const library = getClassicalLibrary();
      const bookIds = new Set(books.map(b => b.id));

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const results = library.filter(
          item =>
            !bookIds.has(item.id) && // Not already in library
            (item.title.toLowerCase().includes(query) ||
              item.author.toLowerCase().includes(query) ||
              item.description.toLowerCase().includes(query))
        );
        setFilteredItems(results.slice(0, 50)); // Limit to 50 results
      } else {
        // Show all uncatalogued items
        const allItems = library
          .filter(item => !bookIds.has(item.id))
          .slice(0, 30);
        setFilteredItems(allItems);
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Could not search catalog');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddItem = async (item: any) => {
    try {
      await addClassicalLibraryItem(item);
      Alert.alert('Added', `"${item.title}" added to your library`);
      setFilteredItems(filteredItems.filter(i => i.id !== item.id));
    } catch (error) {
      Alert.alert('Error', 'Could not add item to library');
    }
  };

  const ItemCard = ({ item }: { item: any }) => (
    <View style={[styles.itemCard, { backgroundColor: accentColor, borderColor }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemTitle, { color: textColor }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.itemAuthor, { color: secondaryColor }]} numberOfLines={1}>
          {item.author}
        </Text>
        <View style={styles.itemMeta}>
          <Text style={[styles.itemType, { color: secondaryColor }]}>
            {item.type === 'book'
              ? '📖'
              : item.type === 'music'
              ? '♪'
              : item.type === 'art'
              ? '✎'
              : '📄'}{' '}
            {item.category}
          </Text>
          {item.tier && (
            <Text style={[styles.itemTier, { color: secondaryColor }]}>
              Tier {item.tier}
            </Text>
          )}
        </View>
        <Text style={[styles.itemDesc, { color: secondaryColor }]} numberOfLines={2}>
          {item.description}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: textColor }]}
        onPress={() => handleAddItem(item)}
      >
        <Text style={[styles.addButtonText, { color: bgColor }]}>+ Add</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Text style={[styles.title, { color: textColor }]}>✦ Classical Catalog ✦</Text>
        <Text style={[styles.subtitle, { color: secondaryColor }]}>
          Discover texts not yet in your library
        </Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: accentColor, borderColor }]}>
        <TextInput
          placeholder="Search by title, author, or topic..."
          placeholderTextColor={secondaryColor}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[styles.searchInput, { color: textColor, borderColor }]}
        />
      </View>

      {/* Results */}
      <ScrollView contentContainerStyle={styles.content}>
        {isSearching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={textColor} />
            <Text style={[styles.loadingText, { color: secondaryColor }]}>Searching catalog...</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: accentColor, borderColor }]}>
            <Text style={[styles.emptyTitle, { color: textColor }]}>
              {searchQuery ? 'No results found' : 'Catalog empty'}
            </Text>
            <Text style={[styles.emptyText, { color: secondaryColor }]}>
              {searchQuery
                ? 'Try a different search term'
                : 'All items are already in your library'}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.resultCount, { color: secondaryColor }]}>
              {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} found
            </Text>
            {filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </>
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
    borderBottomWidth: 2,
  },
  title: { fontSize: 22, fontWeight: '400', fontFamily: 'Georgia', letterSpacing: 1, marginBottom: 4 },
  subtitle: { fontSize: 12, letterSpacing: 0.5 },
  searchContainer: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderLeftWidth: 2,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  content: { paddingHorizontal: 16, paddingVertical: 12 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center', marginVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 12 },
  resultCount: { fontSize: 12, letterSpacing: 0.5, marginBottom: 12, fontStyle: 'italic' },
  emptyState: {
    paddingHorizontal: 12,
    paddingVertical: 40,
    borderRadius: 2,
    borderWidth: 1,
    borderLeftWidth: 2,
    alignItems: 'center',
    marginVertical: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  emptyText: { fontSize: 12, textAlign: 'center' },
  itemCard: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderLeftWidth: 2,
    alignItems: 'flex-start',
    gap: 12,
  },
  itemTitle: { fontSize: 14, fontWeight: '600', fontFamily: 'Georgia', marginBottom: 2 },
  itemAuthor: { fontSize: 12, marginBottom: 4 },
  itemMeta: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  itemType: { fontSize: 11 },
  itemTier: { fontSize: 10 },
  itemDesc: { fontSize: 11, lineHeight: 14, marginTop: 4 },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 2,
  },
  addButtonText: { fontWeight: '600', fontSize: 11, letterSpacing: 0.5 },
});
