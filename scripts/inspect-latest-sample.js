// Run pyannote on the latest saved production sample and dump full confidence
// breakdown across all 9 voiceprints.
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
    try { const a = JSON.parse(fs.readFileSync(path.join(PENDING_DIR, f), 'utf8')); for (const e of a) if (!seen.has(e.name)) { seen.add(e.name); out.push(e); } } catch {}
  }
  return out;
}
async function jc(p, b, key) { const r = await fetch(PY+p, { method:'POST', headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'}, body:JSON.stringify(b) }); const t=await r.text(); if(!r.ok)throw new Error(`${p} ${r.status}: ${t.slice(0,200)}`); return JSON.parse(t); }
async function poll(id, key) { for(let i=0;i<120;i++){await sleep(2000);const r=await fetch(`${PY}/v1/jobs/${id}`,{headers:{Authorization:`Bearer ${key}`}});const s=await r.json();if(s.status==='succeeded')return s.output;if(s.status==='failed')throw new Error('failed');}throw new Error('timeout'); }
async function upload(buf, key) { const url = `media://inspect-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; const u = await jc('/v1/media/input', { url }, key); const put = await fetch(u.url, { method:'PUT', headers:{'Content-Type':'audio/wav'}, body:buf }); if (!put.ok) throw new Error(`s3 ${put.status}`); return url; }

(async () => {
  const apiKey = process.env.PYANNOTE_API_KEY;
  const known = loadKnown();
  const vp = known.map(k => ({ label: k.name, voiceprint: k.voiceprint }));
  const dir = path.join(os.tmpdir(), 'annotated-identify-samples');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.wav'));
  // Sort by timestamp in name (descending) — most recent first
  files.sort((a, b) => {
    const ta = parseInt((a.match(/identify-(\d+)/) || [0,0])[1]);
    const tb = parseInt((b.match(/identify-(\d+)/) || [0,0])[1]);
    return tb - ta;
  });
  // Inspect last 3 samples
  for (const f of files.slice(0, 3)) {
    const filePath = path.join(dir, f);
    const buf = fs.readFileSync(filePath);
    console.log(`\n=== ${f} (${(buf.length/1024).toFixed(0)} KB) ===`);
    try {
      const url = await upload(buf, apiKey);
      const job = await jc('/v1/identify', { url, voiceprints: vp }, apiKey);
      const out = await poll(job.jobId || job.id, apiKey);
      const diar = out?.diarization || [];
      const vps = out?.voiceprints || [];
      console.log(`Diarization: ${diar.length} segments`);
      const dur = {}, lastEnd = {};
      for (const seg of diar) {
        const sp = seg.speaker;
        const e = Number(seg.end);
        const s = Number(seg.start);
        dur[sp] = (dur[sp] || 0) + (e - s);
        if (lastEnd[sp] === undefined || e > lastEnd[sp]) lastEnd[sp] = e;
      }
      for (const v of vps) {
        const conf = v.confidence || {};
        const ranked = Object.entries(conf).sort((a, b) => b[1] - a[1]);
        const dr = (dur[v.speaker] || 0).toFixed(1);
        const le = (lastEnd[v.speaker] || 0).toFixed(1);
        console.log(`  ${v.speaker}  ${dr}s total / ends @ ${le}s`);
        console.log(`    ${ranked.map(([n,sc])=>`${n}=${sc}`).join('  ')}`);
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }
  }
})();
