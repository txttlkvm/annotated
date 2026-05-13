const { BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const { createSTT } = require('../../common/ai/factory');
const modelStateService = require('../../common/services/modelStateService');
const fs = require('fs');
const path = require('path');
const _debugLog = (...args) => {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(path.join(require('os').homedir(), 'annotated-debug.log'), line); } catch {}
};

const COMPLETION_DEBOUNCE_MS = 800; // reduced from 2000ms — fire sooner after speech pause

// ── New heartbeat / renewal constants ────────────────────────────────────────────
// Interval to send low-cost keep-alive messages so the remote service does not
// treat the connection as idle. One minute is safely below the typical 2-5 min
// idle timeout window seen on provider websockets.
const KEEP_ALIVE_INTERVAL_MS = 60 * 1000;         // 1 minute

// Interval after which we pro-actively tear down and recreate the STT sessions
// to dodge the 30-minute hard timeout enforced by some providers. 20 minutes
// gives a 10-minute safety buffer.
const SESSION_RENEW_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

// Duration to allow the old and new sockets to run in parallel so we don't
// miss any packets at the exact swap moment.
const SOCKET_OVERLAP_MS = 2 * 1000; // 2 seconds

class SttService {
    constructor() {
        this.mySttSession = null;
        this.theirSttSession = null;
        this.myCurrentUtterance = '';
        this.theirCurrentUtterance = '';
        
        // Turn-completion debouncing
        this.myCompletionBuffer = '';
        this.theirCompletionBuffer = '';
        this.myCompletionTimer = null;
        this.theirCompletionTimer = null;
        
        // System audio capture
        this.systemAudioProc = null;

        // Keep-alive / renewal timers
        this.keepAliveInterval = null;
        this.sessionRenewTimeout = null;

        // Callbacks
        this.onTranscriptionComplete = null;
        this.onStatusUpdate = null;

        this.modelInfo = null;
        this._fallbackActive = false;  // prevents double-init when both sessions close
        this._sessionLanguage = 'en';

        // ── Audio ring buffer for voice biometrics ──
        // Stores the most recent N seconds of system-audio PCM so we can grab a
        // sample on demand for pyannote enrollment / identification.
        this._theirAudioBuf = [];      // array of Buffer chunks (PCM16LE)
        this._theirAudioBufBytes = 0;  // running total size
        this._theirAudioSampleRate = 24000;
        this._theirAudioMaxBytes = 24000 * 2 * 90; // 90s of mono 16-bit @ 24kHz

        // Cumulative count of samples pushed (across ring-buffer evictions).
        // Used to translate Speechmatics word timestamps to byte offsets.
        this._theirSamplesPushed = 0;

        // Per-Speechmatics-speaker time ranges: { 'S0': [{t1, t2}, ...] }
        // Used to slice ONLY this speaker's audio for pyannote identify.
        this._speakerTimeRanges = new Map();

        // Speakers we've already attempted to identify this session (to avoid
        // re-querying pyannote for every utterance from the same diarization id).
        this._identifyAttempted = new Set();

        // Echo suppression: ring buffer of recent system-audio finals so we
        // can detect when the mic is picking up speaker output. Each entry =
        // { text: lowercase normalized, ts: Date.now() }
        this._recentTheirFinals = [];

        // Dedupe: ring buffer of recent FINAL emissions to renderer. Speechmatics
        // sometimes double-emits the same text once with a diarization label
        // (Them:S1) and once with the plain "Them" tag, ~3-8s apart. Each entry =
        // { norm, speaker, ts, sentToRenderer: bool }
        this._recentEmittedFinals = [];
    }

    /**
     * Apply name-correction post-processing to final text. Speechmatics and
     * Deepgram still mangle "Calacanis" -> "Kalakanis" etc. occasionally
     * despite vocab boost; this normalizes those before they reach the user.
     */
    _correctNames(text) {
        try {
            const { correctNames } = require('./nameCorrector');
            return correctNames(text);
        } catch (_) {
            return text;
        }
    }

    /**
     * Filtered emit for "Their" finals. Drops near-duplicates within a 12s window
     * (regardless of speaker label). Returns true if emitted, false if suppressed.
     *
     * Speechmatics emits the same content multiple ways:
     *   1. Same text twice (Them:S1 then plain Them) — direct dupe
     *   2. Progressive: first a 10-word prefix, then a 29-word superset — same content,
     *      just more committed on retry. We drop the superset because the prefix
     *      already reached the renderer.
     *   3. Retry shrink: rare but possible — earlier longer text replaced by shorter.
     */
    _emitTheirFinal(payload) {
        // Apply name corrections BEFORE dedupe + emission so the canonical
        // spelling is what we compare and what reaches the renderer.
        if (payload.text) payload = { ...payload, text: this._correctNames(payload.text) };
        const norm = (payload.text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!norm) return false;
        const now = Date.now();
        const cutoff = now - 12000;
        // Prune
        this._recentEmittedFinals = this._recentEmittedFinals.filter(e => e.ts > cutoff);

        const myTokens = norm.split(' ').filter(Boolean);
        const myWords = new Set(myTokens.filter(w => w.length >= 3));

        for (const entry of this._recentEmittedFinals) {
            // (1) Identical text — drop
            if (entry.norm === norm) {
                console.log(`[SttService] DEDUPE drop: same-text (${entry.speaker} → ${payload.speaker}) "${norm.slice(0, 60)}"`);
                return false;
            }
            // (2) Strict prefix-superset: this emission starts with the entry's text.
            //     The prefix already rendered; drop the longer version.
            if (entry.tokens && myTokens.length > entry.tokens.length) {
                const prefixLen = entry.tokens.length;
                let isPrefix = true;
                for (let i = 0; i < prefixLen; i++) {
                    if (myTokens[i] !== entry.tokens[i]) { isPrefix = false; break; }
                }
                if (isPrefix) {
                    console.log(`[SttService] DEDUPE drop: superset of recent (${entry.speaker}→${payload.speaker}) "${norm.slice(0, 60)}"`);
                    return false;
                }
            }
            // (3) Strict suffix-prefix: entry's text starts with this emission (rare retry-shrink).
            if (entry.tokens && myTokens.length < entry.tokens.length) {
                let isPrefix = true;
                for (let i = 0; i < myTokens.length; i++) {
                    if (myTokens[i] !== entry.tokens[i]) { isPrefix = false; break; }
                }
                if (isPrefix) {
                    console.log(`[SttService] DEDUPE drop: prefix-of-recent (${entry.speaker}→${payload.speaker}) "${norm.slice(0, 60)}"`);
                    return false;
                }
            }
            // (4) High word-overlap (≥85%) — handles minor punctuation/spacing diffs.
            if (myWords.size >= 3) {
                let common = 0;
                for (const w of myWords) if (entry.words.has(w)) common++;
                const overlap = common / Math.max(myWords.size, entry.words.size);
                if (overlap >= 0.85) {
                    console.log(`[SttService] DEDUPE drop: ${(overlap*100).toFixed(0)}% word overlap (${entry.speaker}→${payload.speaker}) "${norm.slice(0, 60)}"`);
                    return false;
                }
            }
        }
        this._recentEmittedFinals.push({ norm, tokens: myTokens, words: myWords, speaker: payload.speaker, ts: now });
        this.sendToRenderer('stt-update', payload);
        return true;
    }

