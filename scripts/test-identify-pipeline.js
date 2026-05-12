// Comprehensive identify-pipeline tester.
//
// For each enrolled host clip, produces synthetic samples at multiple window
// sizes (5s/10s/15s/20s/30s/45s/60s) AT 24KHZ MONO PCM (matching what the live
// app captures), runs them through pyannote /v1/identify, and reports the
// confidence matrix. Tells us the minimum reliable sample size in the LIVE
// audio format — not the original 44.1kHz YouTube format we enrolled with.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
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

async function uploadAudio(buf, contentType, key) {
  const tag = `idtest-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const mediaUrl = `media://${tag}`;
  const { url } = await jsonCall('/v1/media/input', { url: mediaUrl }, key);
  const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: buf });
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

// Run ffmpeg to extract a chunk at 24kHz mono WAV (matches live capture format).
function ffmpegExtract24k(input, startSec, durSec, output) {
  return new Promise((resolve, reject) => {
    const args = ['-y', '-ss', String(startSec), '-i', input, '-t', String(durSec), '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', output];
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', c => err += c.toString());
    p.on('close', code => code === 0 ? resolve() : reject(new Error(err.slice(0, 300))));
  });
}

async function identify(filePath, voiceprints, key) {
  const buf = fs.readFileSync(filePath);
  const mediaUrl = await uploadAudio(buf, 'audio/wav', key);
  const job = await jsonCall('/v1/identify', { url: mediaUrl, voiceprints }, key);
  const out = await pollJob(job.jobId || job.id, key);
  const diar = out?.diarization || [];
  const vps  = out?.voiceprints || [];
  if (!vps.length) return { error: 'no voiceprints in response' };

  // Pick dominant diarized speaker
  const dur = {};
  for (const seg of diar) dur[seg.speaker] = (dur[seg.speaker] || 0) + (seg.end - seg.start);
  const dominantSpeaker = Object.entries(dur).sort((a, b) => b[1] - a[1])[0]?.[0];
  const target = vps.find(v => v.speaker === dominantSpeaker) || vps[0];
  const conf = target.confidence || {};
  const ranked = Object.entries(conf).sort((a, b) => b[1] - a[1]);
  const [topName, topScore] = ranked[0] ?? [null, 0];
  const runnerScore = ranked[1]?.[1] ?? 0;
  return { topName, topScore, runnerScore, gap: topScore - runnerScore, allConf: conf, segments: diar.length };
}

(async () => {
  const apiKey = process.env.PYANNOTE_API_KEY;
  const known = loadKnownVoiceprints();
  console.log(`📋 enrolled: ${known.map(k => k.name).join(', ')}\n`);

  const tmpdir = path.join(os.tmpdir(), 'voiceprints');
  const extracted = fs.readdirSync(tmpdir)
    .filter(n => n.startsWith('Alex-extracted-') && n.endsWith('.wav'))
    .sort().reverse()[0];

  // Source clips for synthetic test
  const sources = [
    { name: 'Jason',  src: path.join(tmpdir, 'jason.wav') },
    { name: 'Lon',    src: path.join(tmpdir, 'lon.wav') },
    { name: 'Oliver', src: path.join(tmpdir, 'oliver.wav') },
    { name: 'Alex',   src: extracted ? path.join(tmpdir, extracted) : null },
  ];
  const windowSizes = [10, 15, 20, 30];  // seconds — matching new retry windows
  const voiceprintArg = known.map(k => ({ label: k.name, voiceprint: k.voiceprint }));

  console.log('Building test fixtures (24kHz mono, matching live audio format)...\n');
  const fixtures = [];
  for (const s of sources) {
    if (!s.src || !fs.existsSync(s.src)) { console.log(`  skip ${s.name} — source missing`); continue; }
    for (const sz of windowSizes) {
      const out = path.join(tmpdir, `idtest-${s.name}-${sz}s.wav`);
      try {
        await ffmpegExtract24k(s.src, 5, sz, out); // start 5s in to skip intros
        fixtures.push({ expected: s.name, windowSec: sz, file: out });
      } catch (e) {
        console.log(`  ffmpeg err ${s.name}@${sz}s: ${e.message.slice(0, 120)}`);
      }
    }
  }
  console.log(`Built ${fixtures.length} fixtures\n`);

  // Run identify in PARALLEL batches of 4 to save time
  console.log(`speaker  | window  | top match            gap  | all-confidence`);
  console.log('─'.repeat(90));
  const results = [];
  const BATCH = 4;
  for (let i = 0; i < fixtures.length; i += BATCH) {
    const batch = fixtures.slice(i, i + BATCH);
    const out = await Promise.all(batch.map(f =>
      identify(f.file, voiceprintArg, apiKey).then(r => ({ ...f, ...r }))
    ));
    for (const r of out) {
      const correct = r.topName === r.expected;
      const accept = (r.topScore ?? 0) >= 50 && (r.gap ?? 0) >= 25;
      const verdict = accept
        ? (correct ? '✓ correct' : `✗ WRONG (said ${r.topName})`)
        : `~ no-match (would stay anonymous)`;
      const confSummary = r.allConf
        ? Object.entries(r.allConf).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([n,s])=>`${n}=${s}`).join(' ')
        : '?';
      console.log(`${(r.expected || '?').padEnd(8)} | ${(r.windowSec + 's').padEnd(7)} | ${(r.topName ?? '?').padEnd(10)} ${String(r.topScore ?? '?').padStart(3)} gap=${String(r.gap ?? '?').padStart(3)}  | ${confSummary} ${verdict}`);
      results.push({ ...r, correct, accept });
    }
  }

  console.log('\n──── SUMMARY ────');
  for (const sz of windowSizes) {
    const subset = results.filter(r => r.windowSec === sz);
    const correct = subset.filter(r => r.accept && r.correct).length;
    const wrong = subset.filter(r => r.accept && !r.correct).length;
    const noMatch = subset.filter(r => !r.accept).length;
    console.log(`window=${sz}s  ${correct}/${subset.length} correct,  ${wrong} wrong,  ${noMatch} would-be anonymous`);
  }

  // Cleanup fixtures
  for (const f of fixtures) { try { fs.unlinkSync(f.file); } catch {} }
})();
