// Enroll a NEW voiceprint from a saved production sample, then test it
// against OTHER saved samples to see if they all match. If yes, the live
// capture is altering audio so much that direct YouTube enrollments don't
// generalize, but live-captured enrollments do.
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PENDING_DIR = path.join(process.env.APPDATA || '', 'annotated');
const PY = 'https://api.pyannote.ai';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function jc(p, b, key) { const r = await fetch(PY+p, { method:'POST', headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'}, body:JSON.stringify(b) }); const t=await r.text(); if(!r.ok)throw new Error(`${p} ${r.status}: ${t.slice(0,200)}`); return JSON.parse(t); }
async function poll(id, key) { for(let i=0;i<120;i++){await sleep(2000);const r=await fetch(`${PY}/v1/jobs/${id}`,{headers:{Authorization:`Bearer ${key}`}});const s=await r.json();if(s.status==='succeeded')return s.output;if(s.status==='failed')throw new Error('failed');}throw new Error('timeout'); }
async function upload(buf, key) { const url=`media://prodtest-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; const u=await jc('/v1/media/input',{url},key); const put=await fetch(u.url,{method:'PUT',headers:{'Content-Type':'audio/wav'},body:buf}); if(!put.ok)throw new Error(`s3 ${put.status}`); return url; }

(async () => {
  const apiKey = process.env.PYANNOTE_API_KEY;
  const samplesDir = path.join(os.tmpdir(), 'annotated-identify-samples');
  const samples = fs.readdirSync(samplesDir).filter(f => f.endsWith('.wav')).map(f => path.join(samplesDir, f));

  // Pick the longest sample as enrollment source
  const withSizes = samples.map(p => ({ p, sz: fs.statSync(p).size }));
  withSizes.sort((a, b) => b.sz - a.sz);
  const enrollSrc = withSizes[0].p;
  console.log(`Enrollment source: ${path.basename(enrollSrc)} (${(withSizes[0].sz/1024).toFixed(0)} KB)\n`);

  // Generate voiceprint from this live-captured audio
  const buf = fs.readFileSync(enrollSrc);
  const url = await upload(buf, apiKey);
  const job = await jc('/v1/voiceprint', { url }, apiKey);
  const out = await poll(job.jobId || job.id, apiKey);
  const vpStr = typeof out === 'string' ? out : (out.voiceprint || JSON.stringify(out));
  console.log(`Generated voiceprint: ${vpStr.length} chars\n`);

  // Now test ALL other production samples against this new voiceprint + the existing bank
  const known = (() => {
    const files = fs.readdirSync(PENDING_DIR).filter(n => n.startsWith('pending-voiceprints.json.imported.'));
    const seen = new Set(), out = [];
    for (const f of files.sort().reverse()) {
      try { const a = JSON.parse(fs.readFileSync(path.join(PENDING_DIR, f), 'utf8')); for (const e of a) if (!seen.has(e.name)) { seen.add(e.name); out.push(e); } } catch {}
    }
    return out;
  })();
  const vp = [...known.map(k => ({ label: k.name, voiceprint: k.voiceprint })), { label: 'LiveSample', voiceprint: vpStr }];

  console.log('Testing all production samples against bank + new "LiveSample" voiceprint:\n');
  for (const s of samples) {
    const buf = fs.readFileSync(s);
    const url = await upload(buf, apiKey);
    const job = await jc('/v1/identify', { url, voiceprints: vp }, apiKey);
    const out = await poll(job.jobId || job.id, apiKey);
    const vps = out?.voiceprints || [];
    const diar = out?.diarization || [];
    const dur = {};
    for (const seg of diar) dur[seg.speaker] = (dur[seg.speaker] || 0) + (seg.end - seg.start);
    const dom = Object.entries(dur).sort((a,b)=>b[1]-a[1])[0]?.[0];
    const t = vps.find(v => v.speaker === dom) || vps[0];
    const conf = t?.confidence || {};
    const ranked = Object.entries(conf).sort((a,b)=>b[1]-a[1]);
    const top4 = ranked.slice(0,4).map(([n,sc])=>`${n}=${sc}`).join(' ');
    console.log(`${path.basename(s).padEnd(40)} ${top4}`);
  }
})();
