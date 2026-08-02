import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { useApp } from '../context/AppContext';

const categories = [
  'literature',
  'philosophy',
  'theology',
  'history',
  'mathematics',
  'science',
  'biography',
  'music',
  'art',
  'language',
];

const tiers = [
  { id: 1, label: 'Tier 1 (Core Texts)' },
  { id: 2, label: 'Tier 2 (Context)' },
];

const stages = [
  { id: 'grammar', label: 'Grammar Stage' },
  { id: 'logic', label: 'Logic Stage' },
  { id: 'rhetoric', label: 'Rhetoric Stage' },
];

export default function CurriculumScreen({ navigation }: any) {
  const { getClassicalLibrary, getClassicalLibraryByCategory, getClassicalLibraryByTier, getClassicalLibraryByStage, settings } = useApp();
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  let items = getClassicalLibrary();

  if (selectedCategory) {
    items = items.filter(item => item.category === selectedCategory);
  }
  if (selectedTier) {
    items = items.filter(item => item.tier === selectedTier);
  }
  if (selectedStage) {
    items = items.filter(item => item.stage === selectedStage || !item.stage);
  }
  if (searchText) {
    items = items.filter(item =>
      item.title.toLowerCase().includes(searchText.toLowerCase()) ||
      item.author.toLowerCase().includes(searchText.toLowerCase())
    );
  }

  const handleViewItem = (item: any) => {
    navigation.navigate('ClassicalLibraryReader', { itemId: item.id });
  };

  const getTypeLabel = (type: string) => {
    if (type === 'music') return '♪ Music';
    if (type === 'art') return '✎ Art';
    if (type === 'resource') return '◆ Resource';
    return '✦ Text';
  };

  const CurriculumItem = ({ id, title, author, category, tier, stage, description, type, grade, sources }: any) => (
    <View style={[styles.itemCard, { backgroundColor: '#1a1328', borderColor: type === 'music' ? '#a8a478' : type === 'art' ? '#8b7355' : '#8b7355' }]}>
      <View style={styles.itemHeader}>
        <View style={styles.itemTitleSection}>
          <View style={styles.itemTitleRow}>
            <Text style={[styles.itemTitle, { color: '#c9a961' }]}>{title}</Text>
            <Text style={[styles.typeLabel, { color: '#8b7355' }]}>{getTypeLabel(type)}</Text>
          </View>
          <Text style={[styles.itemAuthor, { color: '#8b7355' }]}>{author}</Text>
        </View>
        <TouchableOpacity
          style={[styles.viewButton, { backgroundColor: '#2d1b4e', borderColor: '#c9a961' }]}
          onPress={() => handleViewItem({ id, title, author, category, tier, stage, description, type, grade })}
        >
          <Text style={[styles.viewButtonText, { color: '#c9a961' }]}>→</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.itemDescription, { color: '#8b7355' }]}>{description}</Text>
      {type === 'music' && (
        <Text style={[styles.typeNote, { color: '#a8a478' }]}>
          Listen to this composition as part of your studies
        </Text>
      )}
      {type === 'art' && (
        <Text style={[styles.typeNote, { color: '#8b7355' }]}>
          Study this artwork in depth
        </Text>
      )}
      {sources && sources.length > 0 && (
        <View style={styles.sourcesSection}>
          <Text style={[styles.sourcesLabel, { color: '#c9a961' }]}>Free Online Access:</Text>
          <View style={styles.sourcesList}>
            {sources.slice(0, 2).map((source: any, idx: number) => (
              <TouchableOpacity
                key={idx}
                style={[styles.sourceButton, { borderColor: '#8b7355' }]}
                onPress={() => {
                  Linking.openURL(source.url).catch(err =>
                    Alert.alert('Error', 'Could not open link')
                  );
                }}
              >
                <Text style={[styles.sourceButtonText, { color: '#c9a961' }]}>
                  {source.provider === 'gutenberg' ? '📖 Gutenberg' : source.provider === 'archive' ? '📚 Archive' : source.provider === 'youtube' ? '▶ YouTube' : '🎨 View'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      <View style={styles.itemFooter}>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: '#2d1b4e' }]}>
            <Text style={[styles.badgeText, { color: '#c9a961' }]}>{category}</Text>
          </View>
          {grade !== undefined && (
            <View style={[styles.badge, { backgroundColor: '#2d1b4e' }]}>
              <Text style={[styles.badgeText, { color: '#c9a961' }]}>Grade {grade}</Text>
            </View>
          )}
          {tier && (
            <View style={[styles.badge, { backgroundColor: '#2d1b4e' }]}>
              <Text style={[styles.badgeText, { color: '#c9a961' }]}>T{tier}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: '#0f0a1a' }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: '#c9a961' }]}>
        <Text style={[styles.headerTitle, { color: '#c9a961' }]}>✦ Curriculum</Text>
        <Text style={[styles.count, { color: '#8b7355' }]}>{items.length}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: '#2d1b4e',
              color: '#c9a961',
              borderColor: '#8b7355',
            },
          ]}
          placeholder="Search texts..."
          placeholderTextColor="#8b7355"
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {/* Category Filter */}
        <View style={styles.filterGroup}>
          <Text style={[styles.filterLabel, { color: '#c9a961' }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                { borderColor: '#8b7355' },
                selectedCategory === null && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' },
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.filterButtonText, { color: '#c9a961' }]}>All</Text>
            </TouchableOpacity>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.filterButton,
                  { borderColor: '#8b7355' },
                  selectedCategory === cat && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' },
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.filterButtonText, { color: '#c9a961' }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Tier and Stage Filters */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={[styles.filterContent, { paddingHorizontal: 12 }]}
        >
          <TouchableOpacity
            style={[
              styles.filterButton,
              { borderColor: '#8b7355' },
              selectedTier === null && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' },
            ]}
            onPress={() => setSelectedTier(null)}
          >
            <Text style={[styles.filterButtonText, { color: '#c9a961' }]}>All Tiers</Text>
          </TouchableOpacity>
          {tiers.map(tier => (
            <TouchableOpacity
              key={tier.id}
              style={[
                styles.filterButton,
                { borderColor: '#8b7355' },
                selectedTier === tier.id && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' },
              ]}
              onPress={() => setSelectedTier(tier.id)}
            >
              <Text style={[styles.filterButtonText, { color: '#c9a961' }]}>{tier.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={[styles.filterContent, { paddingHorizontal: 12 }]}
        >
          <TouchableOpacity
            style={[
              styles.filterButton,
              { borderColor: '#8b7355' },
              selectedStage === null && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' },
            ]}
            onPress={() => setSelectedStage(null)}
          >
            <Text style={[styles.filterButtonText, { color: '#c9a961' }]}>All Stages</Text>
          </TouchableOpacity>
          {stages.map(stage => (
            <TouchableOpacity
              key={stage.id}
              style={[
                styles.filterButton,
                { borderColor: '#8b7355' },
                selectedStage === stage.id && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' },
              ]}
              onPress={() => setSelectedStage(stage.id)}
            >
              <Text style={[styles.filterButtonText, { color: '#c9a961' }]}>{stage.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Items List */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyIcon, { color: '#c9a961' }]}>✦</Text>
          <Text style={[styles.emptyText, { color: '#c9a961' }]}>No texts found</Text>
        </View>
      ) : (
        <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
          {items.map(item => (
            <CurriculumItem
              key={item.id}
              id={item.id}
              title={item.title}
              author={item.author}
              category={item.category}
              tier={item.tier}
              stage={item.stage}
              description={item.description}
              type={item.type}
              grade={item.grade}
              sources={item.sources}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: '400', letterSpacing: 2, fontFamily: 'Georgia' },
  count: { fontSize: 13, fontWeight: '400', letterSpacing: 1 },
  searchSection: { paddingHorizontal: 16, paddingVertical: 12 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Georgia',
  },
  filterScroll: { maxHeight: 120 },
  filterContent: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  filterGroup: { marginBottom: 0 },
  filterLabel: { fontSize: 12, fontWeight: '400', letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
  categoryScroll: { maxHeight: 50 },
  filterRow: { maxHeight: 50, paddingVertical: 8 },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 2,
    backgroundColor: '#1a1328',
    borderWidth: 1,
    marginHorizontal: 4,
  },
  filterButtonText: { fontSize: 11, fontWeight: '400', letterSpacing: 1 },
  listContainer: { flex: 1 },
  listContent: { padding: 12 },
  itemCard: {
    padding: 12,
    borderRadius: 2,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#c9a961',
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemTitleSection: { flex: 1, marginRight: 12 },
  itemTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  itemTitle: { fontSize: 14, fontWeight: '400', fontFamily: 'Georgia', letterSpacing: 0.5, flex: 1 },
  typeLabel: { fontSize: 10, letterSpacing: 0.5, marginLeft: 8 },
  itemAuthor: { fontSize: 11, letterSpacing: 0.5 },
  itemDescription: { fontSize: 11, lineHeight: 16, marginBottom: 8 },
  typeNote: { fontSize: 10, fontStyle: 'italic', marginBottom: 8, letterSpacing: 0.5 },
  sourcesSection: { marginVertical: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#8b7355' },
  sourcesLabel: { fontSize: 10, fontWeight: '400', letterSpacing: 1, marginBottom: 6, fontFamily: 'Georgia' },
  sourcesList: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sourceButton: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 2, borderWidth: 1, backgroundColor: '#2d1b4e' },
  sourceButtonText: { fontSize: 9, fontWeight: '400', letterSpacing: 0.5 },
  itemFooter: { marginTop: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 2 },
  badgeText: { fontSize: 10, fontWeight: '400', letterSpacing: 0.5 },
  viewButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 2, borderWidth: 1 },
  viewButtonText: { fontSize: 18, fontWeight: '300' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyText: { fontSize: 15, fontWeight: '400', fontFamily: 'Georgia', letterSpacing: 1 },
});
