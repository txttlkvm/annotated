// Kokoro-82M (Apache-2.0, hexgrad/kokoro) via kokoro-js -- an 82M-parameter
// TTS model that runs entirely client-side through Transformers.js (WASM).
// No API key, no per-character billing, no network round trip once the
// ~86MB quantized model is cached by the browser. This replaces Google
// Cloud TTS as the engine behind Read Aloud and Share-as-audio on web.
//
// Runs inside a dedicated Web Worker, not the main thread. Confirmed live
// (both in this file's earlier version and independently reproduced via the
// polish-audit workflow) that Kokoro's generate() is a long, CPU-bound,
// synchronous WASM computation -- a single call for a normal reading-page
// chunk blocks whatever thread it runs on for several seconds, and the app
// was observed becoming fully unresponsive (failed clicks, eventually a
// forced reload back to Library) during Read Aloud as a result. Moving
// model load + inference into a worker keeps the main thread (and the UI:
// scrolling, taps, page turns) responsive throughout, at the cost of one
// postMessage round trip per call.
//
// Native (Android/iOS) is out of scope here: kokoro-js's browser path needs
// WASM + the DOM, which react-native's JS engine doesn't provide.

import { Platform } from 'react-native';

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
// Confirmed live against the deployed app: one Kokoro call for a full
// reading page (well over 1000 characters) took 90+ seconds of inference.
// Every caller of synthesize() -- both AudioShareService's highlighted-
// passage sharing and ReaderScreen's chunked Read Aloud (see
// buildReadAloudChunks) -- already keeps individual calls well under this
// by design; it's a hard backstop against a single call ever ballooning
// back into that case, not the primary mechanism keeping things fast.
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

/**
 * The worker's own source, built as a string rather than a separate file so
 * Metro never has to bundle it -- the same reasoning as the raw browser
 * import() below: Metro can't resolve kokoro-js's package.json "exports"
 * map, and even pointing directly at its shipped browser bundle produces a
 * chunk that references a module ID from the main bundle it never actually
 * includes. Constructed as a Blob URL and loaded as a module worker (so
 * dynamic import() works inside it) -- confirmed live in isolation before
 * wiring into this service: worker creation, message round-trips, and a
 * dynamic import() of the exact kokoro-js CDN URL all resolve cleanly from
 * inside a worker context in this stack.
 *
 * float32 WAV -> PCM16 WAV conversion also happens in here (not just
 * inference) -- confirmed live in the previous main-thread version that
 * kokoro-js's RawAudio.toWav() writes IEEE-float PCM (format tag 3), which
 * some decoders read as if it were a different format entirely (garbled,
 * pitch-shifted noise -- exactly what got reported as sounding like a
 * different language). Doing this inside the worker too means the main
 * thread only ever handles an already-correct, already-small PCM16 buffer.
 */
const WORKER_SOURCE = `
let ttsPromise = null;

function getModel(dtype, device) {
  if (!ttsPromise) {
    ttsPromise = (async () => {
      const { KokoroTTS } = await import("https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js");
      return KokoroTTS.from_pretrained(${JSON.stringify(MODEL_ID)}, {
        dtype,
        device,
        progress_callback: (p) => {
          if (p && p.status === 'progress') {
            self.postMessage({ type: 'progress', percent: Math.round(p.progress || 0) });
          }
        },
      });
    })().catch((error) => {
      ttsPromise = null;
      throw error;
    });
  }
  return ttsPromise;
}

function floatWavToPcm16Wav(buffer) {
  const view = new DataView(buffer);
  if (view.getUint32(0, false) !== 0x52494646) return buffer;

  let pos = 12, fmtTag = 1, channels = 1, sampleRate = 24000, bitsPerSample = 32, dataOffset = -1, dataLength = 0;
  while (pos + 8 <= view.byteLength) {
    const chunkId = view.getUint32(pos, false);
    const chunkSize = view.getUint32(pos + 4, true);
    const chunkStart = pos + 8;
    if (chunkId === 0x666d7420) {
      fmtTag = view.getUint16(chunkStart, true);
      channels = view.getUint16(chunkStart + 2, true);
      sampleRate = view.getUint32(chunkStart + 4, true);
      bitsPerSample = view.getUint16(chunkStart + 14, true);
    } else if (chunkId === 0x64617461) {
      dataOffset = chunkStart;
      dataLength = chunkSize;
    }
    pos = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (fmtTag !== 3 || bitsPerSample !== 32 || dataOffset < 0) return buffer;

  const floats = new Float32Array(buffer, dataOffset, dataLength / 4);
  const pcm16 = new Int16Array(floats.length);
  for (let i = 0; i < floats.length; i++) {
    const s = Math.max(-1, Math.min(1, floats[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const blockAlign = channels * 2;
  const byteRate = sampleRate * blockAlign;
  const out = new ArrayBuffer(44 + pcm16.byteLength);
  const outView = new DataView(out);
  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) outView.setUint8(offset + i, str.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  outView.setUint32(4, 36 + pcm16.byteLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  outView.setUint32(16, 16, true);
  outView.setUint16(20, 1, true);
  outView.setUint16(22, channels, true);
  outView.setUint32(24, sampleRate, true);
  outView.setUint32(28, byteRate, true);
  outView.setUint16(32, blockAlign, true);
  outView.setUint16(34, 16, true);
  writeStr(36, 'data');
  outView.setUint32(40, pcm16.byteLength, true);
  new Int16Array(out, 44).set(pcm16);
  return out;
}

self.onmessage = async (e) => {
  const { type, requestId } = e.data;
  if (type === 'init') {
    try {
      await getModel(e.data.dtype, e.data.device);
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'error', requestId: null, message: String((error && error.message) || error) });
    }
    return;
  }
  if (type === 'generate') {
    const { text, voice, speed, dtype, device } = e.data;
    try {
      let tts = await getModel(dtype, device);
      let audio;
      try {
        audio = await tts.generate(text, { voice, speed });
      } catch (error) {
        // Force a full model reload and retry once rather than leaving every
        // call after one bad generate() dead -- cheap insurance against the
        // wasm session getting into a bad state (OOM, a transient error).
        ttsPromise = null;
        tts = await getModel(dtype, device);
        audio = await tts.generate(text, { voice, speed });
      }
      const pcm16 = floatWavToPcm16Wav(audio.toWav());
      self.postMessage({ type: 'audio', requestId, wav: pcm16 }, [pcm16]);
    } catch (error) {
      self.postMessage({ type: 'error', requestId, message: String((error && error.message) || error) });
    }
  }
};
`;

