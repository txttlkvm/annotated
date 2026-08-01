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
      <View style={[styles.container, { backgroundColor: '#0f0a1a' }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✦</Text>
          <Text style={[styles.emptyText, { color: '#c9a961' }]}>No manuscript selected</Text>
          <Text style={[styles.emptySubtext, { color: '#8b7355' }]}>
            Choose a manuscript from your library to begin your contemplation
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
      <View style={[styles.header, { backgroundColor: '#1a1328', borderBottomColor: '#c9a961' }]}>
        <View>
          <Text style={[styles.bookTitle, { color: '#c9a961' }]} numberOfLines={1}>
            {currentBook.title}
          </Text>
          <Text style={[styles.pageInfo, { color: '#8b7355' }]}>
            Page {currentPage + 1} of {totalPages}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowMenus(!showMenus)}>
          <Text style={[styles.menuIcon, { color: '#c9a961' }]}>≡</Text>
        </TouchableOpacity>
      </View>

      {/* Menu */}
      {showMenus && (
        <View style={[styles.menu, { backgroundColor: '#1a1328', borderColor: '#8b7355' }]}>
          <TouchableOpacity onPress={() => setShowBookmarkModal(true)}>
            <Text style={[styles.menuItem, { color: '#c9a961' }]}>✦ Add Bookmark</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare}>
            <Text style={[styles.menuItem, { color: '#c9a961' }]}>✦ Share Passage</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMenus(false)}>
            <Text style={[styles.menuItem, { color: '#c9a961' }]}>✦ Close</Text>
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
        <View style={[styles.audioBar, { backgroundColor: '#2d1b4e' }]}>
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
          <Text style={[styles.audioTime, { color: '#c9a961' }]}>
            {Math.floor(playbackState.position / 1000)}s / {Math.floor(playbackState.duration / 1000)}s
          </Text>
        </View>
      )}

      {/* Controls */}
      <View style={[styles.controls, { backgroundColor: '#1a1328', borderTopColor: '#8b7355' }]}>
        <TouchableOpacity style={[styles.controlButton, { borderColor: '#8b7355' }]} onPress={handlePreviousPage}>
          <Text style={[styles.controlText, { color: '#c9a961' }]}>← Prev</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.playButton, { borderColor: '#c9a961' }, isPlaying && styles.playButtonActive]}
          onPress={isPlaying ? handlePause : handleReadAloud}
          disabled={isLoadingAudio}
        >
          {isLoadingAudio ? (
            <ActivityIndicator color="#c9a961" />
          ) : (
            <Text style={[styles.controlText, { color: '#c9a961' }]}>{isPlaying ? '⏸' : '▶'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.controlButton, { borderColor: '#8b7355' }]} onPress={handleNextPage}>
          <Text style={[styles.controlText, { color: '#c9a961' }]}>Next →</Text>
        </TouchableOpacity>
      </View>

      {/* Bookmark Modal */}
      <Modal visible={showBookmarkModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: '#1a1328', borderColor: '#c9a961' }]}>
            <Text style={[styles.modalTitle, { color: '#c9a961' }]}>✦ Add Bookmark</Text>
            <TextInput
              style={[styles.bookmarkInput, { color: '#c9a961', borderColor: '#8b7355', backgroundColor: '#2d1b4e' }]}
              placeholder="Add a note (optional)"
              placeholderTextColor="#8b7355"
              value={bookmarkNote}
              onChangeText={setBookmarkNote}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: '#8b7355' }]}
                onPress={() => setShowBookmarkModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: '#c9a961' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#2d1b4e', borderColor: '#c9a961' }]}
                onPress={handleAddBookmark}
              >
                <Text style={[styles.modalButtonText, { color: '#c9a961' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0a1a' },
  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  bookTitle: { fontSize: 17, fontWeight: '400', marginBottom: 4, fontFamily: 'Georgia', letterSpacing: 1 },
  pageInfo: { fontSize: 11, letterSpacing: 0.5 },
  menuIcon: { fontSize: 18, fontWeight: '300' },
  menu: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: '400',
    fontFamily: 'Georgia',
    letterSpacing: 1,
  },
  textContainer: { flex: 1, backgroundColor: '#0f0a1a' },
  textContent: { padding: 16 },
  bookText: { fontFamily: 'Georgia' },
  audioBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#8b7355',
  },
  progressBar: {
    height: 2,
    backgroundColor: '#3d3730',
    borderRadius: 1,
    marginBottom: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#8b7355',
  },
  progressFill: { height: '100%', backgroundColor: '#c9a961' },
  audioTime: { fontSize: 10, textAlign: 'center', letterSpacing: 1 },
  controls: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderTopWidth: 2,
    gap: 8,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#1a1328',
    borderRadius: 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    flex: 1.2,
    paddingVertical: 12,
    backgroundColor: '#1a1328',
    borderRadius: 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonActive: { backgroundColor: '#2d1b4e' },
  controlText: { fontWeight: '400', fontSize: 13, letterSpacing: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: '400', marginBottom: 8, fontFamily: 'Georgia', letterSpacing: 1 },
  emptySubtext: { fontSize: 12, letterSpacing: 0.5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 2,
    borderWidth: 2,
    padding: 16,
    width: '85%',
  },
  modalTitle: { fontSize: 15, fontWeight: '400', marginBottom: 12, fontFamily: 'Georgia', letterSpacing: 1 },
  bookmarkInput: {
    borderWidth: 1,
    borderRadius: 2,
    padding: 10,
    minHeight: 80,
    marginBottom: 12,
    fontFamily: 'Georgia',
  },
  modalButtons: { flexDirection: 'row', gap: 8 },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#1a1328',
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalButtonText: { fontWeight: '400', letterSpacing: 1, fontSize: 12 },
});
