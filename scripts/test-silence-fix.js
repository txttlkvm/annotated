// Verify the silence-stripping pass fixes the production failure mode.
// Generates silence-padded audio, runs it through stripSilence + pyannote,
// confirms identification succeeds.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PENDING_DIR = path.join(process.env.APPDATA || '', 'annotated');
const PY = 'https://api.pyannote.ai';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadKnown() {
  const files = fs.readdirSync(PENDING_DIR).filter(n => n.startsWith('pending-voiceprints.json.imported.'));
  const seen = new Set(), out = [];
  for (const f of files.sort().reverse()) {
    try {
      const a = JSON.parse(fs.readFileSync(path.join(PENDING_DIR, f), 'utf8'));
      for (const e of a) if (!seen.has(e.name)) { seen.add(e.name); out.push(e); }
    } catch {}
  }
  return out;
}

function stripSilence(pcmBuf, sampleRate, rmsThreshold = 250) {
  const samplesPerWindow = Math.floor(sampleRate * 0.1);
  const bytesPerWindow = samplesPerWindow * 2;
  const out = [];
  for (let off = 0; off + bytesPerWindow <= pcmBuf.length; off += bytesPerWindow) {
    let sumSq = 0;
    for (let i = 0; i < bytesPerWindow; i += 2) {
      const s = pcmBuf.readInt16LE(off + i);
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / samplesPerWindow);
    if (rms >= rmsThreshold) out.push(pcmBuf.slice(off, off + bytesPerWindow));
  }
  return Buffer.concat(out);
}

function pcm16leToWav(pcmBuf, sampleRate = 24000, channels = 1) {
  const dataLen = pcmBuf.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLen, 4);
  header.write('WAVE', 8); header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22); header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28); header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34); header.write('data', 36);
  header.writeUInt32LE(dataLen, 40);
  return Buffer.concat([header, pcmBuf]);
}

async function jsonCall(p, body, key) {
  const r = await fetch(`${PY}${p}`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${p} ${r.status}: ${t.slice(0, 200)}`);
  return JSON.parse(t);
}
async function uploadAudio(buf, key) {
  const tag = `silence-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const url = `media://${tag}`;
  const { url: signed } = await jsonCall('/v1/media/input', { url }, key);
  const put = await fetch(signed, { method: 'PUT', headers: { 'Content-Type': 'audio/wav' }, body: buf });
  if (!put.ok) throw new Error(`s3 ${put.status}`);
  return url;
}
async function pollJob(id, key) {
  for (let i = 0; i < 120; i++) {
    await sleep(2000);
    const r = await fetch(`${PY}/v1/jobs/${id}`, { headers: { Authorization: `Bearer ${key}` } });
    const st = await r.json();
    if (st.status === 'succeeded') return st.output;
    if (st.status === 'failed' || st.status === 'cancelled') throw new Error('job ' + st.status);
  }
  throw new Error('timeout');
}
async function identify(wavBuf, voiceprints, key) {
  const url = await uploadAudio(wavBuf, key);
  const job = await jsonCall('/v1/identify', { url, voiceprints }, key);
  const out = await pollJob(job.jobId || job.id, key);
  const vps = out?.voiceprints || [];
  if (!vps.length) return { error: 'empty' };
  const diar = out?.diarization || [];
  const dur = {};
  for (const seg of diar) dur[seg.speaker] = (dur[seg.speaker] || 0) + (seg.end - seg.start);
  const dom = Object.entries(dur).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const t = vps.find(v => v.speaker === dom) || vps[0];
  const conf = t.confidence || {};
  const ranked = Object.entries(conf).sort((a,b)=>b[1]-a[1]);
  return { topName: ranked[0]?.[0], topScore: ranked[0]?.[1], runner: ranked[1]?.[1], conf };
}

(async () => {
  const apiKey = process.env.PYANNOTE_API_KEY;
  const known = loadKnown();
  const vp = known.map(k => ({ label: k.name, voiceprint: k.voiceprint }));
  const tmp = path.join(os.tmpdir(), 'voiceprints');

  // First, convert jason.wav to 24kHz mono PCM as our reference (matches live capture).
  const jasonRefWav = path.join(tmp, '_jason_24k.wav');
  await new Promise((res, rej) => {
    const p = spawn('ffmpeg', ['-y', '-i', path.join(tmp, 'jason.wav'), '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', jasonRefWav], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', c => err += c.toString());
    p.on('close', c => c === 0 ? res() : rej(new Error(err.slice(0, 300))));
  });
  const jasonPcm = fs.readFileSync(jasonRefWav).slice(44); // strip WAV header

  // Build a "production-like" PCM buffer: 30s window with patches of speech +
  // gaps of silence. Now correctly interpreted at 24kHz.
  function buildPcm(seconds, speechRanges) {
    const sampleRate = 24000;
    const total = sampleRate * seconds;
    const pcm = Buffer.alloc(total * 2);
    let sourcePos = Math.floor(10 * sampleRate * 2); // start 10s into jason clip
    for (const r of speechRanges) {
      const startByte = Math.floor(r.start * sampleRate * 2);
      const lenBytes  = Math.floor((r.end - r.start) * sampleRate * 2);
      const chunk = jasonPcm.slice(sourcePos, sourcePos + lenBytes);
      chunk.copy(pcm, startByte);
      sourcePos += lenBytes;
    }
    return pcm;
  }

  console.log('Test: 30s window with realistic podcast silence patterns');
  console.log('═'.repeat(80));

  const scenarios = [
    { name: '5s speech burst at start',         ranges: [{ start: 0, end: 5 }] },
    { name: '5s speech burst at end',           ranges: [{ start: 25, end: 30 }] },
    { name: '3 short bursts (4s + 4s + 4s)',    ranges: [{ start: 2, end: 6 }, { start: 12, end: 16 }, { start: 22, end: 26 }] },
    { name: '2s burst + lots of silence',       ranges: [{ start: 14, end: 16 }] },
    { name: '15s continuous speech',            ranges: [{ start: 5, end: 20 }] },
  ];

  for (const sc of scenarios) {
    const pcm = buildPcm(30, sc.ranges);
    const speechSec = sc.ranges.reduce((s, r) => s + (r.end - r.start), 0);
    console.log(`\n  ${sc.name}  (${speechSec}s speech in 30s window)`);

    // BEFORE (no silence stripping) — what the old code did
    const wavBefore = pcm16leToWav(pcm, 24000, 1);
    const before = await identify(wavBefore, vp, apiKey);
    console.log(`  before: ${before.topName}@${before.topScore} gap=${(before.topScore ?? 0) - (before.runner ?? 0)}`);

    // AFTER silence stripping
    const stripped = stripSilence(pcm, 24000, 250);
    const strippedSec = stripped.length / (24000 * 2);
    if (strippedSec < 5) {
      console.log(`  after:  not enough speech (${strippedSec.toFixed(1)}s) — would skip identify`);
      continue;
    }
    const wavAfter = pcm16leToWav(stripped, 24000, 1);
    const after = await identify(wavAfter, vp, apiKey);
    console.log(`  after:  ${after.topName}@${after.topScore} gap=${(after.topScore ?? 0) - (after.runner ?? 0)}  (${strippedSec.toFixed(1)}s of pure speech)`);
  }
})();