interface PendingRequest {
  resolve: (uri: string) => void;
  reject: (error: Error) => void;
}

export class KokoroTTSService {
  private static worker: Worker | null = null;
  private static initPromise: Promise<void> | null = null;
  private static pending = new Map<string, PendingRequest>();
  private static requestCounter = 0;
  private static audioCache = new Map<string, string>();

  static isSupported(): boolean {
    return Platform.OS === 'web';
  }

  private static getWorker(): Worker {
    if (!this.worker) {
      const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent) => this.handleMessage(e.data);
      this.worker.onerror = (e: ErrorEvent) => {
        console.error('[Kokoro] worker error:', e.message);
      };
    }
    return this.worker;
  }

  private static handleMessage(data: any) {
    if (data.type === 'audio') {
      const pending = this.pending.get(data.requestId);
      if (!pending) return;
      this.pending.delete(data.requestId);
      const uri = bufferToDataUri(data.wav as ArrayBuffer);
      pending.resolve(uri);
    } else if (data.type === 'error' && data.requestId) {
      const pending = this.pending.get(data.requestId);
      if (!pending) return;
      this.pending.delete(data.requestId);
      pending.reject(new Error(data.message));
    }
    // 'ready' and 'progress' (and requestId-less 'error', from init) are
    // handled by getModel()'s own listener below, not here.
  }

  /** Loads (or returns the already-loading/loaded) model. Safe to call
   * repeatedly -- concurrent callers share the same in-flight promise.
   *
   * Always uses wasm, never webgpu, deliberately -- NOT a bundling
   * workaround, a correctness one. Compared the two head-to-head, same
   * model/voice/text, same machine: wasm transcribed perfectly; webgpu
   * produced audio that *looked* structurally fine (right sample count, no
   * errors thrown) but failed transcription 3/3 tries, and separately hit a
   * WebGPU device crash (DXGI_ERROR_DEVICE_HUNG) mid-session during earlier
   * testing. Silently wrong output is worse than the slower, correct path. */
  private static async ensureReady(onProgress?: KokoroProgressCallback): Promise<void> {
    if (this.initPromise) return this.initPromise;

    const worker = this.getWorker();
    this.initPromise = new Promise<void>((resolve, reject) => {
      const onMsg = (e: MessageEvent) => {
        const data = e.data;
        if (data.type === 'progress' && onProgress) {
          onProgress({ stage: 'downloading', percent: data.percent });
        } else if (data.type === 'ready') {
          worker.removeEventListener('message', onMsg);
          onProgress?.({ stage: 'ready', percent: 100 });
          resolve();
        } else if (data.type === 'error' && !data.requestId) {
          worker.removeEventListener('message', onMsg);
          reject(new Error(data.message));
        }
      };
      worker.addEventListener('message', onMsg);
      worker.postMessage({ type: 'init', dtype: 'q8', device: 'wasm' });
    }).catch((error) => {
      this.initPromise = null;
      throw error;
    });
    return this.initPromise;
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

    await this.ensureReady(onProgress);

    const requestId = `${Date.now()}-${this.requestCounter++}`;
    const uri = await new Promise<string>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.getWorker().postMessage({
        type: 'generate',
        requestId,
        text: trimmed,
        voice,
        speed,
        dtype: 'q8',
        device: 'wasm',
      });
    });

    this.audioCache.set(cacheKey, uri);
    return uri;
  }

  static clearCache() {
    this.audioCache.clear();
  }
}

// Blob.arrayBuffer() -> base64 without String.fromCharCode(...bytes), which
// blows the call stack once the wav is more than ~100KB (a few seconds of
// audio at 24kHz).
function bufferToDataUri(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}
