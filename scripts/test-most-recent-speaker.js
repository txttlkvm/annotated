// Verify "most-recent speaker" picks the right person when audio is mixed.
// Concatenate Jason audio + Lon audio. Identify should return Lon (the
// speaker at the END of the buffer), not Jason (who dominates by duration).
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
    try { const a = JSON.parse(fs.readFileSync(path.join(PENDING_DIR, f), 'utf8')); for (const e of a) if (!seen.has(e.name)) { seen.add(e.name); out.push(e); } } catch {}
  }
  return out;
}
async function jc(p, b, key) { const r = await fetch(PY+p, { method:'POST', headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'}, body:JSON.stringify(b) }); const t=await r.text(); if(!r.ok)throw new Error(`${p} ${r.status}: ${t.slice(0,200)}`); return JSON.parse(t); }
async function poll(id, key) { for(let i=0;i<120;i++){await sleep(2000);const r=await fetch(`${PY}/v1/jobs/${id}`,{headers:{Authorization:`Bearer ${key}`}});const s=await r.json();if(s.status==='succeeded')return s.output;if(s.status==='failed')throw new Error('failed');}throw new Error('timeout'); }
function ff(args) { return new Promise((r, j) => { const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] }); let e = ''; p.stderr.on('data', c => e += c.toString()); p.on('close', c => c === 0 ? r() : j(new Error(e.slice(0,200)))); }); }
async function upload(buf, key) { const url = `media://recent-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; const u = await jc('/v1/media/input', { url }, key); const put = await fetch(u.url, { method:'PUT', headers:{'Content-Type':'audio/wav'}, body:buf }); if (!put.ok) throw new Error(`s3 ${put.status}`); return url; }

(async () => {
  const apiKey = process.env.PYANNOTE_API_KEY;
  const known = loadKnown();
  const vp = known.map(k => ({ label: k.name, voiceprint: k.voiceprint }));
  const tmp = path.join(os.tmpdir(), 'voiceprints');

  // Build mixed audio scenarios:
  //   1. 45s Jason + 15s Lon → most-recent = Lon (correct: identify says Lon)
  //   2. 15s Lon + 45s Jason → most-recent = Jason (correct: identify says Jason)
  //   3. 50s Lon + 10s Jason → most-recent = Jason
  //   4. 10s Jason + 50s Lon → most-recent = Lon
  const scenarios = [
    { name: '45s-Jason then 15s-Lon',  parts: [{ src: 'jason.wav', start: 5, dur: 45 }, { src: 'lon.wav', start: 5, dur: 15 }], expected: 'Lon' },
    { name: '15s-Lon then 45s-Jason',  parts: [{ src: 'lon.wav', start: 5, dur: 15 }, { src: 'jason.wav', start: 5, dur: 45 }], expected: 'Jason' },
    { name: '50s-Lon then 10s-Jason',  parts: [{ src: 'lon.wav', start: 5, dur: 50 }, { src: 'jason.wav', start: 5, dur: 10 }], expected: 'Jason' },
    { name: '10s-Jason then 50s-Lon',  parts: [{ src: 'jason.wav', start: 5, dur: 10 }, { src: 'lon.wav', start: 5, dur: 50 }], expected: 'Lon' },
  ];

  for (const sc of scenarios) {
    const partFiles = [];
    for (let i = 0; i < sc.parts.length; i++) {
      const p = sc.parts[i];
      const out = path.join(tmp, `recent-part-${i}.wav`);
      await ff(['-y', '-ss', String(p.start), '-i', path.join(tmp, p.src), '-t', String(p.dur), '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', out]);
      partFiles.push(out);
    }
    const concatList = path.join(tmp, 'recent-concat.txt');
    fs.writeFileSync(concatList, partFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
    const merged = path.join(tmp, 'recent-merged.wav');
    await ff(['-y', '-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', merged]);

    const buf = fs.readFileSync(merged);
    const url = await upload(buf, apiKey);
    const job = await jc('/v1/identify', { url, voiceprints: vp }, apiKey);
    const out = await poll(job.jobId || job.id, apiKey);
    const diar = out?.diarization || [];
    const vps  = out?.voiceprints || [];

    // Apply our NEW "speaker of last 15s" logic
    let totalDur = 0;
    for (const seg of diar) totalDur = Math.max(totalDur, Number(seg.end));
    const cutoff = Math.max(0, totalDur - 15);
    const recentDur = {}, dur = {};
    for (const seg of diar) {
      const sp = seg.speaker;
      const start = Number(seg.start), end = Number(seg.end);
      dur[sp] = (dur[sp] || 0) + (end - start);
      if (end > cutoff) recentDur[sp] = (recentDur[sp] || 0) + (end - Math.max(start, cutoff));
    }
    const ranked = Object.entries(recentDur).filter(([, d]) => d >= 2).sort((a, b) => b[1] - a[1]);
    const recentSpeaker = ranked[0]?.[0];
    const t = vps.find(v => v.speaker === recentSpeaker);
    const conf = t?.confidence || {};
    const cr = Object.entries(conf).sort((a, b) => b[1] - a[1]);
    const top = cr[0]?.[0] || '?';
    const score = cr[0]?.[1] || 0;
    const ok = top === sc.expected;
    const verdict = ok ? '✓ correct' : `✗ WRONG (said ${top}, expected ${sc.expected})`;

    // Also show what the OLD (dominant) logic would have picked
    const dominant = Object.entries(dur).sort((a,b)=>b[1]-a[1])[0]?.[0];
    const dt = vps.find(v => v.speaker === dominant);
    const dconf = dt?.confidence || {};
    const dr = Object.entries(dconf).sort((a,b)=>b[1]-a[1]);
    const oldTop = dr[0]?.[0] || '?';

    console.log(`${sc.name.padEnd(35)} | recent=${recentSpeaker}@${score} → ${top.padEnd(8)} ${verdict}`);
    console.log(`${' '.repeat(35)} | recentDur=${JSON.stringify(recentDur)}`);
    console.log(`${' '.repeat(35)} | dominant=${dominant} would have said: ${oldTop}`);
    // Show last 20s of segments
    const recent = diar.filter(s => Number(s.end) > totalDur - 20).sort((a,b) => Number(a.start)-Number(b.start));
    console.log(`${' '.repeat(35)} | last-20s segments: ${recent.slice(0,8).map(s => `${s.speaker}@${Number(s.start).toFixed(1)}-${Number(s.end).toFixed(1)}`).join(' ')}`);
    for (const f of partFiles) { try { fs.unlinkSync(f); } catch {} }
    try { fs.unlinkSync(merged); fs.unlinkSync(concatList); } catch {}
  }
})();
