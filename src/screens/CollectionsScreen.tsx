import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useApp } from '../context/AppContext';

export default function CollectionsScreen() {
  const { collections, books, createCollection, deleteCollection, addBookToCollection, removeBookFromCollection, settings } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [collectionDesc, setCollectionDesc] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  const bgColor = settings.theme === 'light' ? '#f5f5f5' : '#0f0a1a';
  const textColor = settings.theme === 'light' ? '#333' : '#c9a961';
  const secondaryColor = settings.theme === 'light' ? '#666' : '#8b7355';
  const accentColor = settings.theme === 'light' ? '#e0e0e0' : '#2d1b4e';
  const borderColor = settings.theme === 'light' ? '#ddd' : '#c9a961';

  const handleCreateCollection = async () => {
    if (!collectionName.trim()) {
      Alert.alert('Required', 'Collection name is required');
      return;
    }

    await createCollection({
      name: collectionName.trim(),
      description: collectionDesc.trim() || undefined,
      bookIds: [],
      createdDate: Date.now(),
      category: 'custom',
    });

    setCollectionName('');
    setCollectionDesc('');
    setShowModal(false);
    Alert.alert('Success', 'Collection created');
  };

  const handleDeleteCollection = async (id: string) => {
    Alert.alert('Delete Collection', 'Are you sure? This will not delete the books.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCollection(id);
        },
      },
    ]);
  };

  const selectedCollection = collections.find(c => c.id === selectedCollectionId);
  const collectionBooks = selectedCollection
    ? books.filter(b => selectedCollection.bookIds.includes(b.id))
    : [];

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Text style={[styles.title, { color: textColor }]}>✦ Collections ✦</Text>
        <Text style={[styles.subtitle, { color: secondaryColor }]}>Organize your library</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Create Collection Button */}
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: accentColor, borderColor }]}
          onPress={() => setShowModal(true)}
        >
          <Text style={[styles.createButtonText, { color: textColor }]}>+ Create New Collection</Text>
        </TouchableOpacity>

        {/* Collections List */}
        {collections.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: accentColor, borderColor }]}>
            <Text style={[styles.emptyText, { color: secondaryColor }]}>
              No collections yet.\n\nCreate one to organize your books by topic, theme, or reading level.
            </Text>
          </View>
        ) : (
          collections.map((collection) => (
            <TouchableOpacity
              key={collection.id}
              style={[styles.collectionCard, { backgroundColor: accentColor, borderColor }]}
              onPress={() => setSelectedCollectionId(collection.id)}
            >
              <View style={styles.collectionHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.collectionName, { color: textColor }]}>
                    {collection.name}
                  </Text>
                  {collection.description && (
                    <Text style={[styles.collectionDesc, { color: secondaryColor }]}>
                      {collection.description}
                    </Text>
                  )}
                </View>
                <View style={[styles.bookCount, { backgroundColor: textColor }]}>
                  <Text style={[styles.bookCountText, { color: bgColor }]}>
                    {collection.bookIds.length}
                  </Text>
                </View>
              </View>

              <View style={styles.collectionActions}>
                <TouchableOpacity
                  style={[styles.actionButton, { borderColor: secondaryColor }]}
                  onPress={() => setSelectedCollectionId(collection.id)}
                >
                  <Text style={[styles.actionButtonText, { color: textColor }]}>Manage</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { borderColor: secondaryColor }]}
                  onPress={() => handleDeleteCollection(collection.id)}
                >
                  <Text style={[styles.actionButtonText, { color: '#c67c7c' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Create Collection Modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}>
          <View style={[styles.modalContent, { backgroundColor: bgColor, borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>New Collection</Text>

            <TextInput
              placeholder="Collection Name"
              placeholderTextColor={secondaryColor}
              value={collectionName}
              onChangeText={setCollectionName}
              style={[styles.modalInput, { color: textColor, borderColor }]}
            />

            <TextInput
              placeholder="Description (optional)"
              placeholderTextColor={secondaryColor}
              value={collectionDesc}
              onChangeText={setCollectionDesc}
              multiline
              numberOfLines={2}
              style={[styles.modalInput, { color: textColor, borderColor }]}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: secondaryColor }]}
                onPress={() => setShowModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: secondaryColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: textColor }]}
                onPress={handleCreateCollection}
              >
                <Text style={[styles.modalButtonText, { color: bgColor }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Selected Collection Details */}
      {selectedCollection && (
        <Modal visible={!!selectedCollectionId} transparent animationType="slide">
          <View style={[styles.detailsContainer, { backgroundColor: bgColor }]}>
            <View style={[styles.detailsHeader, { borderBottomColor: borderColor }]}>
              <TouchableOpacity onPress={() => setSelectedCollectionId(null)}>
                <Text style={[styles.backButton, { color: textColor }]}>← Back</Text>
              </TouchableOpacity>
              <Text style={[styles.detailsTitle, { color: textColor }]}>{selectedCollection.name}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.detailsContent}>
              {collectionBooks.length === 0 ? (
                <Text style={[styles.noBooks, { color: secondaryColor }]}>
                  No books in this collection yet
                </Text>
              ) : (
                collectionBooks.map((book) => (
                  <View key={book.id} style={[styles.bookItem, { backgroundColor: accentColor, borderColor }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bookTitle, { color: textColor }]}>{book.title}</Text>
                      {book.author && (
                        <Text style={[styles.bookAuthor, { color: secondaryColor }]}>{book.author}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => removeBookFromCollection(selectedCollection.id, book.id)}
                    >
                      <Text style={[styles.removeText, { color: '#c67c7c' }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </Modal>
      )}
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
  content: { paddingHorizontal: 16, paddingVertical: 16 },
  createButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 2,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: 'center',
  },
  createButtonText: { fontWeight: '400', fontSize: 13, letterSpacing: 1 },
  emptyState: {
    paddingHorizontal: 12,
    paddingVertical: 24,
    borderRadius: 2,
    borderWidth: 1,
    borderLeftWidth: 2,
  },
  emptyText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  collectionCard: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderLeftWidth: 2,
  },
  collectionHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  collectionName: { fontSize: 16, fontWeight: '600', fontFamily: 'Georgia' },
  collectionDesc: { fontSize: 11, marginTop: 2 },
  bookCount: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookCountText: { fontWeight: '600', fontSize: 14 },
  collectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionButtonText: { fontSize: 11, fontWeight: '400' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 8,
    borderWidth: 2,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalButtonText: { fontWeight: '600', fontSize: 13 },
  detailsContainer: { flex: 1 },
  detailsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: { fontSize: 14, fontWeight: '400' },
  detailsTitle: { fontSize: 18, fontWeight: '600', flex: 1 },
  detailsContent: { paddingHorizontal: 16, paddingVertical: 12 },
  noBooks: { fontSize: 14, textAlign: 'center', marginVertical: 20 },
  bookItem: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
  },
  bookTitle: { fontSize: 14, fontWeight: '600' },
  bookAuthor: { fontSize: 12, marginTop: 2 },
  removeText: { fontSize: 12, fontWeight: '400' },
});
