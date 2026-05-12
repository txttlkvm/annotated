// Enroll a NEW speaker from a mixed-speaker audio clip.
// Diarizes audio, identifies known voices, extracts only the unknown
// segments via ffmpeg, then enrolls the concatenated unknown audio as the
// new speaker's voiceprint.
//
// Usage:
//   node scripts/enroll-from-mixed.js <new-name> <audio-file>
//
// Pre-req: at least one known speaker already enrolled (so we can subtract).
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PENDING_PATH = path.join(process.env.APPDATA || '', 'annotated', 'pending-voiceprints.json');
const DB_PATH      = path.join(process.env.APPDATA || '', 'annotated', 'pickleglass.db');
const PY = 'https://api.pyannote.ai';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── pyannote helpers ────────────────────────────────────────────────────────

async function jsonCall(pathSeg, body, apiKey) {
  const res = await fetch(`${PY}${pathSeg}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`pyannote ${pathSeg} ${res.status}: ${t.slice(0, 250)}`);
  return JSON.parse(t);
}

async function uploadAudio(filePath, contentType, apiKey) {
  const buf = fs.readFileSync(filePath);
  const key = `mix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const mediaUrl = `media://${key}`;
  const { url } = await jsonCall('/v1/media/input', { url: mediaUrl }, apiKey);
  const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: buf });
  if (!put.ok) throw new Error(`s3 PUT ${put.status}`);
  return mediaUrl;
}

async function pollJob(jobId, apiKey, maxSec = 180) {
  for (let i = 0; i < maxSec / 2; i++) {
    await sleep(2000);
    const res = await fetch(`${PY}/v1/jobs/${jobId}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error(`job poll ${res.status}`);
    const st = await res.json();
    process.stdout.write(`\r     status=${st.status}                        `);
    if (st.status === 'succeeded') { console.log(''); return st.output; }
    if (st.status === 'failed' || st.status === 'cancelled') throw new Error('job ' + st.status);
  }
  throw new Error('job poll timeout');
}

// ─── ffmpeg helpers ──────────────────────────────────────────────────────────

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', c => stderr += c.toString());
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}: ${stderr.slice(0, 400)}`)));
  });
}

async function extractAndConcat(inputFile, segments, outputFile) {
  // Build an ffmpeg filter_complex that selects each segment then concats.
  // [0:a]atrim=start=S:end=E,asetpts=PTS-STARTPTS[a0];
  // [0:a]atrim=...[a1];
  // [a0][a1]concat=n=2:v=0:a=1[out]
  const trims = segments.map((s, i) =>
    `[0:a]atrim=start=${s.start.toFixed(3)}:end=${s.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`
  ).join(';');
  const concat = segments.map((_, i) => `[a${i}]`).join('') + `concat=n=${segments.length}:v=0:a=1[out]`;
  const filter = trims + ';' + concat;
  await runCmd('ffmpeg', ['-y', '-i', inputFile, '-filter_complex', filter, '-map', '[out]', '-ar', '16000', '-ac', '1', outputFile]);
}

// ─── DB readers ──────────────────────────────────────────────────────────────

