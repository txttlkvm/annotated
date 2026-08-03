import { Platform } from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as Haptics from 'expo-haptics';

export interface PlaybackState {
  isPlaying: boolean;
  position: number;
  duration: number;
  rate: number;
}

type PlaybackStatusCallback = (state: PlaybackState) => void;

export class AudioService {
  private static sound: Audio.Sound | null = null;
  private static playbackStatusCallback: PlaybackStatusCallback | null = null;
  private static updateInterval: ReturnType<typeof setInterval> | null = null;

  static async init() {
    if (Platform.OS === 'web') return;
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }

  static async load(uri: string): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync({ uri });
      this.sound = sound;
      this.startStatusUpdates();
    } catch (error) {
      console.error('Load error:', error);
      throw error;
    }
  }

  static async play(): Promise<void> {
    if (!this.sound) return;
    try {
      await Haptics.selectionAsync();
      await this.sound.playAsync();
      this.startStatusUpdates();
    } catch (error) {
      console.error('Play error:', error);
    }
  }

  static async pause(): Promise<void> {
    if (!this.sound) return;
    try {
      await Haptics.selectionAsync();
      await this.sound.pauseAsync();
      this.stopStatusUpdates();
    } catch (error) {
      console.error('Pause error:', error);
    }
  }

  static async stop(): Promise<void> {
    if (!this.sound) return;
    try {
      await this.sound.stopAsync();
      this.stopStatusUpdates();
    } catch (error) {
      console.error('Stop error:', error);
    }
  }

  static async seek(position: number): Promise<void> {
    if (!this.sound) return;
    try {
      await this.sound.setPositionAsync(position);
    } catch (error) {
      console.error('Seek error:', error);
    }
  }

  static async setRate(rate: number): Promise<void> {
    if (!this.sound) return;
    try {
      await this.sound.setRateAsync(rate, true);
    } catch (error) {
      console.error('Rate error:', error);
    }
  }

  static async cleanup(): Promise<void> {
    this.stopStatusUpdates();
    if (this.sound) {
      await this.sound.unloadAsync();
      this.sound = null;
    }
  }

  static onPlaybackStatus(callback: PlaybackStatusCallback) {
    this.playbackStatusCallback = callback;
  }

  private static startStatusUpdates() {
    this.stopStatusUpdates();
    this.updateInterval = setInterval(() => this.updateStatus(), 500);
  }

  private static stopStatusUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private static async updateStatus() {
    if (!this.sound || !this.playbackStatusCallback) return;
    try {
      const status = await this.sound.getStatusAsync();
      if (status.isLoaded) {
        this.playbackStatusCallback({
          isPlaying: status.isPlaying,
          position: status.positionMillis || 0,
          duration: status.durationMillis || 0,
          rate: status.rate || 1,
        });
      }
    } catch (error) {
      console.error('Status update error:', error);
    }
  }
}