    _recordTheirFinal(text) {
        const norm = (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        if (norm.length < 5) return;
        this._recentTheirFinals.push({ text: norm, words: new Set(norm.split(' ').filter(w => w.length >= 2)), ts: Date.now() });
        // Keep last 30s of history — Speechmatics-Them finals can lag mic by 5-15s
        const cutoff = Date.now() - 30000;
        this._recentTheirFinals = this._recentTheirFinals.filter(e => e.ts > cutoff);
    }

    /** Are we likely in "user is listening to system audio through speakers" mode? */
    _systemAudioRecentlyActive() {
        const cutoff = Date.now() - 30000;
        return this._recentTheirFinals.some(e => e.ts > cutoff);
    }

    _isEchoOfTheirAudio(myText) {
        const norm = (myText || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        if (norm.length < 5) return false;
        const myWords = norm.split(' ').filter(w => w.length >= 2);
        if (myWords.length < 2) return false;
        const mySet = new Set(myWords);

        // Strict bidirectional matching against ALL recent system-audio finals
        for (const entry of this._recentTheirFinals) {
            // Substring match either direction → strong signal
            if (entry.text.includes(norm) || norm.includes(entry.text)) return true;

            // Word-overlap from THEIR words → mine
            const theirWordsArr = entry.text.split(' ').filter(w => w.length >= 2);
            if (theirWordsArr.length >= 3) {
                let overlap = 0;
                for (const w of theirWordsArr) if (mySet.has(w)) overlap++;
                if (overlap / theirWordsArr.length >= 0.5) return true;
                // 3+ consecutive words match → echo
                for (let i = 0; i <= theirWordsArr.length - 3; i++) {
                    const phrase = theirWordsArr.slice(i, i + 3).join(' ');
                    if (norm.includes(phrase)) return true;
                }
            }
        }

        // AGGRESSIVE: if system audio has been actively producing transcripts
        // recently AND this mic line has 3+ words AND >40% match any single
        // their-final's words, drop. The user is clearly listening through
        // speakers and any mic content is suspicious.
        if (this._systemAudioRecentlyActive() && myWords.length >= 3) {
            for (const entry of this._recentTheirFinals) {
                const matches = myWords.filter(w => entry.words.has(w)).length;
                if (matches / myWords.length >= 0.4) return true;
            }
        }
        return false;
    }

    /**
     * Append a time range when this Speechmatics-diarized speaker spoke.
     * Times are seconds from Speechmatics session start (== our audio stream start).
     */
    _addSpeakerTimeRange(speakerKey, t1, t2) {
        if (!Number.isFinite(t1) || !Number.isFinite(t2) || t2 <= t1) return;
        const ranges = this._speakerTimeRanges.get(speakerKey) || [];
        // Merge with previous range if contiguous (within 0.5s gap)
        const last = ranges[ranges.length - 1];
        if (last && t1 - last.t2 < 0.5) {
            last.t2 = Math.max(last.t2, t2);
        } else {
            ranges.push({ t1, t2 });
        }
        // Drop ranges older than what's still in the buffer
        const bufferStartTime = (this._theirSamplesPushed - this._theirAudioBufBytes / 2) / this._theirAudioSampleRate;
        const kept = ranges.filter(r => r.t2 >= bufferStartTime);
        this._speakerTimeRanges.set(speakerKey, kept);
    }

    /**
     * Get the most recent N seconds of audio for a specific Speechmatics speaker.
     * Returns concatenated PCM containing ONLY their speech (silence-free, per-speaker).
     */
    getAudioForSpeakerKey(speakerKey, maxSec = 30) {
        const ranges = this._speakerTimeRanges.get(speakerKey) || [];
        if (ranges.length === 0) return null;
        const sampleRate = this._theirAudioSampleRate;
        const bufferStartTime = (this._theirSamplesPushed - this._theirAudioBufBytes / 2) / sampleRate;
        // Walk ranges from most recent backwards, accumulating audio up to maxSec
        const fullBuf = Buffer.concat(this._theirAudioBuf, this._theirAudioBufBytes);
        const pieces = [];
        let totalSec = 0;
        for (let i = ranges.length - 1; i >= 0 && totalSec < maxSec; i--) {
            const r = ranges[i];
            if (r.t2 < bufferStartTime) break;
            const t1 = Math.max(r.t1, bufferStartTime);
            const t2 = r.t2;
            const sampleStart = Math.floor((t1 - bufferStartTime) * sampleRate);
            const sampleEnd   = Math.min(Math.floor((t2 - bufferStartTime) * sampleRate), this._theirAudioBufBytes / 2);
            if (sampleEnd <= sampleStart) continue;
            pieces.unshift(fullBuf.slice(sampleStart * 2, sampleEnd * 2));
            totalSec += (sampleEnd - sampleStart) / sampleRate;
        }
        if (pieces.length === 0) return null;
        return Buffer.concat(pieces);
    }

    /**
     * Auto-identify a newly seen diarized speaker. Fires pyannote /identify on
     * a recent audio sample; if it matches an enrolled voiceprint, broadcasts
     * the resolved name to the overlay so the row label updates retroactively.
     */
    async _maybeAutoIdentify(speakerLabel) {
        // Re-identify periodically — Speechmatics' diarization drifts over
        // long sessions, so a label that was Jason early on can become Lon
        // 5 minutes later. Even "locked" matches re-verify every 60s.
        const RETRY_COOLDOWN_MS = 30 * 1000;       // unlocked retry
        const RELOCK_INTERVAL_MS = 60 * 1000;       // re-verify locked matches
        const HIGH_CONFIDENCE = 80;
        const attempts = this._identifyAttempts ||= new Map();
        const last = attempts.get(speakerLabel);
        const sinceLast = last ? Date.now() - last.lastAttemptAt : Infinity;
        if (last?.locked && sinceLast < RELOCK_INTERVAL_MS) {
            _debugLog(`[SttService] _maybeAutoIdentify ${speakerLabel} skip: locked + recent (${(sinceLast/1000).toFixed(1)}s)`);
            return;
        }
        if (!last?.locked && sinceLast < RETRY_COOLDOWN_MS) {
            _debugLog(`[SttService] _maybeAutoIdentify ${speakerLabel} skip: cooldown (${(sinceLast/1000).toFixed(1)}s)`);
            return;
        }
        if (this._identifyInflight?.has(speakerLabel)) {
            _debugLog(`[SttService] _maybeAutoIdentify ${speakerLabel} skip: inflight`);
            return;
        }
        (this._identifyInflight ||= new Set()).add(speakerLabel);

        try {
            const voiceprintService = require('./voiceprintService');
            const vpCount = voiceprintService.listVoiceprints().length;
            if (vpCount === 0) {
                _debugLog(`[SttService] _maybeAutoIdentify ${speakerLabel} skip: NO VOICEPRINTS in DB`);
                return;
            }
            _debugLog(`[SttService] _maybeAutoIdentify ${speakerLabel} START (${vpCount} voiceprints available)`);
            // PROPER FIX: send pyannote ONLY this speaker's audio (sliced from
            // the buffer using Speechmatics' word timestamps). Single-speaker
            // input means no diarization ambiguity — pyannote can't pick the
            // wrong person. Falls back to last-30s only if speaker-sliced audio
            // is too short.
            let pcm = this.getAudioForSpeakerKey(speakerLabel, 30);
            const minBytes = 24000 * 2 * 5; // 5s minimum
            let source = 'speaker-sliced';
            if (!pcm || pcm.length < minBytes) {
                pcm = this.getRecentTheirAudio(30);
                source = 'last-30s-fallback';
                if (!pcm || pcm.length < 24000 * 2 * 10) {
                    this._identifyInflight.delete(speakerLabel);
                    return;
                }
            }
            _debugLog(`[SttService] identify ${speakerLabel} using ${source} (${(pcm.length / (24000*2)).toFixed(1)}s)`);
            const seconds = pcm.length / (24000 * 2);
            const attemptCount = (last?.attemptCount || 0) + 1;
            attempts.set(speakerLabel, { lastAttemptAt: Date.now(), attemptCount, locked: false });
            _debugLog(`[SttService] auto-identify ${speakerLabel} attempt #${attemptCount} (${seconds}s window)`);
            const match = await voiceprintService.identify(pcm, 24000);
            if (match?.name) {
                const isHighConf = match.score >= HIGH_CONFIDENCE;
                const prev = last?.match;
                const sameAsPrev = prev?.name === match.name;
                _debugLog(`[SttService] ✅ voiceprint match: ${speakerLabel} → ${match.name} (score=${match.score})${isHighConf ? ' [LOCKED]' : ' [tentative]'}`);
                attempts.set(speakerLabel, {
                    lastAttemptAt: Date.now(),
                    attemptCount,
                    // Lock high-confidence matches OR matches confirmed twice in a row
                    locked: isHighConf || (sameAsPrev && prev.score >= 60),
                    match: { name: match.name, score: match.score },
                });
                this.sendToRenderer('speaker-identified', {
                    speakerLabel,
                    name: match.name,
                    score: match.score,
                });
            } else {
                _debugLog(`[SttService] no match for ${speakerLabel} on attempt #${attemptCount}; will retry in 30s`);
            }
        } catch (e) {
            _debugLog('[SttService] auto-identify error:', e.message);
        } finally {
            this._identifyInflight?.delete(speakerLabel);
        }
    }

    setCallbacks({ onTranscriptionComplete, onStatusUpdate }) {
        this.onTranscriptionComplete = onTranscriptionComplete;
        this.onStatusUpdate = onStatusUpdate;
    }

    sendToRenderer(channel, data) {
        // Listen 관련 이벤트는 Listen 윈도우에만 전송 (Ask 윈도우 충돌 방지)
        const { windowPool } = require('../../../window/windowManager');
        const listenWindow = windowPool?.get('listen');
        const overlayWindow = windowPool?.get('annotated-overlay');

        if (listenWindow && !listenWindow.isDestroyed()) {
            listenWindow.webContents.send(channel, data);
        }

        // Forward STT transcripts to the annotated overlay (finals trigger FC/Cynic, partials show live text).
        // Also forward speaker-identified events so the overlay can lock the right name to the diarization id.
        if (channel === 'stt-update') {
            _debugLog(`[sttService] stt-update isFinal=${data.isFinal} text="${(data.text||'').slice(0,60)}" overlayExists=${!!overlayWindow} overlayDestroyed=${overlayWindow?.isDestroyed()}`);
            if (overlayWindow && !overlayWindow.isDestroyed()) {
                overlayWindow.webContents.send('stt-update', data);
                _debugLog(`[sttService] ✅ sent to overlay`);
            }
        } else if (channel === 'speaker-identified') {
            _debugLog(`[sttService] speaker-identified ${data.speakerLabel} → ${data.name} → forwarding to overlay`);
            if (overlayWindow && !overlayWindow.isDestroyed()) {
                overlayWindow.webContents.send('speaker-identified', data);
            }
        }
    }

    async handleSendSystemAudioContent(data, mimeType) {
        try {
            await this.sendSystemAudioContent(data, mimeType);
            this.sendToRenderer('system-audio-data', { data });
            return { success: true };
        } catch (error) {
            console.error('Error sending system audio:', error);
            return { success: false, error: error.message };
        }
    }

    flushMyCompletion() {
        const finalText = (this.myCompletionBuffer + this.myCurrentUtterance).trim();
        if (!this.modelInfo || !finalText) return;

        // Echo suppression: if this mic-side text closely matches a recent
        // system-audio final (within ~4s), drop it — the speaker is just
        // hearing the system audio bleed back into the mic. Otherwise emit
        // normally so Jason/Lon see their own transcripts.
        if (this._isEchoOfTheirAudio(finalText)) {
            _debugLog(`[SttService] dropped mic echo: "${finalText.slice(0, 60)}"`);
            this.myCompletionBuffer = '';
            this.myCompletionTimer = null;
            this.myCurrentUtterance = '';
            return;
        }

        // Apply name corrections (Calacanis vs Kalakanis, etc.)
        const correctedText = this._correctNames(finalText);

        // Notify completion callback
        if (this.onTranscriptionComplete) {
            this.onTranscriptionComplete('Me', correctedText);
        }

        // Send to renderer as final
        this.sendToRenderer('stt-update', {
            speaker: 'Me',
            text: correctedText,
            isPartial: false,
            isFinal: true,
            timestamp: Date.now(),
        });

        this.myCompletionBuffer = '';
        this.myCompletionTimer = null;
        this.myCurrentUtterance = '';
        
        if (this.onStatusUpdate) {
            this.onStatusUpdate('Listening...');
        }
    }

    flushTheirCompletion() {
        const finalText = (this.theirCompletionBuffer + this.theirCurrentUtterance).trim();
        if (!this.modelInfo || !finalText) return;
        
        // Notify completion callback
        if (this.onTranscriptionComplete) {
            this.onTranscriptionComplete('Them', finalText);
        }
        
        // Send to renderer as final (deduped)
        this._emitTheirFinal({
            speaker: 'Them',
            text: finalText,
            isPartial: false,
            isFinal: true,
            timestamp: Date.now(),
        });

        this.theirCompletionBuffer = '';
        this.theirCompletionTimer = null;
        this.theirCurrentUtterance = '';
        
        if (this.onStatusUpdate) {
            this.onStatusUpdate('Listening...');
        }
    }

    debounceMyCompletion(text) {
        if (this.modelInfo?.provider === 'gemini') {
            this.myCompletionBuffer += text;
        } else {
            this.myCompletionBuffer += (this.myCompletionBuffer ? ' ' : '') + text;
        }

        if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
        this.myCompletionTimer = setTimeout(() => this.flushMyCompletion(), COMPLETION_DEBOUNCE_MS);
    }

    debounceTheirCompletion(text) {
        if (this.modelInfo?.provider === 'gemini') {
            this.theirCompletionBuffer += text;
        } else {
            this.theirCompletionBuffer += (this.theirCompletionBuffer ? ' ' : '') + text;
        }

        if (this.theirCompletionTimer) clearTimeout(this.theirCompletionTimer);
        this.theirCompletionTimer = setTimeout(() => this.flushTheirCompletion(), COMPLETION_DEBOUNCE_MS);
    }

    async initializeSttSessions(language = 'en') {
        // Reset the intentional-close flag from any previous closeSessions().
        // A fresh init means the user wants to listen again — auto-reconnect
        // on abnormal closes should resume normally.
        this._intentionalClose = false;
        const effectiveLanguage = process.env.OPENAI_TRANSCRIBE_LANG || language || 'en';

        const modelInfo = await modelStateService.getCurrentModelInfo('stt');
        if (!modelInfo || !modelInfo.apiKey) {
            throw new Error('AI model or API key is not configured.');
        }
        this.modelInfo = modelInfo;
        console.log(`[SttService] Initializing STT for ${modelInfo.provider} using model ${modelInfo.model}`);

        const handleMyMessage = message => {
            if (!this.modelInfo) {
                console.log('[SttService] Ignoring message - session already closed');
                return;
            }
            // console.log('[SttService] handleMyMessage', message);
            
            if (this.modelInfo.provider === 'whisper') {
                // Whisper STT emits 'transcription' events with different structure
                if (message.text && message.text.trim()) {
                    const finalText = message.text.trim();
                    
                    // Filter out Whisper noise transcriptions
                    const noisePatterns = [
                        '[BLANK_AUDIO]',
                        '[INAUDIBLE]',
                        '[MUSIC]',
                        '[SOUND]',
                        '[NOISE]',
                        '(BLANK_AUDIO)',
                        '(INAUDIBLE)',
                        '(MUSIC)',
                        '(SOUND)',
                        '(NOISE)'
                    ];
                    
                    const isNoise = noisePatterns.some(pattern => 
                        finalText.includes(pattern) || finalText === pattern
                    );
                    
                    
                    if (!isNoise && finalText.length > 2) {
                        this.debounceMyCompletion(finalText);
                        
                        this.sendToRenderer('stt-update', {
                            speaker: 'Me',
                            text: finalText,
                            isPartial: false,
                            isFinal: true,
                            timestamp: Date.now(),
                        });
                    } else {
                        console.log(`[Whisper-Me] Filtered noise: "${finalText}"`);
                    }
                }
                return;
            } else if (this.modelInfo.provider === 'gemini') {
                if (!message.serverContent?.modelTurn) {
                    console.log('[Gemini STT - Me]', JSON.stringify(message, null, 2));
                }

                if (message.serverContent?.turnComplete) {
                    if (this.myCompletionTimer) {
                        clearTimeout(this.myCompletionTimer);
                        this.flushMyCompletion();
                    }
                    return;
                }
            
                const transcription = message.serverContent?.inputTranscription;
                if (!transcription || !transcription.text) return;
                
                const textChunk = transcription.text;
                if (!textChunk.trim() || textChunk.trim() === '<noise>') {
                    return; // 1. Ignore whitespace-only chunks or noise
                }
            
                this.debounceMyCompletion(textChunk);
                
                this.sendToRenderer('stt-update', {
                    speaker: 'Me',
                    text: this.myCompletionBuffer,
                    isPartial: true,
                    isFinal: false,
                    timestamp: Date.now(),
                });
                
            // Deepgram
            } else if (this.modelInfo.provider === 'deepgram') {
                const text = message.channel?.alternatives?.[0]?.transcript;
                if (!text || text.trim().length === 0) return;

                const isFinal = message.is_final;
                console.log(`[SttService-Me-Deepgram] Received: isFinal=${isFinal}, text="${text}"`);

                if (isFinal) {
                    this.myCurrentUtterance = '';
                    this.debounceMyCompletion(text);
                } else {
                    if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
                    this.myCompletionTimer = null;

                    this.myCurrentUtterance = text;

                    const continuousText = (this.myCompletionBuffer + ' ' + this.myCurrentUtterance).trim();

                    this.sendToRenderer('stt-update', {
                        speaker: 'Me',
                        text: continuousText,
                        isPartial: true,
                        isFinal: false,
                        timestamp: Date.now(),
                    });
                }

            // Speechmatics
            } else if (this.modelInfo.provider === 'speechmatics') {
                const { resultsToText } = require('../../common/ai/providers/speechmatics');
                const msgType = message.message;
                if (msgType === 'AddPartialTranscript') {
                    const text = resultsToText(message.results);
                    if (!text) return;
                    // Do NOT clear myCompletionTimer here — that kills the final flush
                    this.myCurrentUtterance = text;
                    const continuousText = (this.myCompletionBuffer + ' ' + text).trim();
                    this.sendToRenderer('stt-update', {
                        speaker: 'Me',
                        text: continuousText,
                        isPartial: true,
                        isFinal: false,
                        timestamp: Date.now(),
                    });
                } else if (msgType === 'AddTranscript') {
                    const text = resultsToText(message.results);
                    if (!text) return;
                    if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
                    this.myCompletionTimer = null;
                    this.myCurrentUtterance = '';
                    this.myCompletionBuffer = '';
                    // Echo suppression: skip if this looks like the user
                    // listening to system audio bleeding through their mic.
                    if (this._isEchoOfTheirAudio(text)) {
                        _debugLog(`[SttService] dropped mic echo (Speechmatics): "${text.slice(0, 60)}"`);
                        return;
                    }
                    const correctedText = this._correctNames(text);
                    if (this.onTranscriptionComplete) this.onTranscriptionComplete('Me', correctedText);
                    this.sendToRenderer('stt-update', {
                        speaker: 'Me',
                        text: correctedText,
                        isPartial: false,
                        isFinal: true,
                        timestamp: Date.now(),
                    });
                    // TODO: voice-identify mic audio against enrolled voiceprints
                    // requires a separate mic ring buffer (currently only the
                    // system-audio buffer is tracked). Until that lands, the
                    // mic speaker stays as "Speaker 1" — user can rename via
                    // the inline edit affordance on the speaker header.
                }
                // Ignore RecognitionStarted, EndOfTranscript, etc.

            } else {
                const type = message.type;
                const text = message.transcript || message.delta || (message.alternatives && message.alternatives[0]?.transcript) || '';

                if (type === 'conversation.item.input_audio_transcription.delta') {
                    if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
                    this.myCompletionTimer = null;
                    this.myCurrentUtterance += text;
                    const continuousText = this.myCompletionBuffer + (this.myCompletionBuffer ? ' ' : '') + this.myCurrentUtterance;
                    if (text && !text.includes('vq_lbr_audio_')) {
                        this.sendToRenderer('stt-update', {
                            speaker: 'Me',
                            text: continuousText,
                            isPartial: true,
                            isFinal: false,
                            timestamp: Date.now(),
                        });
                    }
                } else if (type === 'conversation.item.input_audio_transcription.completed') {
                    if (text && text.trim()) {
                        const finalUtteranceText = text.trim();
                        this.myCurrentUtterance = '';
                        this.debounceMyCompletion(finalUtteranceText);
                    }
                }
            }

            if (message.error) {
                console.error('[Me] STT Session Error:', message.error);
            }
        };

        const handleTheirMessage = message => {
            if (!message || typeof message !== 'object') return;

            if (!this.modelInfo) {
                console.log('[SttService] Ignoring message - session already closed');
                return;
            }
            
            if (this.modelInfo.provider === 'whisper') {
                // Whisper STT emits 'transcription' events with different structure
                if (message.text && message.text.trim()) {
                    const finalText = message.text.trim();
                    
                    // Filter out Whisper noise transcriptions
                    const noisePatterns = [
                        '[BLANK_AUDIO]',
                        '[INAUDIBLE]',
                        '[MUSIC]',
                        '[SOUND]',
                        '[NOISE]',
                        '(BLANK_AUDIO)',
                        '(INAUDIBLE)',
                        '(MUSIC)',
                        '(SOUND)',
                        '(NOISE)'
                    ];
                    
                    const isNoise = noisePatterns.some(pattern => 
                        finalText.includes(pattern) || finalText === pattern
                    );
                    
                    
                    // Only process if it's not noise, not a false positive, and has meaningful content
                    if (!isNoise && finalText.length > 2) {
                        this.debounceTheirCompletion(finalText);

                        this._emitTheirFinal({
                            speaker: 'Them',
                            text: finalText,
                            isPartial: false,
                            isFinal: true,
                            timestamp: Date.now(),
                        });
                    } else {
                        console.log(`[Whisper-Them] Filtered noise: "${finalText}"`);
                    }
                }
                return;
            } else if (this.modelInfo.provider === 'gemini') {
                if (!message.serverContent?.modelTurn) {
                    console.log('[Gemini STT - Them]', JSON.stringify(message, null, 2));
                }

                if (message.serverContent?.turnComplete) {
                    if (this.theirCompletionTimer) {
                        clearTimeout(this.theirCompletionTimer);
                        this.flushTheirCompletion();
                    }
                    return;
                }
            
                const transcription = message.serverContent?.inputTranscription;
                if (!transcription || !transcription.text) return;

                const textChunk = transcription.text;
                if (!textChunk.trim() || textChunk.trim() === '<noise>') {
                    return; // 1. Ignore whitespace-only chunks or noise
                }

                this.debounceTheirCompletion(textChunk);
                
                this.sendToRenderer('stt-update', {
                    speaker: 'Them',
                    text: this.theirCompletionBuffer,
                    isPartial: true,
                    isFinal: false,
                    timestamp: Date.now(),
                });

            // Deepgram
            } else if (this.modelInfo.provider === 'deepgram') {
                const text = message.channel?.alternatives?.[0]?.transcript;
                if (!text || text.trim().length === 0) return;

                const isFinal = message.is_final;
                const words   = message.channel?.alternatives?.[0]?.words ?? [];

                if (isFinal) {
                    this.theirCurrentUtterance = '';
                    // Diarization: split the final by speaker if present
                    const { wordsToSpeakerSegments } = require('../../common/ai/providers/deepgram');
                    const segments = words.length > 0 ? wordsToSpeakerSegments(words) : [{ speaker: 'S0', text }];
                    for (const seg of segments) {
                        if (!seg.text) continue;
                        const label = `Them:${seg.speaker}`;
                        if (this.onTranscriptionComplete) this.onTranscriptionComplete(label, seg.text);
                        this._recordTheirFinal(seg.text); // for echo suppression on mic
                        this._emitTheirFinal({
                            speaker: label,
                            text: seg.text,
                            isPartial: false,
                            isFinal: true,
                            timestamp: Date.now(),
                        });
                        // First final from this diarized speaker → fire pyannote identify
                        this._maybeAutoIdentify(label);
                    }
                    // Keep the legacy buffer accumulator working for the renderer "Them" path
                    this.debounceTheirCompletion(text);
                } else {
                    if (this.theirCompletionTimer) clearTimeout(this.theirCompletionTimer);
                    this.theirCompletionTimer = null;

                    this.theirCurrentUtterance = text;

                    const continuousText = (this.theirCompletionBuffer + ' ' + this.theirCurrentUtterance).trim();

                    // Interim — emit a generic "Them" so the live cursor renders without
                    // flickering between speaker labels mid-utterance.
                    this.sendToRenderer('stt-update', {
                        speaker: 'Them',
                        text: continuousText,
                        isPartial: true,
                        isFinal: false,
                        timestamp: Date.now(),
                    });
                }

            // Speechmatics
            } else if (this.modelInfo.provider === 'speechmatics') {
                const { resultsToText, resultsToSpeakerSegments } = require('../../common/ai/providers/speechmatics');
                const msgType = message.message;
                if (msgType === 'AddPartialTranscript') {
                    const text = resultsToText(message.results);
                    if (!text) return;
                    // Interim — single 'Them' label to avoid mid-utterance flicker.
                    this.theirCurrentUtterance = text;
                    const continuousText = (this.theirCompletionBuffer + ' ' + text).trim();
                    this.sendToRenderer('stt-update', {
                        speaker: 'Them',
                        text: continuousText,
                        isPartial: true,
                        isFinal: false,
                        timestamp: Date.now(),
                    });
                } else if (msgType === 'AddTranscript') {
                    // Final — split by diarization speaker so multi-speaker
                    // system audio (e.g. a YouTube interview) shows each
                    // speaker in their own row.
                    const segments = resultsToSpeakerSegments(message.results);
                    if (!segments.length) return;
                    if (this.theirCompletionTimer) clearTimeout(this.theirCompletionTimer);
                    this.theirCompletionTimer = null;
                    this.theirCurrentUtterance = '';
                    this.theirCompletionBuffer = '';

                    // Record per-speaker word time ranges so we can later slice
                    // ONLY this speaker's audio for pyannote identify.
                    for (const r of (message.results || [])) {
                        const sp = r.alternatives?.[0]?.speaker;
                        if (!sp) continue;
                        const t1 = Number(r.start_time);
                        const t2 = Number(r.end_time);
                        this._addSpeakerTimeRange(`Them:${sp}`, t1, t2);
                    }

                    for (const seg of segments) {
                        if (!seg.text) continue;
                        const label = `Them:${seg.speaker}`;
                        if (this.onTranscriptionComplete) this.onTranscriptionComplete(label, seg.text);
                        this._recordTheirFinal(seg.text); // for echo suppression on mic
                        this._emitTheirFinal({
                            speaker: label,
                            text: seg.text,
                            isPartial: false,
                            isFinal: true,
                            timestamp: Date.now(),
                        });
                        this._maybeAutoIdentify(label);
                    }
                }

            } else {
                const type = message.type;
                const text = message.transcript || message.delta || (message.alternatives && message.alternatives[0]?.transcript) || '';
                if (type === 'conversation.item.input_audio_transcription.delta') {
                    if (this.theirCompletionTimer) clearTimeout(this.theirCompletionTimer);
                    this.theirCompletionTimer = null;
                    this.theirCurrentUtterance += text;
                    const continuousText = this.theirCompletionBuffer + (this.theirCompletionBuffer ? ' ' : '') + this.theirCurrentUtterance;
                    if (text && !text.includes('vq_lbr_audio_')) {
                        this.sendToRenderer('stt-update', {
                            speaker: 'Them',
                            text: continuousText,
                            isPartial: true,
                            isFinal: false,
                            timestamp: Date.now(),
                        });
                    }
                } else if (type === 'conversation.item.input_audio_transcription.completed') {
                    if (text && text.trim()) {
                        const finalUtteranceText = text.trim();
                        this.theirCurrentUtterance = '';
                        this.debounceTheirCompletion(finalUtteranceText);
                    }
                }
            }
            
            if (message.error) {
                console.error('[Them] STT Session Error:', message.error);
            }
        };

        // Store handlers so _tryFallbackToDeepgram can reuse them
        this._handleMyMessage = handleMyMessage;
        this._handleTheirMessage = handleTheirMessage;
        this._sessionLanguage = effectiveLanguage;

        const mySttConfig = {
            language: effectiveLanguage,
            callbacks: {
                onmessage: handleMyMessage,
                onerror: error => { _debugLog('[SttService] My STT session ERROR:', error.message); },
                onclose: event => {
                    _debugLog('[SttService] My STT session CLOSED code=' + event.code + ' reason=' + event.reason);
                    // 1000 = clean close (we asked it to stop). Anything else,
                    // try to reconnect transparently before giving up. Speechmatics
                    // free tier emits 4006 'timelimit_exceeded' every 30 min;
                    // reconnect resumes the session without losing audio.
                    //
                    // ALSO: when the user explicitly clicked STOP, closeSessions()
                    // sets `_intentionalClose = true`. Skip reconnect in that case
                    // so the manual stop sticks — some providers emit a non-1000
                    // code on intentional close (e.g. Speechmatics sends 1011 if
                    // the EndOfStream message hadn't been ack'd yet).
                    if (this._intentionalClose) {
                        _debugLog('[SttService] My STT close skipped reconnect — intentional stop');
                        return;
                    }
                    if (event.code !== 1000) this._tryReconnect('me', event.code, event.reason);
                },
            },
        };

        const theirSttConfig = {
            language: effectiveLanguage,
            callbacks: {
                onmessage: handleTheirMessage,
                onerror: error => { _debugLog('[SttService] Their STT session ERROR:', error.message); },
                onclose: event => {
                    _debugLog('[SttService] Their STT session CLOSED code=' + event.code + ' reason=' + event.reason);
                    if (this._intentionalClose) {
                        _debugLog('[SttService] Their STT close skipped reconnect — intentional stop');
                        return;
                    }
                    if (event.code !== 1000) this._tryReconnect('them', event.code, event.reason);
                },
            },
        };
        
        const sttOptions = {
            apiKey: this.modelInfo.apiKey,
            model: this.modelInfo.model,
            language: effectiveLanguage,
            sampleRate: 24000,
            usePortkey: this.modelInfo.provider === 'openai-glass',
            portkeyVirtualKey: this.modelInfo.provider === 'openai-glass' ? this.modelInfo.apiKey : undefined,
        };

        // Add sessionType for Whisper to distinguish between My and Their sessions
        const myOptions = { ...sttOptions, callbacks: mySttConfig.callbacks, sessionType: 'my' };
        const theirOptions = { ...sttOptions, callbacks: theirSttConfig.callbacks, sessionType: 'their' };

        [this.mySttSession, this.theirSttSession] = await Promise.all([
            createSTT(this.modelInfo.provider, myOptions),
            createSTT(this.modelInfo.provider, theirOptions),
        ]);

        console.log('✅ Both STT sessions initialized successfully.');

        // ── Setup keep-alive heart-beats ────────────────────────────────────────
        if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = setInterval(() => {
            this._sendKeepAlive();
        }, KEEP_ALIVE_INTERVAL_MS);

        // ── Schedule session auto-renewal ───────────────────────────────────────
        if (this.sessionRenewTimeout) clearTimeout(this.sessionRenewTimeout);
        this.sessionRenewTimeout = setTimeout(async () => {
            try {
                console.log('[SttService] Auto-renewing STT sessions…');
                await this.renewSessions(language);
            } catch (err) {
                console.error('[SttService] Failed to renew STT sessions:', err);
            }
        }, SESSION_RENEW_INTERVAL_MS);

        return true;
    }

    /**
     * Send a lightweight keep-alive to prevent idle disconnects.
     * Currently only implemented for OpenAI provider because Gemini's SDK
     * already performs its own heart-beats.
     */
    _sendKeepAlive() {
        if (!this.isSessionActive()) return;

        if (this.modelInfo?.provider === 'openai') {
            try {
                this.mySttSession?.keepAlive?.();
                this.theirSttSession?.keepAlive?.();
            } catch (err) {
                console.error('[SttService] keepAlive error:', err.message);
            }
        }
    }

    /**
     * Falls back to Deepgram Nova 3 when the primary STT session closes abnormally.
     * Guards against double-invocation when both My and Their sessions close together.
     */
    /**
     * Auto-reconnect a closed STT side (mic 'me' or system 'them'). Same
     * provider, same config — Speechmatics' 30-minute session limit is the
     * primary trigger. Exponential backoff capped at 8s; gives up after 5
     * tries and falls back to Deepgram. Idempotent per side.
     */
    async _tryReconnect(side, code, reason) {
        const flagKey = side === 'me' ? '_reconnectingMe' : '_reconnectingThem';
        if (this[flagKey]) return;

        // Speechmatics 4006 'timelimit_exceeded' means the ACCOUNT is throttled
        // OR the session hit its 30-min window. Either way, retrying gives
        // another instant 4006. Fail over to Deepgram for the rest of this
        // session immediately — don't waste cycles or block transcription.
        if (code === 4006 && this.modelInfo?.provider === 'speechmatics') {
            _debugLog(`[SttService] ${side} hit Speechmatics 4006 — failing over to Deepgram immediately`);
            this._tryFallbackToDeepgram();
            return;
        }
        const lastReconnectAtKey = side === 'me' ? '_meLastReconnectAt' : '_themLastReconnectAt';

        this[flagKey] = true;
        this[lastReconnectAtKey] = Date.now();
        const attempts = (this[`${flagKey}Attempts`] || 0) + 1;
        this[`${flagKey}Attempts`] = attempts;
        const backoff = Math.min(500 * Math.pow(2, attempts - 1), 8000);
        _debugLog(`[SttService] reconnect ${side} attempt #${attempts} in ${backoff}ms (close ${code} ${reason})`);
        await new Promise(r => setTimeout(r, backoff));

        try {
            const lang = this._sessionLanguage || 'en';
            const sessionKey = side === 'me' ? 'mySttSession' : 'theirSttSession';
            try { this[sessionKey]?.close?.(); } catch (_) {}
            this[sessionKey] = null;

            // Always reconnect with a known-good STT provider. If the current
            // provider is gemini (whose live STT model is unreliable) or any
            // other broken state, force Speechmatics — the only reliable
            // realtime STT for our use case. If Speechmatics key is missing,
            // fall through to Deepgram nova-3.
            let provider = this.modelInfo?.provider;
            let model = this.modelInfo?.model;
            let apiKey = this.modelInfo?.apiKey;
            if (provider === 'gemini' || !provider || !apiKey) {
                if (process.env.SPEECHMATICS_API_KEY) {
                    provider = 'speechmatics';
                    model = 'speechmatics-enhanced';
                    apiKey = process.env.SPEECHMATICS_API_KEY;
                } else if (process.env.DEEPGRAM_API_KEY) {
                    provider = 'deepgram';
                    model = 'nova-3';
                    apiKey = process.env.DEEPGRAM_API_KEY;
                }
                this.modelInfo = { provider, model, apiKey };
                _debugLog(`[SttService] reconnect resetting modelInfo to ${provider}/${model}`);
            }

            const handler = side === 'me' ? this._handleMyMessage : this._handleTheirMessage;
            const sttOptions = {
                apiKey,
                model,
                language: lang,
                sampleRate: 24000,
                callbacks: {
                    onmessage: handler,
                    onerror: e => _debugLog(`[SttService] ${side} reconnected ERROR:`, e?.message),
                    onclose: e => {
                        _debugLog(`[SttService] ${side} reconnected CLOSED code=${e.code} reason=${e.reason}`);
                        if (e.code !== 1000) this._tryReconnect(side, e.code, e.reason);
                    },
                },
            };
            this[sessionKey] = await createSTT(provider, sttOptions);
            _debugLog(`[SttService] ✅ ${side} reconnected (${provider})`);
            this[`${flagKey}Attempts`] = 0; // reset on success
        } catch (err) {
            _debugLog(`[SttService] ${side} reconnect failed:`, err?.message);
            if (attempts >= 5) {
                _debugLog(`[SttService] ${side} reconnect giving up after 5 tries — falling back to Deepgram`);
                this._tryFallbackToDeepgram();
            } else {
                // Schedule next attempt
                this[flagKey] = false;
                this._tryReconnect(side, code, reason);
                return;
            }
        } finally {
            this[flagKey] = false;
        }
    }

    async _tryFallbackToDeepgram() {
        if (this._fallbackActive) return;
        if (this.modelInfo?.provider === 'deepgram') return; // already on deepgram
        this._fallbackActive = true;

        try {
            // Try DB-stored key first, then fall through to env (always available
            // because we bundle .env in the installer).
            const providerSettingsRepository = require('../../common/repositories/providerSettings');
            let deepgramKey = null;
            try {
                const setting = await providerSettingsRepository.getByProvider('deepgram');
                deepgramKey = setting?.api_key || null;
            } catch (_) {}
            if (!deepgramKey) deepgramKey = process.env.DEEPGRAM_API_KEY || null;
            if (!deepgramKey) {
                _debugLog('[SttService] Fallback skipped — no Deepgram API key configured');
                return;
            }

            _debugLog('[SttService] Primary STT closed abnormally — falling back to Deepgram nova-3');
            this.sendToRenderer('stt-status', { message: 'Switched to Deepgram (fallback)' });

            // Tear down dead sessions
            try { this.mySttSession?.close?.(); } catch (_) {}
            try { this.theirSttSession?.close?.(); } catch (_) {}
            this.mySttSession = null;
            this.theirSttSession = null;

            // Swap model info
            this.modelInfo = { provider: 'deepgram', model: 'nova-3', apiKey: deepgramKey };

            const lang = this._sessionLanguage;
            const fallbackOptions = {
                apiKey: deepgramKey,
                model: 'nova-3',
                language: lang,
                sampleRate: 24000,
            };

            [this.mySttSession, this.theirSttSession] = await Promise.all([
                createSTT('deepgram', { ...fallbackOptions, callbacks: { onmessage: this._handleMyMessage, onerror: e => _debugLog('[SttService] Fallback-My ERROR:', e.message), onclose: e => _debugLog('[SttService] Fallback-My CLOSED:', e.code, e.reason) } }),
                createSTT('deepgram', { ...fallbackOptions, callbacks: { onmessage: this._handleTheirMessage, onerror: e => _debugLog('[SttService] Fallback-Them ERROR:', e.message), onclose: e => _debugLog('[SttService] Fallback-Them CLOSED:', e.code, e.reason) } }),
            ]);

            _debugLog('[SttService] ✅ Fallback to Deepgram nova-3 succeeded');
        } catch (err) {
            _debugLog('[SttService] Fallback to Deepgram failed:', err.message);
        } finally {
            this._fallbackActive = false;
        }
    }

    /**
     * Gracefully tears down then recreates the STT sessions. Should be invoked
     * on a timer to avoid provider-side hard timeouts.
     */
    async renewSessions(language = 'en') {
        if (!this.isSessionActive()) {
            console.warn('[SttService] renewSessions called but no active session.');
            return;
        }

        const oldMySession = this.mySttSession;
        const oldTheirSession = this.theirSttSession;

        console.log('[SttService] Spawning fresh STT sessions in the background…');

        // We reuse initializeSttSessions to create fresh sessions with the same
        // language and handlers. The method will update the session pointers
        // and timers, but crucially it does NOT touch the system audio capture
        // pipeline, so audio continues flowing uninterrupted.
        await this.initializeSttSessions(language);

        // Close the old sessions after a short overlap window.
        setTimeout(() => {
            try {
                oldMySession?.close?.();
                oldTheirSession?.close?.();
                console.log('[SttService] Old STT sessions closed after hand-off.');
            } catch (err) {
                console.error('[SttService] Error closing old STT sessions:', err.message);
            }
        }, SOCKET_OVERLAP_MS);
    }

    async sendMicAudioContent(data, mimeType) {
        if (!this.mySttSession) {
            throw new Error('User STT session not active');
        }

        let modelInfo = this.modelInfo;
        if (!modelInfo) {
            console.warn('[SttService] modelInfo not found, fetching on-the-fly as a fallback...');
            modelInfo = await modelStateService.getCurrentModelInfo('stt');
        }
        if (!modelInfo) {
            throw new Error('STT model info could not be retrieved.');
        }

        let payload;
        if (modelInfo.provider === 'gemini') {
            payload = { audio: { data, mimeType: mimeType || 'audio/pcm;rate=24000' } };
        } else if (modelInfo.provider === 'deepgram' || modelInfo.provider === 'speechmatics') {
            payload = Buffer.from(data, 'base64');
        } else {
            payload = data;
        }
        await this.mySttSession.sendRealtimeInput(payload);
    }

    async sendSystemAudioContent(data, mimeType) {
        if (!this.theirSttSession) {
            throw new Error('Their STT session not active');
        }

        let modelInfo = this.modelInfo;
        if (!modelInfo) {
            console.warn('[SttService] modelInfo not found, fetching on-the-fly as a fallback...');
            modelInfo = await modelStateService.getCurrentModelInfo('stt');
        }
        if (!modelInfo) {
            throw new Error('STT model info could not be retrieved.');
        }

        let payload;
        if (modelInfo.provider === 'gemini') {
            payload = { audio: { data, mimeType: mimeType || 'audio/pcm;rate=24000' } };
        } else if (modelInfo.provider === 'deepgram' || modelInfo.provider === 'speechmatics') {
            payload = Buffer.from(data, 'base64');
        } else {
            payload = data;
        }

        // Buffer system-audio PCM for voice biometrics (pyannote enroll/identify).
        // Tracks cumulative sample count so we can map Speechmatics word
        // timestamps to byte offsets in the ring buffer.
        if (Buffer.isBuffer(payload)) {
            this._theirSamplesPushed += payload.length / 2;
            this._theirAudioBuf.push(payload);
            this._theirAudioBufBytes += payload.length;
            while (this._theirAudioBufBytes > this._theirAudioMaxBytes && this._theirAudioBuf.length > 1) {
                const drop = this._theirAudioBuf.shift();
                this._theirAudioBufBytes -= drop.length;
            }
        }

        await this.theirSttSession.sendRealtimeInput(payload);
    }

    /**
     * Get the most recent N seconds of buffered system-audio PCM.
     * Used by voiceprint enrollment/identification.
     */
    getRecentTheirAudio(seconds = 8) {
        const need = this._theirAudioSampleRate * 2 * seconds;
        const concat = Buffer.concat(this._theirAudioBuf, this._theirAudioBufBytes);
        if (concat.length <= need) return concat;
        return concat.slice(concat.length - need);
    }

    killExistingSystemAudioDump() {
        return new Promise(resolve => {
            console.log('Checking for existing SystemAudioDump processes...');

            const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], {
                stdio: 'ignore',
            });

            killProc.on('close', code => {
                if (code === 0) {
                    console.log('Killed existing SystemAudioDump processes');
                } else {
                    console.log('No existing SystemAudioDump processes found');
                }
                resolve();
            });

            killProc.on('error', err => {
                console.log('Error checking for existing processes (this is normal):', err.message);
                resolve();
            });

            setTimeout(() => {
                killProc.kill();
                resolve();
            }, 2000);
        });
    }

