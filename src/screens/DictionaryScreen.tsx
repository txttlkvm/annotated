import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useApp } from '../context/AppContext';

export default function DictionaryScreen() {
  const { wordLookups, addWordLookup, deleteWordLookup, settings } = useApp();
  const [searchWord, setSearchWord] = useState('');
  const [definition, setDefinition] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filteredWords, setFilteredWords] = useState(wordLookups);

  const bgColor = settings.theme === 'light' ? '#f5f5f5' : '#0f0a1a';
  const textColor = settings.theme === 'light' ? '#333' : '#c9a961';
  const secondaryColor = settings.theme === 'light' ? '#666' : '#8b7355';
  const accentColor = settings.theme === 'light' ? '#e0e0e0' : '#2d1b4e';
  const borderColor = settings.theme === 'light' ? '#ddd' : '#c9a961';

  useEffect(() => {
    if (searchWord.trim()) {
      setFilteredWords(
        wordLookups.filter(w =>
          w.word.toLowerCase().includes(searchWord.toLowerCase())
        )
      );
    } else {
      setFilteredWords(wordLookups);
    }
  }, [searchWord, wordLookups]);

  const handleAddWord = async () => {
    if (!searchWord.trim() || !definition.trim()) {
      Alert.alert('Required Fields', 'Please enter word and definition');
      return;
    }

    await addWordLookup({
      word: searchWord.trim(),
      definition: definition.trim(),
      partOfSpeech: partOfSpeech.trim() || undefined,
    });

    setSearchWord('');
    setDefinition('');
    setPartOfSpeech('');
    Alert.alert('Success', 'Word added to your vocabulary');
  };

  const handleDeleteWord = async (id: string) => {
    Alert.alert('Delete Word', 'Remove this word from your vocabulary?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteWordLookup(id);
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Text style={[styles.title, { color: textColor }]}>✦ Vocabulary Lexicon ✦</Text>
        <Text style={[styles.subtitle, { color: secondaryColor }]}>
          {wordLookups.length} word{wordLookups.length !== 1 ? 's' : ''} studied
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Search/Add Word Section */}
        <View style={[styles.addSection, { backgroundColor: accentColor, borderColor }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>— Add New Word —</Text>

          <TextInput
            placeholder="Word"
            placeholderTextColor={secondaryColor}
            value={searchWord}
            onChangeText={setSearchWord}
            style={[styles.input, { color: textColor, borderColor: borderColor }]}
          />

          <TextInput
            placeholder="Part of Speech (noun, verb, etc.)"
            placeholderTextColor={secondaryColor}
            value={partOfSpeech}
            onChangeText={setPartOfSpeech}
            style={[styles.input, { color: textColor, borderColor: borderColor }]}
          />

          <TextInput
            placeholder="Definition"
            placeholderTextColor={secondaryColor}
            value={definition}
            onChangeText={setDefinition}
            multiline
            numberOfLines={3}
            style={[styles.input, { color: textColor, borderColor: borderColor, textAlignVertical: 'top' }]}
          />

          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: textColor }]}
            onPress={handleAddWord}
          >
            <Text style={[styles.addButtonText, { color: bgColor }]}>Add to Vocabulary</Text>
          </TouchableOpacity>
        </View>

        {/* Search Box */}
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Search vocabulary..."
            placeholderTextColor={secondaryColor}
            value={searchWord}
            onChangeText={setSearchWord}
            style={[styles.searchInput, { color: textColor, borderColor }]}
          />
        </View>

        {/* Words List */}
        {filteredWords.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: accentColor, borderColor }]}>
            <Text style={[styles.emptyText, { color: secondaryColor }]}>
              No words in your vocabulary yet.{'\n\n'}Start by adding words you encounter while reading.
            </Text>
          </View>
        ) : (
          filteredWords.map((lookup) => (
            <View key={lookup.id} style={[styles.wordCard, { backgroundColor: accentColor, borderColor }]}>
              <View style={styles.wordHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.word, { color: textColor }]}>{lookup.word}</Text>
                  {lookup.partOfSpeech && (
                    <Text style={[styles.partOfSpeech, { color: secondaryColor }]}>
                      {lookup.partOfSpeech}
                    </Text>
                  )}
                </View>
                <Text style={[styles.date, { color: secondaryColor }]}>
                  {new Date(lookup.timestamp).toLocaleDateString()}
                </Text>
              </View>

              <Text style={[styles.definition, { color: textColor }]}>
                {lookup.definition}
              </Text>

              {lookup.synonyms && lookup.synonyms.length > 0 && (
                <Text style={[styles.synonyms, { color: secondaryColor }]}>
                  Synonyms: {lookup.synonyms.join(', ')}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.deleteButton, { borderColor: secondaryColor }]}
                onPress={() => handleDeleteWord(lookup.id)}
              >
                <Text style={[styles.deleteButtonText, { color: secondaryColor }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
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
  content: { paddingHorizontal: 16, paddingVertical: 16 },
  addSection: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 20,
    borderRadius: 2,
    borderWidth: 1,
    borderLeftWidth: 2,
  },
  sectionTitle: { fontSize: 12, fontWeight: '400', fontFamily: 'Georgia', letterSpacing: 2, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    fontSize: 14,
    fontFamily: 'Georgia',
  },
  addButton: {
    paddingVertical: 10,
    borderRadius: 2,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: { fontWeight: '400', fontSize: 13, letterSpacing: 1 },
  searchContainer: { marginBottom: 20 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  emptyState: {
    paddingHorizontal: 12,
    paddingVertical: 24,
    borderRadius: 2,
    borderWidth: 1,
    borderLeftWidth: 2,
    alignItems: 'center',
  },
  emptyText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  wordCard: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderLeftWidth: 2,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  word: { fontSize: 16, fontWeight: '600', fontFamily: 'Georgia', letterSpacing: 0.5 },
  partOfSpeech: { fontSize: 11, fontStyle: 'italic', letterSpacing: 0.5, marginTop: 2 },
  date: { fontSize: 10, letterSpacing: 0.5 },
  definition: { fontSize: 13, lineHeight: 18, marginBottom: 8, letterSpacing: 0.3 },
  synonyms: { fontSize: 11, marginBottom: 8, fontStyle: 'italic' },
  deleteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 2,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  deleteButtonText: { fontSize: 11, letterSpacing: 0.5 },
});
