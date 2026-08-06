import { Platform } from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { WebSound } from './WebSound';

export interface PlaybackState {
  isPlaying: boolean;
  position: number;
  duration: number;
  rate: number;
}

type PlaybackStatusCallback = (state: PlaybackState) => void;
type SoundHandle = Audio.Sound | WebSound;

export class AudioService {
  private static sound: SoundHandle | null = null;
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
      // expo-av's web Audio.Sound.createAsync silently no-ops (confirmed live
      // for MusicPlayerScreen — resolves fine, zero <audio> elements exist,
      // nothing plays). WebSound wraps a real HTMLAudioElement instead.
      if (Platform.OS === 'web') {
        const webSound = new WebSound(uri);
        await webSound.loadAsync();
        this.sound = webSound;
      } else {
        const { sound } = await Audio.Sound.createAsync({ uri });
        this.sound = sound;
      }
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
    } catch {
      // Haptics failing is irrelevant to playback -- never let it block play().
    }
    // Deliberately NOT swallowed here (unlike the other methods below): a
    // browser blocking play() (stale user-activation, autoplay policy) is a
    // real failure a caller needs to know about, not something to log and
    // silently continue past. Confirmed live: Kokoro's chunked Read Aloud
    // would call this after a long async model-load/synthesize gap, play()
    // would reject, and the old swallow-and-continue behavior here made the
    // whole queue hang forever waiting for a chunk that was never playing.
    await this.sound.playAsync();
    this.startStatusUpdates();
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

  /** Resolves exactly once, when the CURRENTLY LOADED sound finishes
   * playing on its own. Uses each platform's real end-of-playback event
   * (WebSound's native 'ended' DOM event; expo-av's own didJustFinish
   * status flag) rather than inferring completion from polled
   * position/duration -- confirmed live that inference is unreliable for
   * data: URI sources on web (Kokoro's chunked Read Aloud queue stalled
   * forever after the first chunk: duration displayed correctly the whole
   * time, but the polled comparison never agreed the track had actually
   * ended). Real events have no such ambiguity. */
  static waitForEnd(): Promise<void> {
    if (!this.sound) return Promise.resolve();
    return new Promise((resolve) => {
      if (this.sound instanceof WebSound) {
        this.sound.onEnded(resolve);
      } else {
        (this.sound as Audio.Sound).setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) resolve();
        });
      }
    });
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
