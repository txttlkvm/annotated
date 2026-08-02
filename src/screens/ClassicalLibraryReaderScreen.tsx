import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Linking,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { ContentDownloadService, DownloadProgress } from '../services/ContentDownloadService';

export default function ClassicalLibraryReaderScreen({ route, navigation }: any) {
  const { itemId } = route.params;
  const { getClassicalLibrary } = useApp();
  const [item, setItem] = useState<any>(null);
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeScreen();
  }, []);

  useEffect(() => {
    const unsubscribe = ContentDownloadService.onDownloadProgress((progress) => {
      if (progress.itemId === itemId) {
        setDownloadProgress(progress);
      }
    });

    return unsubscribe;
  }, [itemId]);

  const initializeScreen = async () => {
    try {
      await ContentDownloadService.initDirectories();

      const library = getClassicalLibrary();
      const foundItem = library.find(i => i.id === itemId);
      setItem(foundItem);

      if (foundItem) {
        const path = await ContentDownloadService.getLocalPath(itemId, foundItem.type as any);
        setLocalPath(path);
      }
    } catch (error) {
      console.error('Init error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (sourceUrl: string, source: any) => {
    if (!item) return;

    // If it's a web source (HTML), open in browser
    if (source.type === 'html') {
      try {
        await Linking.openURL(sourceUrl);
        Alert.alert('Search Anna\'s Archive',
          `Browse available formats for "${item.title}".\n\nYou can download EPUB, PDF, MOBI, or other formats and add them to the app.`
        );
      } catch (error) {
        Alert.alert('Error', 'Could not open link');
      }
      return;
    }

    // Otherwise, download file
    try {
      setIsLoading(true);
      let path: string;

      if (item.type === 'book') {
        path = await ContentDownloadService.downloadBook(item, sourceUrl, source.type as 'epub' | 'pdf' | 'txt');
      } else if (item.type === 'music') {
        path = await ContentDownloadService.downloadMusic(item, sourceUrl);
      } else if (item.type === 'art') {
        path = await ContentDownloadService.downloadArt(item, sourceUrl);
      } else {
        throw new Error('Unknown item type');
      }

      setLocalPath(path);
      Alert.alert('Success', `${item.title} downloaded successfully`);
    } catch (error) {
      Alert.alert('Error', `Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Content', `Remove downloaded copy of "${item?.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await ContentDownloadService.deleteContent(itemId);
          setLocalPath(null);
          Alert.alert('Deleted', 'Content removed');
        },
      },
    ]);
  };

  const handleOpen = () => {
    if (!localPath) return;

    if (item.type === 'book') {
      // Navigate to book reader with local file
      navigation.navigate('Reading', {
        screen: 'ReaderHome',
        params: { localPath, title: item.title },
      });
    } else if (item.type === 'music') {
      // Navigate to music player
      navigation.navigate('MusicPlayer', {
        filePath: localPath,
        title: item.title,
        artist: item.author,
      });
    } else if (item.type === 'art') {
      // Navigate to art viewer
      navigation.navigate('ArtViewer', {
        imagePath: localPath,
        title: item.title,
        artist: item.author,
      });
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: '#0f0a1a' }]}>
        <ActivityIndicator size="large" color="#c9a961" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.container, { backgroundColor: '#0f0a1a' }]}>
        <Text style={[styles.errorText, { color: '#c9a961' }]}>Item not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: '#0f0a1a' }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: '#c9a961' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: '#c9a961' }]}>← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Cover/Icon */}
      <View style={styles.coverSection}>
        <View style={[styles.coverIcon, { backgroundColor: '#2d1b4e', borderColor: '#c9a961' }]}>
          <Text style={[styles.coverSymbol, { color: '#c9a961' }]}>
            {item.type === 'music' ? '♪' : item.type === 'art' ? '✎' : '✦'}
          </Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.infoSection}>
        <Text style={[styles.title, { color: '#c9a961' }]}>{item.title}</Text>
        <Text style={[styles.author, { color: '#8b7355' }]}>{item.author}</Text>
        <Text style={[styles.typeLabel, { color: '#8b7355' }]}>
          {item.type === 'music' ? 'Music Composition' : item.type === 'art' ? 'Artwork' : 'Classical Text'}
        </Text>
      </View>

      {/* Description */}
      <View style={styles.descriptionSection}>
        <Text style={[styles.description, { color: '#c9a961' }]}>{item.description}</Text>
      </View>

      {/* Status */}
      {localPath ? (
        <View style={[styles.statusBox, { backgroundColor: '#2d1b4e', borderColor: '#c9a961' }]}>
          <Text style={[styles.statusLabel, { color: '#c9a961' }]}>✓ Downloaded</Text>
          <Text style={[styles.statusText, { color: '#8b7355' }]}>Ready to read • Tap below to open</Text>
        </View>
      ) : downloadProgress && downloadProgress.status === 'downloading' ? (
        <View style={[styles.statusBox, { backgroundColor: '#2d1b4e', borderColor: '#a8a478' }]}>
          <Text style={[styles.statusLabel, { color: '#a8a478' }]}>⬇ Downloading...</Text>
          <View style={[styles.progressBar, { borderColor: '#8b7355', backgroundColor: '#1a1328' }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${downloadProgress.progress}%`, backgroundColor: '#c9a961' },
              ]}
            />
          </View>
          <Text style={[styles.statusText, { color: '#8b7355' }]}>
            {Math.round(downloadProgress.progress)}% complete
          </Text>
        </View>
      ) : downloadProgress?.status === 'failed' ? (
        <View style={[styles.statusBox, { backgroundColor: '#2d1b4e', borderColor: '#a8a478' }]}>
          <Text style={[styles.statusLabel, { color: '#a8a478' }]}>✗ Download Failed</Text>
          <Text style={[styles.statusText, { color: '#8b7355' }]}>
            {downloadProgress.error || 'Unknown error'}
          </Text>
        </View>
      ) : (
        <View style={[styles.statusBox, { backgroundColor: '#2d1b4e', borderColor: '#8b7355' }]}>
          <Text style={[styles.statusLabel, { color: '#8b7355' }]}>Not Downloaded</Text>
          <Text style={[styles.statusText, { color: '#8b7355' }]}>
            Tap below to download and read/listen/view
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      {localPath ? (
        <>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#2d1b4e', borderColor: '#c9a961' }]}
            onPress={handleOpen}
            disabled={isLoading}
          >
            <Text style={[styles.buttonText, { color: '#c9a961' }]}>
              {item.type === 'music' ? '▶ Listen Now' : item.type === 'art' ? '👁 View Art' : '📖 Read Now'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: '#1a1328', borderColor: '#8b7355' }]}
            onPress={handleDelete}
            disabled={isLoading}
          >
            <Text style={[styles.secondaryButtonText, { color: '#8b7355' }]}>Remove Downloaded Copy</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {item.sources && item.sources.length > 0 ? (
            <>
              <Text style={[styles.sourcesTitle, { color: '#c9a961' }]}>Available Sources:</Text>
              {item.sources.slice(0, 4).map((source: any, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.sourceButton,
                    {
                      backgroundColor: ['annas-archive', 'archive.org', 'wikimedia'].includes(source.provider) ? '#1a1328' : '#2d1b4e',
                      borderColor: ['annas-archive', 'archive.org', 'wikimedia'].includes(source.provider) ? '#a8a478' : '#8b7355',
                    },
                  ]}
                  onPress={() => handleDownload(source.url, source)}
                  disabled={isLoading || downloadProgress?.status === 'downloading'}
                >
                  <Text
                    style={[
                      styles.sourceButtonText,
                      {
                        color:
                          ['annas-archive', 'open-library', 'standard-ebooks', 'archive.org', 'wikimedia'].includes(
                            source.provider
                          )
                            ? '#a8a478'
                            : '#c9a961',
                      },
                    ]}
                  >
                    {source.type === 'html' ? '🔍 ' : '⬇ '}
                    {source.provider === 'standard-ebooks'
                      ? 'Download from Standard Ebooks (Best Quality EPUB)'
                      : source.provider === 'gutenberg'
                      ? `Download from Project Gutenberg (${source.type.toUpperCase()})`
                      : source.provider === 'archive'
                      ? `Download from Internet Archive (${source.type.toUpperCase()})`
                      : source.provider === 'archive.org'
                      ? 'Browse Archive.org Classical Music'
                      : source.provider === 'open-library'
                      ? 'Search Open Library (Millions of Books)'
                      : source.provider === 'youtube'
                      ? 'Listen on YouTube'
                      : source.provider === 'wikimedia'
                      ? 'View on Wikimedia Commons'
                      : 'Search Anna\'s Archive'}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <View style={[styles.noSourcesBox, { backgroundColor: '#1a1328', borderColor: '#8b7355' }]}>
              <Text style={[styles.noSourcesText, { color: '#8b7355' }]}>
                Search Anna's Archive to find this item
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  backButton: { fontSize: 15, fontWeight: '400', letterSpacing: 1 },
  coverSection: { alignItems: 'center', paddingVertical: 24 },
  coverIcon: { width: 140, height: 140, borderRadius: 2, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  coverSymbol: { fontSize: 70, fontWeight: '300' },
  infoSection: { paddingHorizontal: 16, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '400', marginBottom: 4, fontFamily: 'Georgia', letterSpacing: 1 },
  author: { fontSize: 14, marginBottom: 6, letterSpacing: 0.5 },
  typeLabel: { fontSize: 12, fontStyle: 'italic', letterSpacing: 0.5 },
  descriptionSection: { paddingHorizontal: 16, marginBottom: 20 },
  description: { fontSize: 12, lineHeight: 18, fontFamily: 'Georgia' },
  statusBox: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 2,
    borderLeftWidth: 2,
    borderWidth: 1,
  },
  statusLabel: { fontSize: 13, fontWeight: '400', marginBottom: 4, letterSpacing: 1, fontFamily: 'Georgia' },
  statusText: { fontSize: 11, letterSpacing: 0.5 },
  progressBar: { height: 4, borderRadius: 2, marginVertical: 8, borderWidth: 1, overflow: 'hidden' },
  progressFill: { height: '100%' },
  primaryButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
  },
  buttonText: { fontWeight: '400', fontSize: 13, letterSpacing: 1 },
  secondaryButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 10,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryButtonText: { fontWeight: '400', fontSize: 12, letterSpacing: 0.5 },
  sourcesTitle: { fontSize: 12, fontWeight: '400', letterSpacing: 1, paddingHorizontal: 16, marginBottom: 12, fontFamily: 'Georgia' },
  sourceButton: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
  },
  sourceButtonText: { fontWeight: '400', fontSize: 11, letterSpacing: 0.5 },
  noSourcesBox: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 2,
    borderLeftWidth: 2,
    borderWidth: 1,
  },
  noSourcesText: { fontSize: 11, letterSpacing: 0.5 },
  errorText: { fontSize: 15, textAlign: 'center', marginTop: 50, letterSpacing: 1 },
});
