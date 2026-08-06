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

/**
 * Browsers require a recent, real user gesture before allowing audio
 * playback -- and that "recent" window is short enough that an async chain
 * of (model download + inference) between a click and the eventual
 * `.play()` call can outlast it, even though the click that started
 * everything was completely genuine. Confirmed as the cause of Kokoro Read
 * Aloud loading fully and then playing nothing: play() was rejecting
 * silently (see the removed try/catch in AudioService.play()).
 *
 * The fix is the standard one for this exact problem: play something --
 * anything, even total silence -- SYNCHRONOUSLY inside the click handler,
 * before any async work starts. Chrome (and other browsers) treat that as
 * satisfying the gesture requirement for audio playback on the page going
 * forward, not just for that one element, so the real audio later in the
 * same handler is then allowed to play even after a long async gap.
 */
export function unlockAudioPlayback(): void {
  if (typeof window === 'undefined') return;
  try {
    // ~12.5ms of real (silent) 16-bit PCM samples -- verified before
    // shipping (decoded and parsed the header in Python) rather than
    // hand-typing base64 and hoping. A zero-length data chunk was tried
    // first and rejected once checked: valid WAV structure, but nothing to
    // actually play, which risks the "unlock" never firing at all.
    const silentWav =
      'data:audio/wav;base64,UklGRuwAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YcgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
    const el = new window.Audio(silentWav);
    el.play()?.catch(() => {});
  } catch {
    // Best-effort -- if this fails, the real play() call downstream will
    // surface its own error rather than hanging silently (see AudioService).
  }
}

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

  /** Fires exactly once when this element's playback completes naturally.
   * The real DOM 'ended' event, not inferred from position/duration polling
   * -- confirmed live that inference is unreliable for data: URI sources
   * (Kokoro's chunked Read Aloud queue stalled forever after chunk one:
   * duration displayed correctly all through playback, but the polled
   * position/duration comparison used to detect "this chunk is done" never
   * agreed after the track actually ended). 'ended' has no such ambiguity. */
  onEnded(callback: () => void): () => void {
    this.el.addEventListener('ended', callback, { once: true });
    return () => this.el.removeEventListener('ended', callback);
  }
}
