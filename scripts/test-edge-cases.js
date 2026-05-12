// Edge-case identification tests — mimic real-world production scenarios
// that may differ from the clean test fixtures.
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
async function uploadAudio(buf, ct, key) {
  const tag = `edgetest-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const url = `media://${tag}`;
  const { url: signed } = await jsonCall('/v1/media/input', { url }, key);
  const put = await fetch(signed, { method: 'PUT', headers: { 'Content-Type': ct }, body: buf });
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
function ffmpeg(args) {
  return new Promise((res, rej) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', c => err += c.toString());
    p.on('close', c => c === 0 ? res() : rej(new Error(err.slice(0,300))));
  });
}
async function identify(filePath, voiceprints, key) {
  const buf = fs.readFileSync(filePath);
  const url = await uploadAudio(buf, 'audio/wav', key);
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

  const tests = [
    // Sample rate mismatches
    { name: 'Jason 15s @ 16kHz mono',  pre: ['-ss','5','-i',`${tmp}\\jason.wav`,'-t','15','-ar','16000','-ac','1','-c:a','pcm_s16le'], expect: 'Jason' },
    { name: 'Jason 15s @ 48kHz mono',  pre: ['-ss','5','-i',`${tmp}\\jason.wav`,'-t','15','-ar','48000','-ac','1','-c:a','pcm_s16le'], expect: 'Jason' },
    { name: 'Jason 15s @ 8kHz  mono',  pre: ['-ss','5','-i',`${tmp}\\jason.wav`,'-t','15','-ar','8000','-ac','1','-c:a','pcm_s16le'], expect: 'Jason' },
    // Stereo (mimics if loopback came through stereo)
    { name: 'Jason 15s @ 24kHz stereo',pre: ['-ss','5','-i',`${tmp}\\jason.wav`,'-t','15','-ar','24000','-ac','2','-c:a','pcm_s16le'], expect: 'Jason' },
    // Quiet audio (mimics low system volume)
    { name: 'Jason 15s @ 24kHz -20dB', pre: ['-ss','5','-i',`${tmp}\\jason.wav`,'-t','15','-ar','24000','-ac','1','-af','volume=-20dB','-c:a','pcm_s16le'], expect: 'Jason' },
    { name: 'Jason 15s @ 24kHz -30dB', pre: ['-ss','5','-i',`${tmp}\\jason.wav`,'-t','15','-ar','24000','-ac','1','-af','volume=-30dB','-c:a','pcm_s16le'], expect: 'Jason' },
    // Silence padding (mimics buffer with mostly silence + bit of speech)
    { name: 'Jason 5s + 10s silence',  pre: ['-i',`${tmp}\\jason.wav`,'-af','aselect=between(t\\,5\\,10),apad=whole_dur=15','-ar','24000','-ac','1','-c:a','pcm_s16le'], expect: 'Jason' },
    { name: 'Jason 2s + 13s silence',  pre: ['-i',`${tmp}\\jason.wav`,'-af','aselect=between(t\\,5\\,7),apad=whole_dur=15','-ar','24000','-ac','1','-c:a','pcm_s16le'], expect: 'Jason' },
  ];

  console.log('Edge-case identification tests:\n');
  console.log(`test                                   | result                          | top conf`);
  console.log('─'.repeat(120));
  for (const t of tests) {
    const out = path.join(tmp, `edge-${Math.random().toString(36).slice(2,8)}.wav`);
    try {
      await ffmpeg(['-y', ...t.pre, out]);
      const r = await identify(out, vp, apiKey);
      const top = r.topName ?? '?';
      const ok = top === t.expect;
      const accept = (r.topScore ?? 0) >= 50 && (r.topScore - r.runner) >= 25;
      const verdict = accept ? (ok ? '✓ correct' : `✗ WRONG (${top})`) : `~ no-match`;
      const cs = Object.entries(r.conf || {}).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,s])=>`${n}=${s}`).join(' ');
      console.log(`${t.name.padEnd(38)} | ${(top + '@' + (r.topScore ?? '?') + ' gap=' + ((r.topScore ?? 0) - (r.runner ?? 0))).padEnd(20)} ${verdict.padEnd(18)} | ${cs}`);
    } catch (e) {
      console.log(`${t.name.padEnd(38)} | ERROR: ${e.message.slice(0, 60)}`);
    } finally {
      try { fs.unlinkSync(out); } catch {}
    }
  }
})();
