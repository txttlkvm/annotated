import * as FileSystem from 'expo-file-system';

export interface Voice {
  name: string;
  ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  naturalSampleRateHertz?: number;
}

export interface TTSConfig {
  apiKey: string;
  pitch?: number;
  speakingRate?: number;
  language: string;
}

export class TTSService {
  private static config: TTSConfig | null = null;
  private static audioCache = new Map<string, string>();

  static setConfig(config: TTSConfig) {
    this.config = config;
  }

  static async getAvailableVoices(language: string = 'en-US'): Promise<Voice[]> {
    if (!this.config) {
      throw new Error('TTS config not set. Call setConfig first.');
    }

    try {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/voices?languageCode=${language}&key=${this.config.apiKey}`
      );
      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Error fetching voices:', error);
      return [];
    }
  }

  static async synthesize(
    text: string,
    voiceName: string = 'en-US-Neural2-C',
    pitch: number = 1.0,
    rate: number = 1.0
  ): Promise<string> {
    if (!this.config) {
      throw new Error('TTS config not set. Call setConfig first.');
    }

    // Check cache
    const cacheKey = `${text}:${voiceName}`;
    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey)!;
    }

    try {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: { text },
            voice: {
              languageCode: this.config.language,
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
      if (data.audioContent) {
        // Save to file
        const fileName = `audio_${Date.now()}.mp3`;
        const filePath = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, data.audioContent, {
          encoding: FileSystem.EncodingType.Base64,
        });

        this.audioCache.set(cacheKey, filePath);
        return filePath;
      }

      throw new Error('No audio content in response');
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      throw error;
    }
  }

  static async synthesizeChunk(
    text: string,
    voiceName: string,
    pitch: number,
    rate: number,
    chunkIndex: number
  ): Promise<string> {
    // For long texts, break into smaller chunks
    const maxChunkLength = 5000; // Google TTS has limits
    if (text.length > maxChunkLength) {
      const chunk = text.substring(
        chunkIndex * maxChunkLength,
        Math.min((chunkIndex + 1) * maxChunkLength, text.length)
      );
      return this.synthesize(chunk, voiceName, pitch, rate);
    }
    return this.synthesize(text, voiceName, pitch, rate);
  }

  static clearCache() {
    this.audioCache.clear();
  }
}