    async startMacOSAudioCapture() {
        if (process.platform !== 'darwin' || !this.theirSttSession) return false;

        await this.killExistingSystemAudioDump();
        console.log('Starting macOS audio capture for "Them"...');

        const { app } = require('electron');
        const path = require('path');
        const systemAudioPath = app.isPackaged
            ? path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'ui', 'assets', 'SystemAudioDump')
            : path.join(app.getAppPath(), 'src', 'ui', 'assets', 'SystemAudioDump');

        console.log('SystemAudioDump path:', systemAudioPath);

        this.systemAudioProc = spawn(systemAudioPath, [], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        if (!this.systemAudioProc.pid) {
            console.error('Failed to start SystemAudioDump');
            return false;
        }

        console.log('SystemAudioDump started with PID:', this.systemAudioProc.pid);

        const CHUNK_DURATION = 0.1;
        const SAMPLE_RATE = 24000;
        const BYTES_PER_SAMPLE = 2;
        const CHANNELS = 2;
        const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

        let audioBuffer = Buffer.alloc(0);

        // const provider = await this.getAiProvider();
        // const isGemini = provider === 'gemini';

        let modelInfo = this.modelInfo;
        if (!modelInfo) {
            console.warn('[SttService] modelInfo not found, fetching on-the-fly as a fallback...');
            modelInfo = await modelStateService.getCurrentModelInfo('stt');
        }
        if (!modelInfo) {
            throw new Error('STT model info could not be retrieved.');
        }

        this.systemAudioProc.stdout.on('data', async data => {
            audioBuffer = Buffer.concat([audioBuffer, data]);

            while (audioBuffer.length >= CHUNK_SIZE) {
                const chunk = audioBuffer.slice(0, CHUNK_SIZE);
                audioBuffer = audioBuffer.slice(CHUNK_SIZE);

                const monoChunk = CHANNELS === 2 ? this.convertStereoToMono(chunk) : chunk;
                const base64Data = monoChunk.toString('base64');

                this.sendToRenderer('system-audio-data', { data: base64Data });

                if (this.theirSttSession) {
                    try {
                        let payload;
                        if (modelInfo.provider === 'gemini') {
                            payload = { audio: { data: base64Data, mimeType: 'audio/pcm;rate=24000' } };
                        } else if (modelInfo.provider === 'deepgram' || modelInfo.provider === 'speechmatics') {
                            payload = Buffer.from(base64Data, 'base64');
                        } else {
                            payload = base64Data;
                        }

                        await this.theirSttSession.sendRealtimeInput(payload);
                    } catch (err) {
                        console.error('Error sending system audio:', err.message);
                    }
                }
            }
        });

        this.systemAudioProc.stderr.on('data', data => {
            console.error('SystemAudioDump stderr:', data.toString());
        });

        this.systemAudioProc.on('close', code => {
            console.log('SystemAudioDump process closed with code:', code);
            this.systemAudioProc = null;
        });

        this.systemAudioProc.on('error', err => {
            console.error('SystemAudioDump process error:', err);
            this.systemAudioProc = null;
        });

        return true;
    }

