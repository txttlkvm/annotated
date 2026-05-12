// Confidence matrix — for each test clip, run /v1/identify against ALL
// enrolled voiceprints and print the score each voice gives.
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PENDING_DIR = path.join(process.env.APPDATA || '', 'annotated');
const PY = 'https://api.pyannote.ai';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function jsonCall(p, body, key) {
  const r = await fetch(`${PY}${p}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${p} ${r.status}: ${t.slice(0, 200)}`);
  return JSON.parse(t);
}
async function uploadAudio(filePath, key) {
  const buf = fs.readFileSync(filePath);
  const tag = `test-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const mediaUrl = `media://${tag}`;
  const { url } = await jsonCall('/v1/media/input', { url: mediaUrl }, key);
  const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'audio/wav' }, body: buf });
  if (!put.ok) throw new Error(`s3 ${put.status}`);
  return mediaUrl;
}
async function pollJob(id, key, maxSec = 240) {
  for (let i = 0; i < maxSec / 2; i++) {
    await sleep(2000);
    const r = await fetch(`${PY}/v1/jobs/${id}`, { headers: { Authorization: `Bearer ${key}` } });
    const st = await r.json();
    if (st.status === 'succeeded') return st.output;
    if (st.status === 'failed' || st.status === 'cancelled') throw new Error('job ' + st.status);
  }
  throw new Error('poll timeout');
}

function loadKnownVoiceprints() {
  const files = fs.readdirSync(PENDING_DIR).filter(n => n.startsWith('pending-voiceprints.json.imported.'));
  const known = [];
  const seen = new Set();
  for (const f of files.sort().reverse()) {
    try {
      const arr = JSON.parse(fs.readFileSync(path.join(PENDING_DIR, f), 'utf8'));
      for (const e of arr) if (!seen.has(e.name)) { seen.add(e.name); known.push(e); }
    } catch {}
  }
  return known;
}

(async () => {
  const apiKey = process.env.PYANNOTE_API_KEY;
  const known = loadKnownVoiceprints();
  console.log(`Enrolled voiceprints: ${known.map(k => k.name).join(', ')}\n`);

  // Test clips: each maps a clean clip path → expected speaker
  const tmpdir = path.join(os.tmpdir(), 'voiceprints');
  // Find latest Alex extraction
  const extracted = fs.readdirSync(tmpdir)
    .filter(n => n.startsWith('Alex-extracted-') && n.endsWith('.wav'))
    .sort().reverse()[0];
  const tests = [
    { name: 'Jason',  file: path.join(tmpdir, 'jason.wav') },
    { name: 'Lon',    file: path.join(tmpdir, 'lon.wav') },
    { name: 'Oliver', file: path.join(tmpdir, 'oliver.wav') },
    { name: 'Alex',   file: path.join(tmpdir, extracted || '') },
  ];

  const voiceprintArg = known.map(k => ({ label: k.name, voiceprint: k.voiceprint }));

  // Header row
  const enrolled = known.map(k => k.name);
  const colW = 9;
  const headerCells = enrolled.map(n => n.padStart(colW)).join('');
  console.log(`${'TEST CLIP'.padEnd(11)}${headerCells}   verdict`);
  console.log('─'.repeat(11 + enrolled.length * colW + 12));

  for (const t of tests) {
    if (!fs.existsSync(t.file)) {
      console.log(`${t.name.padEnd(11)}— file not found: ${t.file}`);
      continue;
    }
    try {
      const mediaUrl = await uploadAudio(t.file, apiKey);
      const job = await jsonCall('/v1/identify', { url: mediaUrl, voiceprints: voiceprintArg }, apiKey);
      const out = await pollJob(job.jobId || job.id, apiKey);
      const vps = out?.voiceprints || [];
      // The clip likely has multiple diarized speakers. Pick the LONGEST diarized
      // speaker as the test target (it should be the named subject).
      const diar = out?.diarization || [];
      const dur = {};
      for (const seg of diar) {
        dur[seg.speaker] = (dur[seg.speaker] || 0) + (seg.end - seg.start);
      }
      const dominantSpeaker = Object.entries(dur).sort((a,b) => b[1] - a[1])[0]?.[0];
      const matchedVP = vps.find(v => v.speaker === dominantSpeaker);
      if (!matchedVP) {
        console.log(`${t.name.padEnd(11)}— no match data`);
        continue;
      }
      const conf = matchedVP.confidence || {};
      const cells = enrolled.map(n => String(conf[n] ?? '?').padStart(colW)).join('');
      const ranked = Object.entries(conf).sort((a,b) => b[1] - a[1]);
      const [topName, topScore] = ranked[0];
      const runnerScore = ranked[1]?.[1] ?? 0;
      const correct = topName === t.name;
      const verdict = correct
        ? `✓ ${topName} (gap +${topScore - runnerScore})`
        : `✗ said ${topName}, expected ${t.name}`;
      console.log(`${t.name.padEnd(11)}${cells}   ${verdict}`);
    } catch (e) {
      console.log(`${t.name.padEnd(11)}error: ${e.message}`);
    }
  }
})();
