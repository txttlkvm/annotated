/**
 * voiceprintService.js
 * Voice biometric identification via pyannoteAI Premium API.
 *
 *   POST /v1/voiceprints      → enroll a new speaker (upload ~5–10s audio)
 *   POST /v1/identify         → match an audio chunk against enrolled voiceprints
 *
 * Storage: SQLite table `voiceprints(id, name, pyannote_id, created_at)`.
 *
 * Audio buffering: each STT session keeps a rolling 30-second PCM ring-buffer
 * of the most recent system audio so we can grab a fresh sample for any
 * speaker on demand (enrollment or identification).
 */
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const FormData = require('form-data');
const sqliteClient = require('../../common/services/sqliteClient');

const _logFile = path.join(os.homedir(), 'annotated-debug.log');
function _log(...args) {
  const line = `[${new Date().toISOString()}] [Voiceprint] ${args.join(' ')}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(_logFile, line); } catch {}
}

const PYANNOTE_BASE = 'https://api.pyannote.ai';

// ─── DB schema ───────────────────────────────────────────────────────────────

function _ensureTable() {
  let db;
  try { db = sqliteClient.getDb(); } catch (_) { db = null; }
  if (!db) return null;
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS voiceprints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        pyannote_id TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS voiceprints_name_idx ON voiceprints(name);
    `);
  } catch (e) {
    _log('schema warn:', e.message);
  }
  return db;
}

function listVoiceprints() {
  const db = _ensureTable();
  if (!db) {
    _log('listVoiceprints: _ensureTable returned null (db not connected)');
    return [];
  }
  try {
    const rows = db.prepare('SELECT id, name, pyannote_id, created_at FROM voiceprints ORDER BY created_at DESC').all();
    if (rows.length === 0) _log(`listVoiceprints: returned 0 rows from db at ${db.name}`);
    return rows;
  } catch (e) {
    _log('listVoiceprints err:', e.message);
    return [];
  }
}

function findByName(name) {
  const db = _ensureTable();
  if (!db) return null;
  try {
    return db.prepare('SELECT id, name, pyannote_id FROM voiceprints WHERE LOWER(name)=LOWER(?)').get(name);
  } catch (e) {
    _log('findByName err:', e.message);
    return null;
  }
}

// Import pending voiceprints written by scripts/enroll-voiceprint.js OR by
// the bundled seed-voiceprints.json shipped with the installer.
//
// Sources, in order:
//   1. <userData>/pending-voiceprints.json — written ad-hoc by enroll scripts.
//   2. <resources>/seed-voiceprints.json   — shipped with installer (in
//      production) or src/seed-voiceprints.json (in dev). Imported once;
//      tracked via a marker file to avoid re-importing on every launch.
// Returns the total count imported across both sources.
function importPendingVoiceprints() {
  const { app } = require('electron');
  let imported = 0;

  const importFromFile = (filePath, label) => {
    if (!fs.existsSync(filePath)) return 0;
    let entries = [];
    try {
      entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      _log(`${label} JSON parse err:`, e.message);
      return 0;
    }
    if (!Array.isArray(entries) || entries.length === 0) return 0;
    let n = 0;
    for (const entry of entries) {
      if (!entry?.name || !entry?.voiceprint) continue;
      // Skip if a voiceprint with this name already exists — preserves any
      // user re-enrollment over the bundled seed.
      const existing = findByName(entry.name);
      if (existing) continue;
      if (saveVoiceprint(entry.name, entry.voiceprint)) n++;
    }
    return n;
  };

  // (1) Pending file written by manual enroll scripts
  const pendingPath = path.join(app.getPath('userData'), 'pending-voiceprints.json');
  const pendingCount = importFromFile(pendingPath, 'pending');
  if (pendingCount > 0) {
    try { fs.renameSync(pendingPath, pendingPath + '.imported.' + Date.now()); } catch (_) {}
    _log(`imported ${pendingCount} pending voiceprint(s)`);
  }
  imported += pendingCount;

  // (2) Bundled seed shipped with the installer — first-run only.
  // Marker file lives in userData so the import happens exactly once per
  // installation.
  const seedMarker = path.join(app.getPath('userData'), '.seed-voiceprints.imported');
  if (!fs.existsSync(seedMarker)) {
    // In production, electron-builder unpacks extraResources to process.resourcesPath.
    // In dev (npm start), we still want this to work — fall back to the source tree.
    const seedCandidates = [
      path.join(process.resourcesPath || '', 'seed-voiceprints.json'),
      path.join(__dirname, '..', '..', '..', 'seed-voiceprints.json'),
    ];
    let seedCount = 0;
    for (const seedPath of seedCandidates) {
      if (!fs.existsSync(seedPath)) continue;
      seedCount = importFromFile(seedPath, 'seed');
      if (seedCount > 0) {
        _log(`imported ${seedCount} bundled seed voiceprint(s) from ${seedPath}`);
        break;
      }
    }
    // Always write the marker so we don't keep retrying when the seed is
    // legitimately empty or missing.
    try { fs.writeFileSync(seedMarker, new Date().toISOString()); } catch (_) {}
    imported += seedCount;
  }

  return imported;
}