    convertStereoToMono(stereoBuffer) {
        const samples = stereoBuffer.length / 4;
        const monoBuffer = Buffer.alloc(samples * 2);

        for (let i = 0; i < samples; i++) {
            const leftSample = stereoBuffer.readInt16LE(i * 4);
            monoBuffer.writeInt16LE(leftSample, i * 2);
        }

        return monoBuffer;
    }

    stopMacOSAudioCapture() {
        if (this.systemAudioProc) {
            console.log('Stopping SystemAudioDump...');
            this.systemAudioProc.kill('SIGTERM');
            this.systemAudioProc = null;
        }
    }

    isSessionActive() {
        return !!this.mySttSession && !!this.theirSttSession;
    }

    async closeSessions() {
        // Flag so close handlers in createSttSessions skip auto-reconnect.
        // User clicked STOP — they want the session to stay stopped, no
        // matter what close-code the WS server sends back. Cleared on next
        // successful initStt.
        this._intentionalClose = true;
        this.stopMacOSAudioCapture();

        // Clear heartbeat / renewal timers
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
        if (this.sessionRenewTimeout) {
            clearTimeout(this.sessionRenewTimeout);
            this.sessionRenewTimeout = null;
        }

        // Clear timers
        if (this.myCompletionTimer) {
            clearTimeout(this.myCompletionTimer);
            this.myCompletionTimer = null;
        }
        if (this.theirCompletionTimer) {
            clearTimeout(this.theirCompletionTimer);
            this.theirCompletionTimer = null;
        }

        const closePromises = [];
        if (this.mySttSession) {
            closePromises.push(this.mySttSession.close());
            this.mySttSession = null;
        }
        if (this.theirSttSession) {
            closePromises.push(this.theirSttSession.close());
            this.theirSttSession = null;
        }

        await Promise.all(closePromises);
        console.log('All STT sessions closed.');

        // Reset state
        this.myCurrentUtterance = '';
        this.theirCurrentUtterance = '';
        this.myCompletionBuffer = '';
        this.theirCompletionBuffer = '';
        this.modelInfo = null; 
    }
}

module.exports = SttService; 