// Test pyannote identify on actual TWiST audio (Ask Jason episode).
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
async function jc(p, b, key) {
  const r = await fetch(PY + p, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  const t = await r.text(); if (!r.ok) throw new Error(`${p} ${r.status}: ${t.slice(0,150)}`); return JSON.parse(t);
}
async function poll(id, key) {
  for (let i = 0; i < 120; i++) {
    await sleep(2000);
    const r = await fetch(`${PY}/v1/jobs/${id}`, { headers: { Authorization: `Bearer ${key}` } });
    const s = await r.json();
    if (s.status === 'succeeded') return s.output;
    if (s.status === 'failed') throw new Error('job failed');
  }
  throw new Error('poll timeout');
}
function ff(args) { return new Promise((r, j) => { const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] }); let e = ''; p.stderr.on('data', c => e += c.toString()); p.on('close', c => c === 0 ? r() : j(new Error(e.slice(0,200)))); }); }

(async () => {
  const apiKey = process.env.PYANNOTE_API_KEY;
  const known = loadKnown();
  const vp = known.map(k => ({ label: k.name, voiceprint: k.voiceprint }));
  const tmp = path.join(os.tmpdir(), 'voiceprints');
  const src = path.join(tmp, 'twist-test.wav');

  // Test multiple time slices through the 2-hour clip
  const slices = [
    { name: '60s-90s',     ss: 60,   t: 30 },
    { name: '300s-330s',   ss: 300,  t: 30 },
    { name: '600s-660s',   ss: 600,  t: 60 },
    { name: '1200s-1260s', ss: 1200, t: 60 },
    { name: '3600s-3660s', ss: 3600, t: 60 },
  ];

  for (const s of slices) {
    const out = path.join(tmp, `twist-${s.name}.wav`);
    await ff(['-y', '-ss', String(s.ss), '-i', src, '-t', String(s.t), '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', out]);
    const buf = fs.readFileSync(out);
    const url = `media://twist-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const u = await jc('/v1/media/input', { url }, apiKey);
    const put = await fetch(u.url, { method: 'PUT', headers: { 'Content-Type': 'audio/wav' }, body: buf });
    if (!put.ok) { console.log(`${s.name}: PUT failed`); continue; }
    const job = await jc('/v1/identify', { url, voiceprints: vp }, apiKey);
    const result = await poll(job.jobId || job.id, apiKey);
    console.log(`\n=== ${s.name} (${s.t}s) ===`);
    const diar = result?.diarization || [];
    const dur = {};
    for (const seg of diar) dur[seg.speaker] = (dur[seg.speaker] || 0) + (seg.end - seg.start);
    for (const v of (result?.voiceprints || [])) {
      const dr = dur[v.speaker] || 0;
      const conf = v.confidence || {};
      const ranked = Object.entries(conf).sort((a, b) => b[1] - a[1]);
      console.log(`  ${v.speaker}  ${dr.toFixed(1)}s  →  ${ranked.slice(0,4).map(([n,s])=>`${n}=${s}`).join('  ')}`);
    }
    fs.unlinkSync(out);
  }
})();
