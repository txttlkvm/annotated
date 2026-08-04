import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  TextInputProps,
  Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { colors, fonts, space, radius, type, elevation } from '../theme';
import type { WordLookup } from '../types';

type SortMode = 'recent' | 'alpha';

/**
 * Labelled form field with a gold focus ring.
 *
 * The lexicon's "Add New Word" panel was three bare TextInputs stacked at 8px
 * apart; labels, breathing room and a visible focus state are what turn that
 * into something that looks authored.
 */
function Field({
  label,
  hint,
  style,
  onFocus,
  onBlur,
  ...props
}: { label: string; hint?: string } & TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.bronze}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          props.multiline && styles.inputMultiline,
          focused && styles.inputFocused,
          style,
        ]}
      />
      {!!hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

export default function DictionaryScreen() {
  const { wordLookups, addWordLookup, deleteWordLookup } = useApp();

  // The entry being composed. Kept separate from the search query so typing a
  // new word no longer wipes the list out from under you.
  const [newWord, setNewWord] = useState('');
  const [definition, setDefinition] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');

  const [searchWord, setSearchWord] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  const filteredWords = useMemo(() => {
    const q = searchWord.trim().toLowerCase();
    const list = q
      ? wordLookups.filter(
          (w) =>
            w.word.toLowerCase().includes(q) ||
            w.definition.toLowerCase().includes(q)
        )
      : wordLookups;

    if (sortMode === 'alpha') {
      return [...list].sort((a, b) =>
        a.word.toLowerCase().localeCompare(b.word.toLowerCase())
      );
    }
    return list;
  }, [wordLookups, searchWord, sortMode]);

  /** Alphabetical grouping — the letter rules are what make it read as a lexicon. */
  const groups = useMemo(() => {
    if (sortMode !== 'alpha') return null;
    const out: Array<{ letter: string; words: WordLookup[] }> = [];
    filteredWords.forEach((w) => {
      const letter = (w.word[0] || '#').toUpperCase();
      const last = out[out.length - 1];
      if (last && last.letter === letter) last.words.push(w);
      else out.push({ letter, words: [w] });
    });
    return out;
  }, [filteredWords, sortMode]);

  const canSubmit = !!newWord.trim() && !!definition.trim();

  const handleAddWord = async () => {
    if (!newWord.trim() || !definition.trim()) {
      Alert.alert('Required Fields', 'Please enter word and definition');
      return;
    }

    await addWordLookup({
      word: newWord.trim(),
      definition: definition.trim(),
      partOfSpeech: partOfSpeech.trim() || undefined,
    });

    setNewWord('');
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

  const renderWord = (lookup: WordLookup) => (
    <View key={lookup.id} style={styles.wordCard}>
      <View style={styles.cardAccent} />

      <View style={styles.wordHead}>
        <View style={styles.wordHeadText}>
          <Text style={styles.word}>{lookup.word}</Text>
          {!!lookup.pronunciation && (
            <Text style={styles.pronunciation}>{lookup.pronunciation}</Text>
          )}
        </View>
        {!!lookup.partOfSpeech && (
          <View style={styles.posTag}>
            <Text style={styles.posTagText}>{lookup.partOfSpeech}</Text>
          </View>
        )}
      </View>

      <Text style={styles.definition}>{lookup.definition}</Text>

      {!!lookup.example && <Text style={styles.example}>“{lookup.example}”</Text>}

      {!!lookup.synonyms && lookup.synonyms.length > 0 && (
        <View style={styles.synonymRow}>
          <Text style={styles.synonymLabel}>SYNONYMS</Text>
          <View style={styles.synonymChips}>
            {lookup.synonyms.map((s) => (
              <View key={s} style={styles.chip}>
                <Text style={styles.chipText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.wordFooter}>
        <Text style={styles.date}>
          {new Date(lookup.timestamp).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
        <TouchableOpacity onPress={() => handleDeleteWord(lookup.id)}>
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>VOCABULARY</Text>
        <Text style={styles.title}>Lexicon</Text>
        <Text style={styles.subtitle}>
          {wordLookups.length === 0
            ? 'Every word you meet and keep'
            : `${wordLookups.length} word${wordLookups.length === 1 ? '' : 's'} studied`}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Add New Word — designed panel, not raw inputs */}
        <View style={styles.addPanel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelGlyph}>✦</Text>
            <View style={styles.panelHeadText}>
              <Text style={styles.panelTitle}>Add a word</Text>
              <Text style={styles.panelSubtitle}>
                Copy it down as you read; the definition is yours to phrase.
              </Text>
            </View>
          </View>

          <View style={styles.panelRule} />

          <Field
            label="Word"
            placeholder="magnanimity"
            value={newWord}
            onChangeText={setNewWord}
            autoCapitalize="none"
          />

          <Field
            label="Part of speech"
            hint="Optional — noun, verb, adjective…"
            placeholder="noun"
            value={partOfSpeech}
            onChangeText={setPartOfSpeech}
            autoCapitalize="none"
          />

          <Field
            label="Definition"
            placeholder="Greatness of soul; the virtue of one who claims great honours and deserves them."
            value={definition}
            onChangeText={setDefinition}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity
            style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
            activeOpacity={0.85}
            onPress={handleAddWord}
          >
            <Text
              style={[
                styles.primaryButtonText,
                !canSubmit && styles.primaryButtonTextDisabled,
              ]}
            >
              Add to Lexicon
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section header + controls */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your words</Text>
          <View style={styles.sectionRule} />
          <View style={styles.segmented}>
            {(['recent', 'alpha'] as SortMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.segment, sortMode === mode && styles.segmentActive]}
                onPress={() => setSortMode(mode)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    sortMode === mode && styles.segmentTextActive,
                  ]}
                >
                  {mode === 'recent' ? 'Recent' : 'A–Z'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            placeholder="Search your lexicon…"
            placeholderTextColor={colors.bronze}
            value={searchWord}
            onChangeText={setSearchWord}
            style={styles.searchInput}
          />
          {!!searchWord && (
            <TouchableOpacity onPress={() => setSearchWord('')}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Words */}
        {filteredWords.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyGlyph}>❧</Text>
            <Text style={styles.emptyTitle}>
              {wordLookups.length === 0 ? 'The lexicon is empty' : 'No matches'}
            </Text>
            <Text style={styles.emptyBody}>
              {wordLookups.length === 0
                ? 'A word written down is a word kept. Add the first one above and build your own dictionary as you read.'
                : `Nothing in your lexicon matches “${searchWord.trim()}”.`}
            </Text>
          </View>
        ) : groups ? (
          groups.map((group) => (
            <View key={group.letter}>
              <View style={styles.letterHeader}>
                <Text style={styles.letter}>{group.letter}</Text>
                <View style={styles.letterRule} />
              </View>
              {group.words.map(renderWord)}
            </View>
          ))
        ) : (
          filteredWords.map(renderWord)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  /* Header */
  header: {
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    backgroundColor: colors.surface,
  },
  eyebrow: { ...type.overline, color: colors.bronze, marginBottom: space.xs },
  title: { ...type.display, color: colors.goldBright, marginBottom: space.sm },
  subtitle: { ...type.body, color: colors.inkMuted },

  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.xxxl,
  },

  /* Add panel */
  addPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.xl,
    ...elevation.card,
  },
  panelHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  panelGlyph: { fontSize: 16, color: colors.gold, marginTop: 2 },
  panelHeadText: { flex: 1 },
  panelTitle: { ...type.heading, color: colors.goldBright },
  panelSubtitle: { ...type.body, color: colors.inkMuted, marginTop: space.xs },
  panelRule: {
    height: 1,
    backgroundColor: colors.rule,
    marginTop: space.lg,
    marginBottom: space.xl,
  },

  /* Fields */
  field: { marginBottom: space.lg },
  fieldLabel: { ...type.overline, color: colors.bronze, marginBottom: space.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontFamily: fonts.reading,
    fontSize: 15,
    color: colors.ink,
  },
  inputMultiline: { minHeight: 96, paddingTop: space.md, textAlignVertical: 'top' },
  inputFocused: { borderColor: colors.gold, backgroundColor: colors.surfaceRaised },
  fieldHint: { ...type.caption, color: colors.bronze, marginTop: space.xs },

  primaryButton: {
    marginTop: space.sm,
    paddingVertical: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButtonText: {
    ...type.caption,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    color: colors.bg,
  },
  primaryButtonTextDisabled: { color: colors.bronze, fontWeight: '400' },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xxl,
    marginBottom: space.lg,
  },
  sectionTitle: { ...type.heading, color: colors.gold },
  sectionRule: { flex: 1, height: 1, backgroundColor: colors.rule },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  segment: { paddingVertical: space.xs + 2, paddingHorizontal: space.md },
  segmentActive: { backgroundColor: colors.surfaceRaised },
  segmentText: { ...type.caption, fontSize: 11, color: colors.bronze },
  segmentTextActive: { color: colors.goldBright },

  /* Search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    marginBottom: space.xl,
  },
  searchGlyph: { fontSize: 16, color: colors.bronze },
  searchInput: {
    flex: 1,
    paddingVertical: space.sm,
    fontFamily: fonts.ui,
    fontSize: 14,
    color: colors.ink,
  },
  searchClear: { fontSize: 13, color: colors.bronze, paddingHorizontal: space.xs },

  /* Letter rules */
  letterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.md,
    marginTop: space.sm,
  },
  letter: { ...type.display, fontSize: 22, color: colors.bronze },
  letterRule: { flex: 1, height: 1, backgroundColor: colors.rule },

  /* Word card */
  wordCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    paddingLeft: space.lg + space.xs,
    marginBottom: space.lg,
    overflow: 'hidden',
    ...elevation.card,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.gold,
    opacity: 0.55,
  },
  wordHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  wordHeadText: { flex: 1 },
  word: { ...type.heading, fontSize: 21, color: colors.goldBright },
  pronunciation: {
    ...type.caption,
    color: colors.bronze,
    fontStyle: 'italic',
    marginTop: 2,
  },
  posTag: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  posTagText: { ...type.caption, fontSize: 11, color: colors.gold, fontStyle: 'italic' },

  definition: {
    fontFamily: fonts.reading,
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
    marginTop: space.md,
  },
  example: {
    fontFamily: fonts.reading,
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
    color: colors.inkMuted,
    marginTop: space.md,
    paddingLeft: space.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.rule,
  },

  synonymRow: { marginTop: space.lg },
  synonymLabel: { ...type.overline, color: colors.bronze, marginBottom: space.sm },
  synonymChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  chipText: { ...type.caption, color: colors.inkMuted },

  wordFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
  date: { ...type.caption, color: colors.bronze },
  removeText: { ...type.caption, color: colors.danger },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingVertical: space.xxxl,
    paddingHorizontal: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.surface,
  },
  emptyGlyph: { fontSize: 34, color: colors.bronze, marginBottom: space.lg },
  emptyTitle: { ...type.heading, color: colors.gold, marginBottom: space.sm },
  emptyBody: {
    ...type.body,
    color: colors.inkMuted,
    textAlign: 'center',
    maxWidth: 340,
  },
});
