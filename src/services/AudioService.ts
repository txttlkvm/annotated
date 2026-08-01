import { Audio } from 'expo-av';

export class AudioService {
  private static sound: Audio.Sound | null = null;
  private static isPlaying: boolean = false;

  static async loadAudio(uri: string): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync({ uri });
      this.sound = sound;
    } catch (error) {
      console.error('Error loading audio:', error);
      throw error;
    }
  }

  static async play(): Promise<void> {
    if (!this.sound) return;
    try {
      await this.sound.playAsync();
      this.isPlaying = true;
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  static async pause(): Promise<void> {
    if (!this.sound) return;
    try {
      await this.sound.pauseAsync();
      this.isPlaying = false;
    } catch (error) {
      console.error('Error pausing audio:', error);
    }
  }

  static async stop(): Promise<void> {
    if (!this.sound) return;
    try {
      await this.sound.stopAsync();
      this.isPlaying = false;
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  }

  static async seek(position: number): Promise<void> {
    if (!this.sound) return;
    try {
      await this.sound.setPositionAsync(position);
    } catch (error) {
      console.error('Error seeking audio:', error);
    }
  }

  static async setRate(rate: number): Promise<void> {
    if (!this.sound) return;
    try {
      await this.sound.setRateAsync(rate, true);
    } catch (error) {
      console.error('Error setting rate:', error);
    }
  }

  static async getDuration(): Promise<number | null> {
    if (!this.sound) return null;
    try {
      const status = await this.sound.getStatusAsync();
      return status.durationMillis || null;
    } catch (error) {
      console.error('Error getting duration:', error);
      return null;
    }
  }

  static async getPosition(): Promise<number | null> {
    if (!this.sound) return null;
    try {
      const status = await this.sound.getStatusAsync();
      return status.positionMillis || null;
    } catch (error) {
      console.error('Error getting position:', error);
      return null;
    }
  }

  static getIsPlaying(): boolean {
    return this.isPlaying;
  }

  static async cleanup(): Promise<void> {
    if (this.sound) {
      await this.sound.unloadAsync();
      this.sound = null;
      this.isPlaying = false;
    }
  }
}
