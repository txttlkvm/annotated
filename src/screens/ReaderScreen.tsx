import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import * as ScreenBrightness from 'expo-screen-brightness';
import { useApp } from '../context/AppContext';
import { TTSService } from '../services/TTSService';
import { AudioService, PlaybackState } from '../services/AudioService';
import { READER_THEMES } from '../types';

const { width, height } = Dimensions.get('window');

export default function ReaderScreen() {
  const { currentBook, bookmarks, settings, updateSettings, addBookmark, addHighlight, addReadingSession } = useApp();
  const [currentPage, setCurrentPage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    position: 0,
    duration: 0,
    rate: 1,
  });
  const [showMenus, setShowMenus] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showHighlightColor, setShowHighlightColor] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [highlightColor, setHighlightColor] = useState('yellow');
  const [sessionStartTime] = useState(Date.now());

  const theme = READER_THEMES[settings.theme];

  useEffect(() => {
    AudioService.onPlaybackStatus(setPlaybackState);
    return () => {
      AudioService.cleanup();
    };
  }, []);

  useEffect(() => {
    updateBrightness();
  }, [settings.brightness]);

  const updateBrightness = async () => {
    try {
      if (!settings.autoBrightnessEnabled) {
        await ScreenBrightness.setBrightnessAsync(settings.brightness);
      }
    } catch (error) {
      console.error('Brightness error:', error);
    }
  };

  if (!currentBook) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📖</Text>
          <Text style={[styles.emptyText, { color: theme.textColor }]}>No book selected</Text>
          <Text style={[styles.emptySubtext, { color: theme.accentColor }]}>
            Choose a book from your library to start reading
          </Text>
        </View>
      </View>
    );
  }

  const textContent = currentBook.content || '';
  const wordsPerPage = Math.floor((width / (settings.fontSize / 16)) * (height / (settings.fontSize * settings.lineHeight)));
  const totalWords = textContent.split(/\s+/).length;
  const totalPages = Math.ceil(totalWords / (wordsPerPage / 250));

  const getPageContent = () => {
    const startIdx = currentPage * 500;
    const endIdx = Math.min((currentPage + 1) * 500, textContent.length);
    return textContent.substring(startIdx, endIdx);
  };

  const handleReadAloud = async () => {
    if (!TTSService.hasApiKey()) {
      Alert.alert('Setup Required', 'Please configure your Google Cloud TTS API key in settings first.');
      return;
    }

    setIsLoadingAudio(true);
    try {
      const content = getPageContent();
      const audioUrl = await TTSService.synthesize(
        content,
        settings.ttsVoice,
        settings.ttsVoicePitch,
        settings.ttsVoiceRate
      );
      await AudioService.load(audioUrl);
      await AudioService.play();
      setIsPlaying(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate speech');
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handlePause = async () => {
    await AudioService.pause();
    setIsPlaying(false);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
      setIsPlaying(false);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setIsPlaying(false);
    }
  };

  const handleAddBookmark = async () => {
    try {
      await addBookmark({
        bookId: currentBook.id,
        chapter: 0,
        page: currentPage,
        progress: (currentPage / totalPages) * 100,
        timestamp: Date.now(),
        note: bookmarkNote,
      });
      setBookmarkNote('');
      setShowBookmarkModal(false);
      Alert.alert('Saved', 'Bookmark added');
    } catch (error) {
      Alert.alert('Error', 'Failed to add bookmark');
    }
  };

  const handleHighlight = async (color: string) => {
    if (!selectedText) return;
    try {
      await addHighlight({
        bookId: currentBook.id,
        chapter: 0,
        page: currentPage,
        text: selectedText,
        color,
        timestamp: Date.now(),
      });
      setSelectedText('');
      setShowHighlightColor(false);
      Alert.alert('Highlighted', 'Text saved to highlights');
    } catch (error) {
      Alert.alert('Error', 'Failed to highlight');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `"${getPageContent().substring(0, 100)}..." - From ${currentBook.title}`,
        title: currentBook.title,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const pageContent = getPageContent();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.backgroundColor, borderBottomColor: theme.selectionColor }]}>
        <View>
          <Text style={[styles.bookTitle, { color: theme.textColor }]} numberOfLines={1}>
            {currentBook.title}
          </Text>
          <Text style={[styles.pageInfo, { color: theme.accentColor }]}>
            Page {currentPage + 1} of {totalPages}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowMenus(!showMenus)}>
          <Text style={styles.menuIcon}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Menu */}
      {showMenus && (
        <View style={[styles.menu, { backgroundColor: theme.backgroundColor, borderColor: theme.selectionColor }]}>
          <TouchableOpacity onPress={() => setShowBookmarkModal(true)}>
            <Text style={[styles.menuItem, { color: theme.textColor }]}>🔖 Add Bookmark</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare}>
            <Text style={[styles.menuItem, { color: theme.textColor }]}>📤 Share</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMenus(false)}>
            <Text style={[styles.menuItem, { color: theme.textColor }]}>✕ Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Text Content */}
      <ScrollView
        style={[styles.textContainer, { backgroundColor: theme.backgroundColor }]}
        contentContainerStyle={styles.textContent}
      >
        <Text
          selectable
          style={[
            styles.bookText,
            {
              fontSize: settings.fontSize,
              lineHeight: settings.fontSize * settings.lineHeight,
              color: theme.textColor,
              textAlign: settings.textAlignment,
              letterSpacing: settings.letterSpacing,
            },
          ]}
          onTextLayout={() => {}}
        >
          {pageContent}
        </Text>
      </ScrollView>

      {/* TTS Playback */}
      {isPlaying && (
        <View style={[styles.audioBar, { backgroundColor: theme.selectionColor }]}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${playbackState.duration > 0 ? (playbackState.position / playbackState.duration) * 100 : 0}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.audioTime, { color: theme.textColor }]}>
            {Math.floor(playbackState.position / 1000)}s / {Math.floor(playbackState.duration / 1000)}s
          </Text>
        </View>
      )}

      {/* Controls */}
      <View style={[styles.controls, { backgroundColor: theme.backgroundColor, borderTopColor: theme.selectionColor }]}>
        <TouchableOpacity style={styles.controlButton} onPress={handlePreviousPage}>
          <Text style={styles.controlText}>← Prev</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={isPlaying ? handlePause : handleReadAloud}
          disabled={isLoadingAudio}
        >
          {isLoadingAudio ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.controlText}>{isPlaying ? '⏸' : '▶'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={handleNextPage}>
          <Text style={styles.controlText}>Next →</Text>
        </TouchableOpacity>
      </View>

      {/* Bookmark Modal */}
      <Modal visible={showBookmarkModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundColor }]}>
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>Add Bookmark</Text>
            <TextInput
              style={[styles.bookmarkInput, { color: theme.textColor, borderColor: theme.accentColor }]}
              placeholder="Add a note (optional)"
              placeholderTextColor={theme.accentColor}
              value={bookmarkNote}
              onChangeText={setBookmarkNote}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowBookmarkModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.accentColor }]}
                onPress={handleAddBookmark}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  bookTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  pageInfo: { fontSize: 12 },
  menuIcon: { fontSize: 20 },
  menu: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  textContainer: { flex: 1 },
  textContent: { padding: 16 },
  bookText: { fontFamily: 'Georgia' },
  audioBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#333',
    borderRadius: 1.5,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#4A90E2' },
  audioTime: { fontSize: 11, textAlign: 'center' },
  controls: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#333',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    flex: 1.2,
    paddingVertical: 12,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonActive: { backgroundColor: '#2E5CB8' },
  controlText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 12,
    padding: 16,
    width: '85%',
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  bookmarkInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    marginBottom: 12,
  },
  modalButtons: { flexDirection: 'row', gap: 8 },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: { color: '#fff', fontWeight: '600' },
});