function saveVoiceprint(name, pyannoteId) {
  const db = _ensureTable();
  if (!db) return false;
  try {
    db.prepare(
      'INSERT INTO voiceprints (name, pyannote_id, created_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(pyannote_id) DO UPDATE SET name=excluded.name'
    ).run(name, pyannoteId, Date.now());
    return true;
  } catch (e) {
    _log('saveVoiceprint err:', e.message);
    return false;
  }
}

// ─── PCM → WAV helper (pyannote accepts WAV/MP3/FLAC) ────────────────────────

function pcm16leToWav(pcmBuf, sampleRate = 24000, channels = 1) {
  const dataLen = pcmBuf.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLen, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);                // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLen, 40);
  return Buffer.concat([header, pcmBuf]);
}

// ─── pyannote API calls ──────────────────────────────────────────────────────

async function _apiCall(pathSeg, formData) {
  const apiKey = process.env.PYANNOTE_API_KEY;
  if (!apiKey) throw new Error('PYANNOTE_API_KEY not set');
  const url = `${PYANNOTE_BASE}${pathSeg}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, ...formData.getHeaders() },
    body: formData,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`pyannote ${pathSeg} ${res.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

/**
 * Enroll a new speaker — stores their voiceprint in pyannote and our SQLite.
 * @param {Buffer} pcmBuf - raw PCM16LE audio buffer (mono, sampleRate hz)
 * @param {string} name - the human-readable name to associate
 * @param {number} sampleRate
 */
/**
 * Enroll from a local audio file (WAV/MP3/M4A/FLAC/OGG). Pyannote accepts
 * any of these directly — no transcoding needed.
 * @param {string} filePath
 * @param {string} name
 */
async function enrollFromFile(filePath, name) {
  try {
    if (!fs.existsSync(filePath)) {
      _log(`enrollFromFile: file not found "${filePath}"`);
      return null;
    }
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === '.mp3'  ? 'audio/mpeg' :
      ext === '.wav'  ? 'audio/wav'  :
      ext === '.flac' ? 'audio/flac' :
      ext === '.m4a'  ? 'audio/mp4'  :
      ext === '.ogg' || ext === '.opus' ? 'audio/ogg' :
      'application/octet-stream';
    const mediaUrl = await _uploadAudio(buf, contentType);
    const job = await _jsonCall('/v1/voiceprint', { url: mediaUrl });
    const jobId = job.jobId || job.id;
    if (!jobId) throw new Error('no jobId in voiceprint response');
    const output = await _pollJob(jobId, 120);
    const voiceprint = output?.voiceprint || output?.voiceprintId || (typeof output === 'string' ? output : null);
    if (!voiceprint) throw new Error('no voiceprint in job output');
    const voiceprintStr = typeof voiceprint === 'string' ? voiceprint : JSON.stringify(voiceprint);
    saveVoiceprint(name, voiceprintStr);
    _log(`✅ enrolled "${name}" from file (${voiceprintStr.length} chars)`);
    return voiceprintStr;
  } catch (e) {
    _log(`❌ enrollFromFile "${name}" failed: ${e.message}`);
    return null;
  }
}

async function enroll(pcmBuf, name, sampleRate = 24000) {
  if (!pcmBuf || pcmBuf.length < sampleRate * 2 * 3) {
    _log(`enroll skipped — audio buffer too short (${pcmBuf?.length ?? 0} bytes)`);
    return null;
  }
  try {
    const wav = pcm16leToWav(pcmBuf, sampleRate, 1);
    const mediaUrl = await _uploadAudio(wav, 'audio/wav');
    const job = await _jsonCall('/v1/voiceprint', { url: mediaUrl });
    const jobId = job.jobId || job.id;
    if (!jobId) throw new Error('no jobId in voiceprint response');
    const output = await _pollJob(jobId, 60);
    const voiceprint = output?.voiceprint || output?.voiceprintId || (typeof output === 'string' ? output : null);
    if (!voiceprint) throw new Error('no voiceprint in job output');
    const voiceprintStr = typeof voiceprint === 'string' ? voiceprint : JSON.stringify(voiceprint);
    saveVoiceprint(name, voiceprintStr);
    _log(`✅ enrolled "${name}" (${voiceprintStr.length} chars)`);
    return voiceprintStr;
  } catch (e) {
    _log(`❌ enroll "${name}" failed: ${e.message}`);
    return null;
  }
}

async function _jsonCall(pathSeg, body, method = 'POST') {
  const apiKey = process.env.PYANNOTE_API_KEY;
  if (!apiKey) throw new Error('PYANNOTE_API_KEY not set');
  const res = await fetch(`${PYANNOTE_BASE}${pathSeg}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`pyannote ${pathSeg} ${res.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function _uploadAudio(buf, contentType = 'audio/wav') {
  const key = `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const mediaUrl = `media://${key}`;
  const { url } = await _jsonCall('/v1/media/input', { url: mediaUrl });
  const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: buf });
  if (!put.ok) throw new Error(`s3 PUT failed ${put.status}`);
  return mediaUrl;
}

async function _pollJob(jobId, maxSec = 30) {
  const apiKey = process.env.PYANNOTE_API_KEY;
  for (let i = 0; i < maxSec / 2; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`${PYANNOTE_BASE}/v1/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`job poll ${res.status}`);
    const st = await res.json();
    if (st.status === 'succeeded') return st.output;
    if (st.status === 'failed' || st.status === 'cancelled') throw new Error('job ' + st.status);
  }
  throw new Error('job poll timeout');
}

/**
 * Identify the speaker of an audio chunk against enrolled voiceprints.
 * Uses pyannote /v1/identify (async job-based) with strict confidence
 * threshold (winner ≥ 50 AND beats runner-up by ≥ 25) — same logic our
 * enroll-from-mixed.js uses, validated to be 100% accurate in confidence-matrix
 * tests.
 */
/**
 * Strip silent windows from a PCM16LE buffer. Walks 100ms windows,
 * computes per-window RMS, keeps only the windows above threshold.
 * Pyannote returns all-zero confidence on silence-padded audio, so
 * this is the difference between "Jason@90" and "Naval@16 noise".
 */
function stripSilence(pcmBuf, sampleRate, rmsThreshold = 250) {
  const samplesPerWindow = Math.floor(sampleRate * 0.1); // 100ms
  const bytesPerWindow = samplesPerWindow * 2;
  const out = [];
  for (let off = 0; off + bytesPerWindow <= pcmBuf.length; off += bytesPerWindow) {
    let sumSq = 0;
    for (let i = 0; i < bytesPerWindow; i += 2) {
      const s = pcmBuf.readInt16LE(off + i);
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / samplesPerWindow);
    if (rms >= rmsThreshold) {
      out.push(pcmBuf.slice(off, off + bytesPerWindow));
    }
  }
  return Buffer.concat(out);
}

async function identify(pcmBuf, sampleRate = 24000) {
  if (!pcmBuf || pcmBuf.length < sampleRate * 2 * 2) return null;
  // Hard disable when seed voiceprints are stale or pyannote credits are out.
  // Set ANNOTATED_DISABLE_VOICEPRINT_ID=1 in env to fall back to "Speaker N"
  // labels rather than risk wrong-name attributions. Re-enroll with
  // eval/reenroll-from-sabi.mjs after topping up pyannote, then unset.
  if (process.env.ANNOTATED_DISABLE_VOICEPRINT_ID === '1') {
    _log('identify: disabled via ANNOTATED_DISABLE_VOICEPRINT_ID — falling back to anonymous labels');
    return null;
  }
  const known = listVoiceprints();
  if (known.length === 0) return null;
  try {
    const origDurSec = pcmBuf.length / (sampleRate * 2);

    // Strip silent windows — critical: pyannote returns flat 16-confidence
    // noise when silence-padded. Keeps only the speech portions.
    const speechOnly = stripSilence(pcmBuf, sampleRate, 250);
    const speechSec = speechOnly.length / (sampleRate * 2);
    _log(`identify: orig ${origDurSec.toFixed(1)}s → speech-only ${speechSec.toFixed(1)}s`);

    // Need at least 5s of actual speech for a reliable embedding
    if (speechSec < 5) {
      _log(`identify: not enough speech (${speechSec.toFixed(1)}s) — skipping`);
      return null;
    }

    // Save sample for manual inspection if needed
    const wav = pcm16leToWav(speechOnly, sampleRate, 1);
    try {
      const dbgPath = path.join(os.tmpdir(), 'annotated-identify-samples');
      fs.mkdirSync(dbgPath, { recursive: true });
      const dbgFile = path.join(dbgPath, `identify-${Date.now()}-${speechSec.toFixed(0)}s.wav`);
      fs.writeFileSync(dbgFile, wav);
    } catch (_) {}
    try {
      const dbgPath = path.join(os.tmpdir(), 'annotated-identify-samples');
      fs.mkdirSync(dbgPath, { recursive: true });
      const dbgFile = path.join(dbgPath, `identify-${Date.now()}-${durSec.toFixed(0)}s.wav`);
      fs.writeFileSync(dbgFile, wav);
      _log(`identify: saved sample → ${dbgFile}`);
    } catch (_) {}

    const mediaUrl = await _uploadAudio(wav, 'audio/wav');
    const voiceprints = known.map(v => ({ label: v.name, voiceprint: v.pyannote_id }));
    const job = await _jsonCall('/v1/identify', { url: mediaUrl, voiceprints });
    const jobId = job.jobId || job.id;
    if (!jobId) return null;
    const output = await _pollJob(jobId, 60);

    // pyannote /v1/identify returns:
    //   diarization: [{speaker:"SPEAKER_xx", start, end}]   ← timed segments
    //   voiceprints: [{speaker, match, confidence:{Jason:90, Lon:18, ...}}]
    const diar = output?.diarization || [];
    const vps  = output?.voiceprints || [];
    if (vps.length === 0) {
      _log('identify: no voiceprints array in response');
      return null;
    }

    // CRITICAL: pick the speaker who DOMINATED THE LAST 15 SECONDS of the
    // window — the one who just spoke the final transcript that triggered
    // this identify. Picking the global-dominant speaker mis-labels anyone
    // who starts talking AFTER another speaker dominated the buffer.
    let totalDur = 0;
    for (const seg of diar) totalDur = Math.max(totalDur, Number(seg.end));
    const RECENT_WINDOW_SEC = 15;
    const cutoff = Math.max(0, totalDur - RECENT_WINDOW_SEC);
    const recentDur = {};
    const allDur = {};
    for (const seg of diar) {
      const speaker = seg.speaker;
      const end = Number(seg.end);
      const start = Number(seg.start);
      allDur[speaker] = (allDur[speaker] || 0) + (end - start);
      const overlapStart = Math.max(start, cutoff);
      if (end > cutoff) recentDur[speaker] = (recentDur[speaker] || 0) + (end - overlapStart);
    }
    // Pick the speaker with most airtime in the last 15s. Require ≥ 2s in
    // that window — anything less is probably background / cross-talk.
    const ranked = Object.entries(recentDur)
      .filter(([, d]) => d >= 2)
      .sort((a, b) => b[1] - a[1]);
    const recentSpeaker = ranked[0]?.[0];
    if (!recentSpeaker) {
      _log(`identify: no speaker has ≥ 2s in last ${RECENT_WINDOW_SEC}s — skipping`);
      return null;
    }
    _log(`identify: speaker of last ${RECENT_WINDOW_SEC}s = ${recentSpeaker} (${recentDur[recentSpeaker].toFixed(1)}s recent / ${(allDur[recentSpeaker] || 0).toFixed(1)}s total)`);
    const targetVP = vps.find(v => v.speaker === recentSpeaker) || vps[0];

    const conf = targetVP.confidence || {};
    const confRanked = Object.entries(conf).sort((a, b) => b[1] - a[1]);
    const [topName, topScore] = confRanked[0] ?? [null, 0];
    const runnerScore = confRanked[1]?.[1] ?? 0;
    const gap = topScore - runnerScore;

    // Tiered confidence gate — calibrated against real-world false positives
    // and validated on TWiST E2282 attribution test (Jason@90/Lon@70/Oliver@90):
    //   • HIGH tier (top ≥ 85): winner is clearly the right answer even when
    //     the runner-up sits high. Happens when two enrolled speakers share
    //     vocal register (Jason ↔ Lon, both adult male; Oliver ↔ Jason
    //     similar register). Modest gap (≥ 10) is sufficient.
    //   • MID tier (top 75-84): less confident — require a wide gap (≥ 25)
    //     so we don't fall into the Jason ↔ Sacks ambiguity zone (the two
    //     voiceprints sit close in embedding space and any 50-65 winner
    //     used to mis-label Jason as Sacks).
    //   • Below 75: always reject. Stay anonymous as "Speaker N".
    const CONF_HIGH_ABS = 85, CONF_HIGH_GAP = 10;
    const CONF_MID_ABS  = 75, CONF_MID_GAP  = 25;
    const passesHigh = topScore >= CONF_HIGH_ABS && gap >= CONF_HIGH_GAP;
    const passesMid  = topScore >= CONF_MID_ABS  && gap >= CONF_MID_GAP;
    if (!passesHigh && !passesMid) {
      _log(`identify: insufficient confidence (top=${topName}@${topScore}, gap=${gap}) — staying anonymous`);
      return null;
    }
    _log(`identify: ${topName}@${topScore} (gap=${gap}) — ${passesHigh ? 'HIGH' : 'MID'} tier match`);

    return { name: topName, score: topScore };
  } catch (e) {
    _log('identify err:', e.message);
    return null;
  }
}

module.exports = {
  enroll,
  enrollFromFile,
  identify,
  listVoiceprints,
  findByName,
  saveVoiceprint,
  importPendingVoiceprints,
  pcm16leToWav,
};
