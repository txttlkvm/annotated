import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  TextInputProps,
  Modal,
} from 'react-native';
import { useApp } from '../context/AppContext';
import BookCover from '../components/BookCover';
import { colors, fonts, space, radius, type, elevation, HIT_SLOP_MIN } from '../theme';
import Shell from '../components/Shell';
import { Banner } from '../components/Banner';
import type { Book, Collection } from '../types';

import { Alert } from '../components/Alert';
/** Width of the small covers in a collection's preview stack. */
const STACK_COVER = 38;
const STACK_MAX = 4;

const CATEGORY_LABEL: Record<string, string> = {
  grammar: 'Grammar',
  logic: 'Logic',
  rhetoric: 'Rhetoric',
  custom: 'Collection',
};

/**
 * A labelled form field. The old screens dropped bare TextInputs onto the page
 * with a 1px border and no label, which is most of why the forms read as raw.
 * A label in the overline style, generous padding and a gold focus ring is the
 * whole difference.
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

export default function CollectionsScreen() {
  const {
    collections,
    books,
    createCollection,
    deleteCollection,
    addBookToCollection,
    removeBookFromCollection,
  } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [collectionDesc, setCollectionDesc] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

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

  const closeModal = () => {
    setCollectionName('');
    setCollectionDesc('');
    setShowModal(false);
  };

  const selectedCollection = collections.find((c) => c.id === selectedCollectionId);
  const collectionBooks = selectedCollection
    ? books.filter((b) => selectedCollection.bookIds.includes(b.id))
    : [];
  const availableBooks = selectedCollection
    ? books.filter((b) => !selectedCollection.bookIds.includes(b.id))
    : [];

  const totalShelved = collections.reduce((n, c) => n + c.bookIds.length, 0);

  const renderCard = (collection: Collection) => {
    const shelf = books.filter((b) => collection.bookIds.includes(b.id));
    const preview = shelf.slice(0, STACK_MAX);
    const overflow = shelf.length - preview.length;

    return (
      <TouchableOpacity
        key={collection.id}
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => setSelectedCollectionId(collection.id)}
      >
        <View style={styles.cardAccent} />

        <View style={styles.cardHead}>
          <View style={styles.cardHeadText}>
            <Text style={styles.cardEyebrow}>
              {CATEGORY_LABEL[collection.category || 'custom'] || 'Collection'}
            </Text>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {collection.name}
            </Text>
            {!!collection.description && (
              <Text style={styles.cardDesc} numberOfLines={2}>
                {collection.description}
              </Text>
            )}
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countNumber}>{collection.bookIds.length}</Text>
            <Text style={styles.countLabel}>
              {collection.bookIds.length === 1 ? 'VOL' : 'VOLS'}
            </Text>
          </View>
        </View>

        {preview.length > 0 ? (
          <View style={styles.stack}>
            {preview.map((book) => (
              <View key={book.id} style={styles.stackItem}>
                <BookCover
                  uri={book.cover}
                  title={book.title}
                  author={book.author}
                  itemType={book.itemType}
                  width={STACK_COVER}
                />
              </View>
            ))}
            {overflow > 0 && (
              <View style={styles.stackMore}>
                <Text style={styles.stackMoreText}>+{overflow}</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.stackEmpty}>
            <Text style={styles.stackEmptyText}>An empty shelf, waiting</Text>
          </View>
        )}

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.ghostButton}
            onPress={() => setSelectedCollectionId(collection.id)}
          >
            <Text style={styles.ghostButtonText}>Manage shelf</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quietButton}
            onPress={() => handleDeleteCollection(collection.id)}
          >
            <Text style={styles.quietButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderShelfRow = (book: Book, action: React.ReactNode) => (
    <View key={book.id} style={styles.bookRow}>
      <BookCover
        uri={book.cover}
        title={book.title}
        author={book.author}
        itemType={book.itemType}
        width={44}
      />
      <View style={styles.bookRowText}>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {book.title}
        </Text>
        {!!book.author && (
          <Text style={styles.bookAuthor} numberOfLines={1}>
            {book.author}
          </Text>
        )}
      </View>
      {action}
    </View>
  );

  return (
    <Shell gutter={false} contentContainerStyle={styles.container}>

      {/* Header */}
      <Banner title="Collections" eyebrow="The Library" />
      <Text style={styles.subtitle}>
        {collections.length === 0
          ? 'Gather your books into shelves of your own making'
          : `${collections.length} shelf${collections.length === 1 ? '' : 'ves'} · ${totalShelved} volume${totalShelved === 1 ? '' : 's'} gathered`}
      </Text>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.createButton}
          activeOpacity={0.85}
          onPress={() => setShowModal(true)}
        >
          <Text style={styles.createGlyph}>✦</Text>
          <Text style={styles.createButtonText}>New Collection</Text>
        </TouchableOpacity>

        {collections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyGlyph}>❧</Text>
            <Text style={styles.emptyTitle}>No collections yet</Text>
            <Text style={styles.emptyBody}>
              A collection is a shelf you build yourself — by theme, by term, by
              the order in which a student ought to read. Start with one and add
              volumes as you go.
            </Text>
            <TouchableOpacity style={styles.emptyCta} onPress={() => setShowModal(true)}>
              <Text style={styles.emptyCtaText}>Create your first shelf</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your shelves</Text>
              <View style={styles.sectionRule} />
            </View>
            {collections.map(renderCard)}
          </>
        )}
      </ScrollView>

      {/* Create Collection Modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalEyebrow}>NEW SHELF</Text>
            <Text style={styles.modalTitle}>Name your collection</Text>
            <View style={styles.modalRule} />

            <Field
              label="Title"
              placeholder="e.g. Michaelmas Term — Rhetoric"
              value={collectionName}
              onChangeText={setCollectionName}
            />

            <Field
              label="Description"
              hint="Optional — a line about what belongs here."
              placeholder="Primary sources for the Michaelmas reading list"
              value={collectionDesc}
              onChangeText={setCollectionDesc}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.ghostButton} onPress={closeModal}>
                <Text style={styles.ghostButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handleCreateCollection}>
                <Text style={styles.primaryButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Selected Collection Details */}
      {selectedCollection && (
        <Modal
          visible={!!selectedCollectionId}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedCollectionId(null)}
        >
          <View style={styles.detailsContainer}>
            <View style={styles.detailsHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  setSelectedCollectionId(null);
                  setShowPicker(false);
                }}
              >
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
              <View style={styles.detailsHeadText}>
                <Text style={styles.detailsEyebrow}>COLLECTION</Text>
                <Text style={styles.detailsTitle} numberOfLines={1}>
                  {selectedCollection.name}
                </Text>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={styles.detailsContent}
              showsVerticalScrollIndicator={false}
            >
              {!!selectedCollection.description && (
                <Text style={styles.detailsDesc}>{selectedCollection.description}</Text>
              )}

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  On this shelf ({collectionBooks.length})
                </Text>
                <View style={styles.sectionRule} />
              </View>

              {collectionBooks.length === 0 ? (
                <View style={styles.emptyStateSmall}>
                  <Text style={styles.emptyGlyphSmall}>❧</Text>
                  <Text style={styles.emptyBodySmall}>
                    Nothing here yet. Add a volume from your library below.
                  </Text>
                </View>
              ) : (
                collectionBooks.map((book) =>
                  renderShelfRow(
                    book,
                    <TouchableOpacity
                      style={styles.rowAction}
                      onPress={() =>
                        removeBookFromCollection(selectedCollection.id, book.id)
                      }
                    >
                      <Text style={styles.rowActionDanger}>Remove</Text>
                    </TouchableOpacity>
                  )
                )
              )}

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Add from library</Text>
                <View style={styles.sectionRule} />
                <TouchableOpacity onPress={() => setShowPicker((v) => !v)}>
                  <Text style={styles.sectionToggle}>{showPicker ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>

              {showPicker &&
                (availableBooks.length === 0 ? (
                  <View style={styles.emptyStateSmall}>
                    <Text style={styles.emptyBodySmall}>
                      Every volume in your library is already on this shelf.
                    </Text>
                  </View>
                ) : (
                  availableBooks.map((book) =>
                    renderShelfRow(
                      book,
                      <TouchableOpacity
                        style={styles.rowAction}
                        onPress={() => addBookToCollection(selectedCollection.id, book.id)}
                      >
                        <Text style={styles.rowActionText}>Add</Text>
                      </TouchableOpacity>
                    )
                  )
                ))}
            </ScrollView>
          </View>
        </Modal>
      )}
    </Shell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  subtitle: { ...type.body, color: colors.inkMuted, paddingHorizontal: space.xl, paddingBottom: space.lg },

  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.xxxl,
  },

  /* Primary action */
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    marginBottom: space.xxl,
    ...elevation.card,
  },
  createGlyph: { fontSize: 14, color: colors.gold },
  createButtonText: {
    ...type.title,
    color: colors.goldBright,
  },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xl,
    marginBottom: space.lg,
  },
  sectionTitle: { ...type.heading, color: colors.gold },
  sectionRule: { flex: 1, height: 1, backgroundColor: colors.rule },
  sectionToggle: { ...type.caption, color: colors.bronze },

  /* Collection card */
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
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
    opacity: 0.65,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.lg },
  cardHeadText: { flex: 1 },
  cardEyebrow: { ...type.overline, color: colors.bronze, marginBottom: space.xs },
  cardTitle: { ...type.heading, color: colors.goldBright },
  cardDesc: { ...type.body, color: colors.inkMuted, marginTop: space.sm },

  countBadge: {
    minWidth: 52,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
  },
  countNumber: { ...type.title, fontSize: 18, color: colors.goldBright },
  countLabel: { ...type.overline, color: colors.bronze, marginTop: 2 },

  /* Cover stack */
  stack: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.lg },
  stackItem: {},
  stackMore: {
    width: STACK_COVER,
    height: Math.round(STACK_COVER * 1.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackMoreText: { ...type.caption, color: colors.bronze },
  stackEmpty: {
    marginTop: space.lg,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
  stackEmptyText: { ...type.caption, color: colors.bronze, fontStyle: 'italic' },

  cardActions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },

  /* Buttons */
  ghostButton: {
    flex: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  ghostButtonText: { ...type.caption, color: colors.gold, letterSpacing: 0.6 },
  quietButton: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  quietButtonText: { ...type.caption, color: colors.danger, letterSpacing: 0.6 },
  primaryButton: {
    flex: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...type.caption,
    color: colors.bg,
    fontWeight: '600',
    letterSpacing: 0.8,
  },

  /* Empty states */
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
    maxWidth: 320,
    marginBottom: space.xl,
  },
  emptyCta: {
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  emptyCtaText: { ...type.caption, color: colors.goldBright, letterSpacing: 0.8 },
  emptyStateSmall: {
    alignItems: 'center',
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.surface,
    marginBottom: space.md,
  },
  emptyGlyphSmall: { fontSize: 22, color: colors.bronze, marginBottom: space.sm },
  emptyBodySmall: { ...type.body, color: colors.inkMuted, textAlign: 'center' },

  /* Form fields */
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
  inputMultiline: { minHeight: 84, paddingTop: space.md, textAlignVertical: 'top' },
  inputFocused: { borderColor: colors.gold, backgroundColor: colors.surfaceRaised },
  fieldHint: { ...type.caption, color: colors.bronze, marginTop: space.xs },

  /* Modal */
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.xl,
    backgroundColor: 'rgba(6, 3, 12, 0.78)',
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...elevation.cover,
  },
  modalEyebrow: { ...type.overline, color: colors.bronze, marginBottom: space.xs },
  modalTitle: { ...type.heading, color: colors.goldBright },
  modalRule: {
    height: 1,
    backgroundColor: colors.rule,
    marginTop: space.lg,
    marginBottom: space.xl,
  },
  modalActions: { flexDirection: 'row', gap: space.md, marginTop: space.sm },

  /* Details view */
  detailsContainer: { flex: 1, backgroundColor: colors.bg },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: HIT_SLOP_MIN,
    height: HIT_SLOP_MIN,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { fontSize: 17, color: colors.gold, lineHeight: 20 },
  detailsHeadText: { flex: 1 },
  detailsEyebrow: { ...type.overline, color: colors.bronze, marginBottom: 2 },
  detailsTitle: { ...type.heading, color: colors.goldBright },
  detailsContent: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xxxl,
  },
  detailsDesc: { ...type.body, color: colors.inkMuted, marginTop: space.md },

  /* Book rows */
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.md,
    marginBottom: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.surface,
  },
  bookRowText: { flex: 1 },
  bookTitle: { ...type.title, color: colors.ink },
  bookAuthor: { ...type.caption, color: colors.inkMuted, marginTop: space.xs },
  rowAction: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowActionText: { ...type.caption, color: colors.gold },
  rowActionDanger: { ...type.caption, color: colors.danger },
});
