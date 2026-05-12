// Run identify on the actual saved production audio samples.
const fs = require('fs');
const path = require('path');
const os = require('os');
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
async function jsonCall(p, body, key) {
  const r = await fetch(`${PY}${p}`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${p} ${r.status}: ${t.slice(0,200)}`);
  return JSON.parse(t);
}
async function uploadAudio(buf, key) {
  const url = `media://prod-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
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
    if (st.status === 'failed') throw new Error('job failed');
  }
  throw new Error('timeout');
}

(async () => {
  const apiKey = process.env.PYANNOTE_API_KEY;
  const known = loadKnown();
  const vp = known.map(k => ({ label: k.name, voiceprint: k.voiceprint }));
  const dir = path.join(os.tmpdir(), 'annotated-identify-samples');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.wav'));

  console.log(`Running pyannote identify on ${files.length} production samples\n`);
  for (const f of files) {
    const buf = fs.readFileSync(path.join(dir, f));
    try {
      const url = await uploadAudio(buf, apiKey);
      const job = await jsonCall('/v1/identify', { url, voiceprints: vp }, apiKey);
      const out = await pollJob(job.jobId || job.id, apiKey);
      const vps = out?.voiceprints || [];
      const diar = out?.diarization || [];
      console.log(`${f}:`);
      console.log(`  diarization segments: ${diar.length}`);
      // duration per pyannote-detected speaker
      const dur = {};
      for (const seg of diar) dur[seg.speaker] = (dur[seg.speaker] || 0) + (seg.end - seg.start);
      for (const [s, d] of Object.entries(dur).sort((a,b)=>b[1]-a[1])) {
        const v = vps.find(v => v.speaker === s);
        const conf = v?.confidence || {};
        const ranked = Object.entries(conf).sort((a,b)=>b[1]-a[1]);
        const top3 = ranked.slice(0,3).map(([n,sc]) => `${n}=${sc}`).join(' ');
        console.log(`    ${s}: ${d.toFixed(1)}s — ${top3}`);
      }
    } catch (e) {
      console.log(`${f}: ERROR ${e.message}`);
    }
    console.log('');
  }
})();
