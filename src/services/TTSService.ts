import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { TTSConfig } from '../types';

export interface TTSVoice {
  name: string;
  displayName: string;
  gender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  language: string;
  isNeural: boolean;
}

export class TTSService {
  private static config: TTSConfig | null = null;
  private static voiceCache = new Map<string, string>();

  static async init() {
    try {
      const apiKey = await SecureStore.getItemAsync('google_tts_api_key');
      if (apiKey) {
        this.config = {
          apiKey,
          languageCode: 'en-US',
          voiceGender: 'NEUTRAL',
          voiceName: 'en-US-Neural2-C',
          pitch: 1.0,
          speakingRate: 1.0,
          useNeuralVoices: true,
        };
      }
    } catch (error) {
      console.error('TTS init error:', error);
    }
  }

  static async setApiKey(apiKey: string): Promise<void> {
    try {
      await SecureStore.setItemAsync('google_tts_api_key', apiKey);
      this.config = {
        apiKey,
        languageCode: 'en-US',
        voiceGender: 'NEUTRAL',
        voiceName: 'en-US-Neural2-C',
        pitch: 1.0,
        speakingRate: 1.0,
        useNeuralVoices: true,
      };
    } catch (error) {
      console.error('Error saving API key:', error);
      throw error;
    }
  }

  static async getAvailableVoices(): Promise<TTSVoice[]> {
    if (!this.config?.apiKey) {
      return this.getDefaultVoices();
    }

    try {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/voices?languageCode=en-US&key=${this.config.apiKey}`
      );
      const data = await response.json();

      return data.voices?.map((v: any) => ({
        name: v.name,
        displayName: v.name.split('-').slice(0, 2).join(' '),
        gender: v.ssmlGender,
        language: v.languageCodes?.[0] || 'en-US',
        isNeural: v.name.includes('Neural'),
      })) || this.getDefaultVoices();
    } catch (error) {
      console.error('Error fetching voices:', error);
      return this.getDefaultVoices();
    }
  }

  static async synthesize(
    text: string,
    voiceName: string = 'en-US-Neural2-C',
    pitch: number = 1.0,
    rate: number = 1.0
  ): Promise<string> {
    if (!this.config?.apiKey) {
      throw new Error('API key not configured. Set it in settings first.');
    }

    const cacheKey = `${text}:${voiceName}:${pitch}:${rate}`;
    if (this.voiceCache.has(cacheKey)) {
      return this.voiceCache.get(cacheKey)!;
    }

    try {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.config.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text: text.substring(0, 5000) },
            voice: {
              languageCode: 'en-US',
              name: voiceName,
            },
            audioConfig: {
              audioEncoding: 'MP3',
              pitch,
              speakingRate: rate,
            },
          }),
        }
      );

      const data = await response.json();
      if (!data.audioContent) throw new Error('No audio in response');

      const fileName = `audio_${Date.now()}.mp3`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, data.audioContent, {
        encoding: FileSystem.EncodingType.Base64,
      });

      this.voiceCache.set(cacheKey, filePath);
      return filePath;
    } catch (error) {
      console.error('TTS error:', error);
      throw error;
    }
  }

  static hasApiKey(): boolean {
    return !!this.config?.apiKey;
  }

  static clearCache() {
    this.voiceCache.clear();
  }

  private static getDefaultVoices(): TTSVoice[] {
    return [
      {
        name: 'en-US-Neural2-A',
        displayName: 'Natural A (Female)',
        gender: 'FEMALE',
        language: 'en-US',
        isNeural: true,
      },
      {
        name: 'en-US-Neural2-C',
        displayName: 'Natural C (Male)',
        gender: 'MALE',
        language: 'en-US',
        isNeural: true,
      },
      {
        name: 'en-US-Neural2-E',
        displayName: 'Natural E (Female)',
        gender: 'FEMALE',
        language: 'en-US',
        isNeural: true,
      },
      {
        name: 'en-US-Standard-A',
        displayName: 'Standard A',
        gender: 'FEMALE',
        language: 'en-US',
        isNeural: false,
      },
    ];
  }
}
