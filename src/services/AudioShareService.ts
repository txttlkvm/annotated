// "Share as audio" — synthesize a passage, then hand the actual audio FILE to
// the OS share sheet (Messages/SMS included), the same way sharing a photo
// works. Not a link, not a page — a file the recipient can just play.

import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { TTSService } from './TTSService';
import { KokoroTTSService, DEFAULT_KOKORO_VOICE, KokoroVoice } from './KokoroTTSService';

const isWeb = Platform.OS === 'web';

export class AudioShareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioShareError';
  }
}

const EXT_BY_MIME: Record<string, string> = { 'audio/mp3': 'mp3', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' };

/** data:audio/xxx;base64,XXXX -> a real File object, for Web Share's files[]. */
function dataUriToFile(dataUri: string, baseName: string): File {
  const [header, base64] = dataUri.split(',');
  const mime = header.match(/data:(.*);base64/)?.[1] || 'audio/mp3';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], `${baseName}.${EXT_BY_MIME[mime] || 'mp3'}`, { type: mime });
}

/** Web fallback when the share sheet can't take files: a plain download. */
function downloadFile(dataUri: string, baseName: string) {
  const mime = dataUri.match(/data:(.*);base64/)?.[1] || 'audio/mp3';
  const a = document.createElement('a');
  a.href = dataUri;
  a.download = `${baseName}.${EXT_BY_MIME[mime] || 'mp3'}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export class AudioShareService {
  /**
   * Synthesizes `text` and opens the native share sheet with the audio file
   * attached. On web, requires the Web Share API's file-sharing mode
   * (Android Chrome, recent Safari) — desktop browsers generally don't
   * support sharing files at all, so this falls back to a direct download the
   * user can attach manually.
   */
  static async shareAsAudio(
    text: string,
    options: { voice?: string; pitch?: number; rate?: number; title?: string } = {}
  ): Promise<'shared' | 'downloaded'> {
    if (!text.trim()) {
      throw new AudioShareError('Nothing selected to turn into audio.');
    }

    // Kokoro runs locally in the browser (no key, no cost) so it's the
    // default on web; native still needs the Google Cloud key since
    // kokoro-js's WASM/WebGPU path only exists in a browser.
    let uri: string;
    if (KokoroTTSService.isSupported()) {
      uri = await KokoroTTSService.synthesize(text, DEFAULT_KOKORO_VOICE as KokoroVoice, options.rate);
    } else {
      if (!TTSService.hasApiKey()) {
        throw new AudioShareError('Set up your Google Cloud TTS key in Settings first.');
      }
      uri = await TTSService.synthesize(text, options.voice, options.pitch, options.rate);
    }
    const baseName = (options.title || 'passage').replace(/[^a-z0-9]+/gi, '-').slice(0, 40);

    if (isWeb) {
      const file = dataUriToFile(uri, baseName);
      const nav = navigator as any;
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: options.title || 'Audio passage' });
        return 'shared';
      }
      // Desktop browsers (and older mobile browsers) mostly can't share
      // files at all — hand the user a real file to attach themselves.
      downloadFile(uri, baseName);
      return 'downloaded';
    }

    if (!(await Sharing.isAvailableAsync())) {
      throw new AudioShareError('Sharing is not available on this device.');
    }
    await Sharing.shareAsync(uri, { mimeType: 'audio/mp3', dialogTitle: options.title });
    return 'shared';
  }
}