function loadKnownVoiceprints() {
  // Read from the running app's SQLite via a sidecar file. Since we can't
  // load better-sqlite3 in standalone Node, we use a plain JSON exported from
  // the latest app start. Fallback: scan .imported.* files in pending dir.
  const importedFiles = fs.readdirSync(path.dirname(PENDING_PATH))
    .filter(n => n.startsWith('pending-voiceprints.json.imported.'))
    .sort();
  const known = [];
  const seen = new Set();
  // walk newest → oldest so latest name wins
  for (const f of importedFiles.reverse()) {
    try {
      const arr = JSON.parse(fs.readFileSync(path.join(path.dirname(PENDING_PATH), f), 'utf8'));
      for (const e of arr) {
        if (!seen.has(e.name)) { seen.add(e.name); known.push(e); }
      }
    } catch {}
  }
  return known;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const [, , newName, filePath] = process.argv;
  if (!newName || !filePath) {
    console.error('usage: node scripts/enroll-from-mixed.js <new-name> <audio-file>');
    process.exit(1);
  }
  const apiKey = process.env.PYANNOTE_API_KEY;
  if (!apiKey) { console.error('PYANNOTE_API_KEY not set'); process.exit(1); }

  const known = loadKnownVoiceprints();
  if (known.length === 0) {
    console.error('no known voiceprints — enroll at least one clean speaker first');
    process.exit(1);
  }
  console.log(`[setup] ${known.length} known voiceprint(s): ${known.map(k => k.name).join(', ')}`);

  console.log(`[1/6] uploading ${path.basename(filePath)} to pyannote…`);
  const mediaUrl = await uploadAudio(filePath, 'audio/wav', apiKey);

  console.log(`[2/6] running diarization + identification…`);
  const voiceprintArg = known.map(k => ({ label: k.name, voiceprint: k.voiceprint }));
  const idJob = await jsonCall('/v1/identify', { url: mediaUrl, voiceprints: voiceprintArg }, apiKey);
  const idOutput = await pollJob(idJob.jobId || idJob.id, apiKey);
  // DEBUG dump for tuning
  fs.writeFileSync(path.join(os.tmpdir(), 'pyannote-identify-output.json'), JSON.stringify(idOutput, null, 2));
  console.log(`     [debug] full output written to ${path.join(os.tmpdir(), 'pyannote-identify-output.json')}`);

  // pyannote /v1/identify response:
  //   diarization: [{speaker:"SPEAKER_00", start, end}, ...]   ← timed segments
  //   voiceprints: [{speaker:"SPEAKER_00", match, confidence:{Jason:90, Lon:18, ...}}]  ← per-speaker match
  // We trust voiceprints[].match ONLY when its confidence is significantly
  // above the runner-up — otherwise pyannote is forcing a label on noise.
  const diarSegs   = idOutput?.diarization || [];
  const speakerVPs = idOutput?.voiceprints || [];
  if (diarSegs.length === 0 || speakerVPs.length === 0) {
    console.error('unexpected identify response shape:', JSON.stringify(idOutput).slice(0, 500));
    process.exit(1);
  }

  const CONF_MIN_GAP = 25;  // winner must beat runner-up by ≥ this margin
  const CONF_MIN_ABS = 50;  // winner's absolute score must clear this

  const speakerLabels = {}; // SPEAKER_xx → resolved name OR null (unknown)
  console.log('     ─── per-speaker match (with confidence) ────');
  for (const vp of speakerVPs) {
    const conf = vp.confidence || {};
    const ranked = Object.entries(conf).sort((a, b) => b[1] - a[1]);
    const [topName, topScore] = ranked[0] ?? [null, 0];
    const runnerScore = ranked[1]?.[1] ?? 0;
    const gap = topScore - runnerScore;
    const accept = topScore >= CONF_MIN_ABS && gap >= CONF_MIN_GAP;
    speakerLabels[vp.speaker] = accept ? topName : null;
    const decision = accept ? `→ ${topName}` : '→ UNKNOWN (low confidence — likely a new voice)';
    console.log(`     ${vp.speaker}: ${ranked.map(([n,s]) => `${n}=${s}`).join(' ')}  ${decision}`);
  }
  console.log('     ─────────────────────────────────────────────');

  // Aggregate diarization segments per resolved speaker label
  const byLabel = {};
  for (const seg of diarSegs) {
    const label = speakerLabels[seg.speaker] || `__unknown_${seg.speaker}`;
    byLabel[label] = byLabel[label] || [];
    byLabel[label].push({ start: Number(seg.start), end: Number(seg.end) });
  }
  console.log('     ─── total time per resolved speaker ────────');
  for (const [label, segs] of Object.entries(byLabel)) {
    const total = segs.reduce((a, s) => a + (s.end - s.start), 0);
    console.log(`     ${label.padEnd(22)} ${segs.length} segs  ${total.toFixed(1)}s`);
  }
  console.log('     ─────────────────────────────────────────────');

  // The unknown speaker(s) = the new voice. Pick the one with the most audio.
  const unknownLabels = Object.keys(byLabel).filter(l => l.startsWith('__unknown_'));
  if (unknownLabels.length === 0) {
    console.error(`no unknown speakers found — all diarized speakers matched existing voiceprints with high confidence.`);
    process.exit(1);
  }
  unknownLabels.sort((a, b) => {
    const ta = byLabel[a].reduce((x, s) => x + s.end - s.start, 0);
    const tb = byLabel[b].reduce((x, s) => x + s.end - s.start, 0);
    return tb - ta;
  });
  const targetLabel = unknownLabels[0];
  const unknown = byLabel[targetLabel].filter(s => s.end - s.start > 0.5);
  const totalSec = unknown.reduce((s, x) => s + (x.end - x.start), 0);
  console.log(`[3/6] picked ${targetLabel} → ${newName} (${unknown.length} segs, ${totalSec.toFixed(1)}s)`);

  if (totalSec < 5) {
    console.error('not enough unknown audio (need ≥ 5s for a reliable voiceprint)');
    process.exit(1);
  }

  console.log(`[4/6] extracting unknown segments via ffmpeg…`);
  const tmpOut = path.join(os.tmpdir(), `voiceprints/${newName}-extracted-${Date.now()}.wav`);
  await extractAndConcat(filePath, unknown, tmpOut);
  console.log(`     wrote ${tmpOut} (${(fs.statSync(tmpOut).size/1024).toFixed(0)} KB)`);

  console.log(`[5/6] uploading extracted-only audio…`);
  const extractedMediaUrl = await uploadAudio(tmpOut, 'audio/wav', apiKey);

  console.log(`[6/6] generating voiceprint for "${newName}"…`);
  const vpJob = await jsonCall('/v1/voiceprint', { url: extractedMediaUrl }, apiKey);
  const vpOut = await pollJob(vpJob.jobId || vpJob.id, apiKey);
  const voiceprint = vpOut?.voiceprint || vpOut?.voiceprintId || (typeof vpOut === 'string' ? vpOut : null);
  if (!voiceprint) { console.error('no voiceprint in response:', JSON.stringify(vpOut).slice(0, 300)); process.exit(1); }
  const voiceprintStr = typeof voiceprint === 'string' ? voiceprint : JSON.stringify(voiceprint);

  // queue for app import
  fs.mkdirSync(path.dirname(PENDING_PATH), { recursive: true });
  let pending = [];
  if (fs.existsSync(PENDING_PATH)) {
    try { pending = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8')); } catch {}
  }
  pending = pending.filter(e => e.name !== newName);
  pending.push({ name: newName, voiceprint: voiceprintStr, created_at: Date.now() });
  fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2));
  console.log(`✅ queued "${newName}" (${voiceprintStr.length} chars). Restart the app to import.`);
}

main().catch(e => { console.error('failed:', e.message); process.exit(1); });
