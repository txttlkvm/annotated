// "Share as audio" — synthesize a passage, then hand the actual audio FILE to
// the OS share sheet (Messages/SMS included), the same way sharing a photo
// works. Not a link, not a page — a file the recipient can just play.

import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { TTSService } from './TTSService';

const isWeb = Platform.OS === 'web';

export class AudioShareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioShareError';
  }
}

/** data:audio/mp3;base64,XXXX -> a real File object, for Web Share's files[]. */
function dataUriToFile(dataUri: string, fileName: string): File {
  const [header, base64] = dataUri.split(',');
  const mime = header.match(/data:(.*);base64/)?.[1] || 'audio/mp3';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
}

/** Web fallback when the share sheet can't take files: a plain download. */
function downloadFile(dataUri: string, fileName: string) {
  const a = document.createElement('a');
  a.href = dataUri;
  a.download = fileName;
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
    if (!TTSService.hasApiKey()) {
      throw new AudioShareError('Set up your Google Cloud TTS key in Settings first.');
    }
    if (!text.trim()) {
      throw new AudioShareError('Nothing selected to turn into audio.');
    }

    const uri = await TTSService.synthesize(text, options.voice, options.pitch, options.rate);
    const fileName = `${(options.title || 'passage').replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.mp3`;

    if (isWeb) {
      const file = dataUriToFile(uri, fileName);
      const nav = navigator as any;
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: options.title || 'Audio passage' });
        return 'shared';
      }
      // Desktop browsers (and older mobile browsers) mostly can't share
      // files at all — hand the user a real file to attach themselves.
      downloadFile(uri, fileName);
      return 'downloaded';
    }

    if (!(await Sharing.isAvailableAsync())) {
      throw new AudioShareError('Sharing is not available on this device.');
    }
    await Sharing.shareAsync(uri, { mimeType: 'audio/mp3', dialogTitle: options.title });
    return 'shared';
  }
}
