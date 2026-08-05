// expo-av's web implementation silently no-ops: loadAsync/playAsync both
// resolve without error, but no real playback ever happens (confirmed live —
// after calling both, the DOM had zero <audio> elements). This wraps a real
// HTMLAudioElement behind the same async method shape expo-av's Audio.Sound
// exposes, so calling code (MusicPlayerScreen, AudioService) doesn't change,
// only which class gets instantiated, gated on Platform.OS.
//
// Shared rather than duplicated: AudioService.ts (Read Aloud playback) and
// MusicPlayerScreen.tsx (catalogue recordings) both need every method here,
// including setRateAsync, which the first version of this (written for
// MusicPlayerScreen alone) didn't have.

export interface WebSoundStatus {
  isLoaded: true;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  rate: number;
}

export class WebSound {
  private el: HTMLAudioElement;

  constructor(uri: string) {
    this.el = new window.Audio(uri);
    this.el.preload = 'auto';
  }

  async loadAsync(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(this.el.error || new Error('Audio failed to load'));
      };
      const cleanup = () => {
        this.el.removeEventListener('canplaythrough', onReady);
        this.el.removeEventListener('error', onError);
      };
      this.el.addEventListener('canplaythrough', onReady, { once: true });
      this.el.addEventListener('error', onError, { once: true });
      this.el.load();
    });
  }

  async playAsync(): Promise<void> {
    await this.el.play();
  }

  async pauseAsync(): Promise<void> {
    this.el.pause();
  }

  async stopAsync(): Promise<void> {
    this.el.pause();
    this.el.currentTime = 0;
  }

  async setPositionAsync(positionMillis: number): Promise<void> {
    this.el.currentTime = positionMillis / 1000;
  }

  /** Second param matches expo-av's setRateAsync(rate, shouldCorrectPitch)
   * signature so this stays call-compatible; HTMLAudioElement always
   * pitch-corrects, so it's accepted but unused. */
  async setRateAsync(rate: number, _shouldCorrectPitch?: boolean): Promise<void> {
    this.el.playbackRate = rate;
  }

  async getStatusAsync(): Promise<WebSoundStatus> {
    return {
      isLoaded: true,
      isPlaying: !this.el.paused,
      positionMillis: this.el.currentTime * 1000,
      durationMillis: Number.isFinite(this.el.duration) ? this.el.duration * 1000 : 0,
      rate: this.el.playbackRate,
    };
  }

  async unloadAsync(): Promise<void> {
    this.el.pause();
    this.el.src = '';
  }
}
