import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { Audio } from 'expo-av';
import { useBooks } from '../context/BookContext';
import { TTSService } from '../services/TTSService';
import { AudioService } from '../services/AudioService';

const { width } = Dimensions.get('window');

export default function ReaderScreen() {
  const { currentBook, settings, updateBookProgress } = useBooks();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  if (!currentBook) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📖</Text>
          <Text style={styles.emptyText}>No book selected</Text>
          <Text style={styles.emptySubtext}>
            Select a book from your library to start reading
          </Text>
        </View>
      </View>
    );
  }

  const handleReadAloud = async () => {
    setIsLoadingAudio(true);
    try {
      // Get current section to read
      const section = currentBook.content?.substring(
        currentBook.currentPage * 500,
        Math.min((currentBook.currentPage + 1) * 500, currentBook.content.length)
      ) || '';

      const url = await TTSService.synthesize(
        section,
        'en-US-Neural2-C',
        settings.voicePitch,
        settings.voiceRate
      );

      setAudioUrl(url);
      await AudioService.loadAudio(url);
      await AudioService.play();
      setIsPlaying(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate speech. Make sure you have set a valid Google Cloud API key in settings.');
      console.error(error);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handlePause = async () => {
    await AudioService.pause();
    setIsPlaying(false);
  };

  const handleShare = async () => {
    try {
      const section = currentBook.content?.substring(
        currentBook.currentPage * 500,
        Math.min((currentBook.currentPage + 1) * 500, currentBook.content.length)
      ) || '';

      if (audioUrl) {
        await Share.share({
          url: audioUrl,
          title: currentBook.title,
          message: `Listen to a passage from "${currentBook.title}": ${section.substring(0, 100)}...`,
        });
      } else {
        Alert.alert('Info', 'Generate audio first to share');
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleNextPage = () => {
    if (currentBook.currentPage < currentBook.totalPages - 1) {
      updateBookProgress(currentBook.id, currentBook.currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentBook.currentPage > 0) {
      updateBookProgress(currentBook.id, currentBook.currentPage - 1);
    }
  };

  const currentSection = currentBook.content?.substring(
    currentBook.currentPage * 500,
    Math.min((currentBook.currentPage + 1) * 500, currentBook.content.length)
  ) || '';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.bookTitle}>{currentBook.title}</Text>
          <Text style={styles.pageInfo}>
            Page {currentBook.currentPage + 1} of {currentBook.totalPages}
          </Text>
        </View>
      </View>

      {/* Text Content */}
      <ScrollView
        style={styles.textContainer}
        contentContainerStyle={styles.textContent}
      >
        <Text
          style={[
            styles.bookText,
            {
              fontSize: settings.fontSize,
              lineHeight: settings.fontSize * settings.lineHeight,
              color: settings.textColor,
            },
          ]}
        >
          {currentSection}
        </Text>
      </ScrollView>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.pageButton}
          onPress={handlePreviousPage}
        >
          <Text style={styles.buttonText}>← Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={isPlaying ? handlePause : handleReadAloud}
          disabled={isLoadingAudio}
        >
          {isLoadingAudio ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isPlaying ? '⏸ Pause' : '▶ Read Aloud'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
        >
          <Text style={styles.buttonText}>📤 Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pageButton}
          onPress={handleNextPage}
        >
          <Text style={styles.buttonText}>Next →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomColor: '#333',
    borderBottomWidth: 1,
  },
  bookTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  pageInfo: {
    fontSize: 12,
    color: '#aaa',
  },
  textContainer: {
    flex: 1,
  },
  textContent: {
    padding: 16,
  },
  bookText: {
    color: '#e0e0e0',
    fontFamily: 'Georgia',
  },
  controls: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderTopColor: '#333',
    borderTopWidth: 1,
    gap: 8,
  },
  pageButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#333',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    flex: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonActive: {
    backgroundColor: '#2E5CB8',
  },
  shareButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#333',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#aaa',
  },
});
