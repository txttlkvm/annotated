// Kokoro-82M (Apache-2.0, hexgrad/kokoro) via kokoro-js -- an 82M-parameter
// TTS model that runs entirely client-side through Transformers.js (WASM or
// WebGPU). No API key, no per-character billing, no network round trip once
// the ~86MB quantized model is cached by the browser. This replaces Google
// Cloud TTS as the engine behind Read Aloud and Share-as-audio on web.
//
// Native (Android/iOS) is out of scope here: kokoro-js's browser path needs
// WASM/WebGPU + the DOM, which react-native's JS engine doesn't provide.

import { Platform } from 'react-native';

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
// Confirmed live against the deployed app: a full reading page (well over
// 1000 characters) took 90+ seconds of blocking, synchronous, in-browser
// inference. Kokoro is only wired up for short highlighted passages (see
// AudioShareService) -- a page-length cap doesn't fit that reality, so this
// stays tight enough to keep worst-case generation time tolerable for the
// "highlight a sentence or two" case it's actually used for.
const MAX_CHARS = 500;

export type KokoroVoice =
  | 'af_heart' | 'af_bella' | 'af_nicole' | 'af_sarah' | 'af_sky'
  | 'am_fenrir' | 'am_michael' | 'am_puck'
  | 'bf_emma' | 'bm_fable' | 'bm_george';

/** Grade-A/B voices only, from the model card -- the full 26-voice roster
 * includes several graded D/F that aren't worth surfacing as options. */
export const KOKORO_VOICES: { id: KokoroVoice; label: string }[] = [
  { id: 'af_heart', label: 'Heart (US female)' },
  { id: 'af_bella', label: 'Bella (US female)' },
  { id: 'af_nicole', label: 'Nicole (US female)' },
  { id: 'af_sarah', label: 'Sarah (US female)' },
  { id: 'am_fenrir', label: 'Fenrir (US male)' },
  { id: 'am_michael', label: 'Michael (US male)' },
  { id: 'am_puck', label: 'Puck (US male)' },
  { id: 'bf_emma', label: 'Emma (UK female)' },
  { id: 'bm_fable', label: 'Fable (UK male)' },
  { id: 'bm_george', label: 'George (UK male)' },
];

export const DEFAULT_KOKORO_VOICE: KokoroVoice = 'af_heart';

export type KokoroLoadStage = 'downloading' | 'ready';
export type KokoroProgressCallback = (progress: { stage: KokoroLoadStage; percent: number }) => void;

// Blob.arrayBuffer() -> base64 without String.fromCharCode(...bytes), which
// blows the call stack once the wav is more than ~100KB (a few seconds of
// audio at 24kHz).
async function blobToDataUri(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export class KokoroTTSService {
  private static ttsPromise: Promise<any> | null = null;
  private static audioCache = new Map<string, string>();

  static isSupported(): boolean {
    return Platform.OS === 'web';
  }

  /** Loads (or returns the already-loading/loaded) model. Safe to call
   * repeatedly -- concurrent callers share the same in-flight promise. */
  private static async getModel(onProgress?: KokoroProgressCallback): Promise<any> {
    if (!this.ttsPromise) {
      this.ttsPromise = (async () => {
        // Metro doesn't resolve kokoro-js's package.json "exports" map (it
        // has no legacy "main" field, so Metro falls back to guessing
        // "./index" and fails) -- confirmed via a real `expo export --web`
        // build. kokoro-js ships a fully self-contained browser bundle at
        // this exact path (the same one its own jsdelivr/unpkg CDN fields
        // point at), so importing it directly sidesteps the broken
        // package-level resolution entirely.
        const { KokoroTTS } = await import('kokoro-js/dist/kokoro.web.js');
        const hasWebGPU = typeof navigator !== 'undefined' && !!(navigator as any).gpu;
        const load = (device: 'webgpu' | 'wasm') =>
          KokoroTTS.from_pretrained(MODEL_ID, {
            dtype: 'q8',
            device,
            progress_callback: (p: any) => {
              if (onProgress && p?.status === 'progress') {
                onProgress({ stage: 'downloading', percent: Math.round(p.progress || 0) });
              }
            },
          });
        try {
          const tts = hasWebGPU ? await load('webgpu') : await load('wasm');
          onProgress?.({ stage: 'ready', percent: 100 });
          return tts;
        } catch (error) {
          console.error('[Kokoro] primary device load failed:', hasWebGPU ? 'webgpu' : 'wasm', error);
          // WebGPU can be present but broken (driver/flag issues) -- wasm
          // works everywhere, so it's the safety net rather than a second
          // user-facing failure.
          if (hasWebGPU) {
            try {
              const tts = await load('wasm');
              onProgress?.({ stage: 'ready', percent: 100 });
              return tts;
            } catch (wasmError) {
              console.error('[Kokoro] wasm fallback also failed:', wasmError);
              throw wasmError;
            }
          }
          throw error;
        }
      })().catch((error) => {
        // Don't poison future calls with a permanently-rejected promise --
        // let the next synthesize() attempt retry from scratch.
        this.ttsPromise = null;
        throw error;
      });
    }
    return this.ttsPromise;
  }

  static async synthesize(
    text: string,
    voice: KokoroVoice = DEFAULT_KOKORO_VOICE,
    speed: number = 1.0,
    onProgress?: KokoroProgressCallback
  ): Promise<string> {
    if (!this.isSupported()) {
      throw new Error('Kokoro TTS is only available on web.');
    }
    const trimmed = text.trim().substring(0, MAX_CHARS);
    const cacheKey = `${trimmed}:${voice}:${speed}`;
    const cached = this.audioCache.get(cacheKey);
    if (cached) return cached;

    const tts = await this.getModel(onProgress);
    let audio;
    try {
      audio = await tts.generate(trimmed, { voice, speed });
    } catch (error) {
      console.error('[Kokoro] generate() failed:', error);
      throw error;
    }
    let uri;
    try {
      uri = await blobToDataUri(audio.toBlob());
    } catch (error) {
      console.error('[Kokoro] blob->data URI conversion failed:', error);
      throw error;
    }
    this.audioCache.set(cacheKey, uri);
    return uri;
  }

  static clearCache() {
    this.audioCache.clear();
  }
}
