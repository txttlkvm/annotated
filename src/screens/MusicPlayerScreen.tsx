import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Audio } from 'expo-av';
import { useApp } from '../context/AppContext';

interface MusicState {
  isLoading: boolean;
  isPlaying: boolean;
  sound: Audio.Sound | null;
  duration: number;
  position: number;
  error: string | null;
}

export default function MusicPlayerScreen({ route, navigation }: any) {
  const { filePath, title, artist } = route.params;
  const { settings } = useApp();

  const [state, setState] = useState<MusicState>({
    isLoading: true,
    isPlaying: false,
    sound: null,
    duration: 0,
    position: 0,
    error: null,
  });

  const [isBuffering, setIsBuffering] = useState(false);

  useEffect(() => {
    loadAudio();
    return () => {
      if (state.sound) {
        state.sound.unloadAsync().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (state.isPlaying && state.sound) {
        state.sound.getStatusAsync().then((status) => {
          if (status.isLoaded) {
            setState((prev) => ({
              ...prev,
              position: status.positionMillis,
              duration: status.durationMillis || 0,
            }));
          }
        });
      }
    }, 500);

    return () => clearInterval(interval);
  }, [state.isPlaying, state.sound]);

  const loadAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });

      const sound = new Audio.Sound();
      await sound.loadAsync({ uri: `file://${filePath}` });

      const status = await sound.getStatusAsync();
      setState((prev) => ({
        ...prev,
        sound,
        duration: status.durationMillis || 0,
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load audio',
        isLoading: false,
      }));
      Alert.alert('Error', 'Could not load audio file');
    }
  };

  const handlePlayPause = async () => {
    if (!state.sound) return;

    try {
      if (state.isPlaying) {
        await state.sound.pauseAsync();
        setState((prev) => ({ ...prev, isPlaying: false }));
      } else {
        await state.sound.playAsync();
        setState((prev) => ({ ...prev, isPlaying: true }));
      }
    } catch (error) {
      Alert.alert('Error', 'Playback failed');
    }
  };

  const handleSeek = async (position: number) => {
    if (!state.sound) return;

    try {
      await state.sound.setPositionAsync(position);
      setState((prev) => ({ ...prev, position }));
    } catch (error) {
      console.error('Seek error:', error);
    }
  };

  const handleStop = async () => {
    if (!state.sound) return;

    try {
      await state.sound.stopAsync();
      setState((prev) => ({ ...prev, isPlaying: false, position: 0 }));
    } catch (error) {
      console.error('Stop error:', error);
    }
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const progress = state.duration ? (state.position / state.duration) * 100 : 0;

  const bgColor = settings.theme === 'light' ? '#f5f5f5' : '#0f0a1a';
  const textColor = settings.theme === 'light' ? '#333' : '#c9a961';
  const secondaryColor = settings.theme === 'light' ? '#666' : '#8b7355';
  const accentColor = settings.theme === 'light' ? '#e0e0e0' : '#2d1b4e';
  const borderColor = settings.theme === 'light' ? '#ddd' : '#c9a961';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: textColor }]}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Album Art */}
        <View style={[styles.albumArt, { backgroundColor: accentColor, borderColor: textColor }]}>
          <Text style={[styles.albumSymbol, { color: textColor }]}>♪</Text>
        </View>

        {/* Metadata */}
        <View style={styles.metadata}>
          <Text style={[styles.title, { color: textColor }]}>{title}</Text>
          <Text style={[styles.artist, { color: secondaryColor }]}>{artist}</Text>
        </View>

        {/* Study Guide */}
        <View style={[styles.studyGuide, { backgroundColor: accentColor, borderColor: borderColor }]}>
          <Text style={[styles.studyTitle, { color: textColor }]}>— Listening Study —</Text>
          <Text style={[styles.studyText, { color: secondaryColor }]}>
            Listen to this composition attentively. Study its structure, harmony, and emotional progression. Pay attention to the instrumentation and how themes develop throughout the piece. Allow the music to guide your contemplation.
          </Text>
        </View>

        {/* Playback Controls */}
        {state.error ? (
          <View style={[styles.errorBox, { backgroundColor: accentColor, borderColor: borderColor }]}>
            <Text style={[styles.errorText, { color: '#c67c7c' }]}>{state.error}</Text>
          </View>
        ) : state.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={textColor} />
          </View>
        ) : (
          <>
            {/* Progress Bar */}
            <View style={styles.progressSection}>
              <Text style={[styles.timeText, { color: secondaryColor }]}>
                {formatTime(state.position)}
              </Text>
              <TouchableOpacity
                style={[styles.progressBar, { backgroundColor: accentColor, borderColor: secondaryColor }]}
                onPress={(e) => {
                  const { locationX } = e.nativeEvent;
                  const { width } = e.currentTarget;
                  const newPosition = (locationX / width) * state.duration;
                  handleSeek(newPosition);
                }}
              >
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progress}%`, backgroundColor: textColor },
                  ]}
                />
              </TouchableOpacity>
              <Text style={[styles.timeText, { color: secondaryColor }]}>
                {formatTime(state.duration)}
              </Text>
            </View>

            {/* Control Buttons */}
            <View style={styles.controlsContainer}>
              <TouchableOpacity
                style={[styles.controlButton, { borderColor: secondaryColor }]}
                onPress={handleStop}
              >
                <Text style={[styles.controlIcon, { color: secondaryColor }]}>■</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.playButton, { backgroundColor: accentColor, borderColor: textColor }]}
                onPress={handlePlayPause}
                disabled={isBuffering}
              >
                <Text style={[styles.playIcon, { color: textColor }]}>
                  {isBuffering ? '◐' : state.isPlaying ? '⏸' : '▶'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, { borderColor: secondaryColor }]}
                onPress={() => handleSeek(Math.max(0, state.position - 15000))}
              >
                <Text style={[styles.controlIcon, { color: secondaryColor }]}>-15s</Text>
              </TouchableOpacity>
            </View>

            {/* Volume Control */}
            <View style={styles.volumeSection}>
              <Text style={[styles.volumeLabel, { color: secondaryColor }]}>Volume</Text>
              <View style={[styles.volumeBar, { backgroundColor: accentColor, borderColor: secondaryColor }]}>
                <View
                  style={[
                    styles.volumeFill,
                    { width: '70%', backgroundColor: textColor },
                  ]}
                />
              </View>
            </View>

            {/* Info */}
            <View style={[styles.infoBox, { backgroundColor: accentColor, borderColor: borderColor }]}>
              <Text style={[styles.infoLabel, { color: textColor }]}>Duration</Text>
              <Text style={[styles.infoValue, { color: textColor }]}>{formatTime(state.duration)}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
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
  content: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 24 },
  albumArt: {
    width: 200,
    height: 200,
    borderRadius: 2,
    borderWidth: 2,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  albumSymbol: { fontSize: 80, fontWeight: '300' },
  metadata: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 22, fontWeight: '400', fontFamily: 'Georgia', letterSpacing: 1, marginBottom: 4 },
  artist: { fontSize: 14, letterSpacing: 0.5 },
  studyGuide: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 2,
    borderLeftWidth: 2,
    borderWidth: 1,
    marginBottom: 24,
  },
  studyTitle: { fontSize: 12, fontWeight: '400', fontFamily: 'Georgia', letterSpacing: 2, marginBottom: 8 },
  studyText: { fontSize: 11, lineHeight: 16, letterSpacing: 0.5 },
  progressSection: { marginBottom: 24 },
  timeText: { fontSize: 11, letterSpacing: 0.5, marginBottom: 8 },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginVertical: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  progressFill: { height: '100%' },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: { fontSize: 32, fontWeight: '400' },
  controlButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 2,
    borderWidth: 1,
  },
  controlIcon: { fontSize: 12, fontWeight: '400', letterSpacing: 0.5 },
  volumeSection: { marginBottom: 24 },
  volumeLabel: { fontSize: 11, fontWeight: '400', letterSpacing: 1, marginBottom: 8 },
  volumeBar: {
    height: 4,
    borderRadius: 2,
    borderWidth: 1,
    overflow: 'hidden',
  },
  volumeFill: { height: '100%' },
  infoBox: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 2,
    borderLeftWidth: 2,
    borderWidth: 1,
    marginBottom: 24,
  },
  infoLabel: { fontSize: 11, fontWeight: '400', letterSpacing: 1, marginBottom: 4 },
  infoValue: { fontSize: 14, fontFamily: 'Georgia', letterSpacing: 0.5 },
  errorBox: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 2,
    borderLeftWidth: 2,
    borderWidth: 1,
    marginBottom: 24,
  },
  errorText: { fontSize: 12, letterSpacing: 0.5 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center', marginVertical: 40 },
});
