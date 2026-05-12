// Standalone voiceprint enrollment via pyannoteAI Premium API.
//
// Flow:
//   1. POST /v1/media/input  → returns presigned S3 URL
//   2. PUT  <s3 url>          → upload audio bytes
//   3. POST /v1/voiceprint   { url: "media://<key>" } → returns jobId
//   4. Poll /v1/jobs/<jobId> until status === "succeeded"
//   5. Save { name, voiceprint } to local SQLite
//
// Usage:
//   node scripts/enroll-voiceprint.js <name> <audio-file>
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Pending voiceprints get queued here as JSON; the running Electron app
// auto-imports them into SQLite on next startup or via tray menu refresh.
// (We avoid loading better-sqlite3 here because it's compiled for Electron's
// Node ABI, not system Node.)
const PENDING_PATH = path.join(process.env.APPDATA || '', 'annotated', 'pending-voiceprints.json');
const PY = 'https://api.pyannote.ai';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const [, , name, filePath] = process.argv;
  if (!name || !filePath) {
    console.error('usage: node scripts/enroll-voiceprint.js <name> <audio-file>');
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error('audio file not found:', filePath);
    process.exit(1);
  }
  const apiKey = process.env.PYANNOTE_API_KEY;
  if (!apiKey) {
    console.error('PYANNOTE_API_KEY not set in .env');
    process.exit(1);
  }
  const auth = { Authorization: `Bearer ${apiKey}` };

  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === '.mp3'  ? 'audio/mpeg' :
    ext === '.wav'  ? 'audio/wav'  :
    ext === '.flac' ? 'audio/flac' :
    ext === '.m4a'  ? 'audio/mp4'  :
    ext === '.ogg' || ext === '.opus' ? 'audio/ogg' :
    'application/octet-stream';

  const mediaKey = `voiceprint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const mediaUrl = `media://${mediaKey}`;

  // 1. Get presigned upload URL
  console.log(`[1/4] requesting upload URL for ${mediaUrl}`);
  const uploadRes = await fetch(`${PY}/v1/media/input`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: mediaUrl }),
  });
  if (!uploadRes.ok) {
    console.error('media/input failed', uploadRes.status, await uploadRes.text());
    process.exit(1);
  }
  const { url: presignedUrl } = await uploadRes.json();

  // 2. Upload audio bytes via PUT
  console.log(`[2/4] uploading ${(buf.length/1024).toFixed(0)}KB audio…`);
  const putRes = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: buf,
  });
  if (!putRes.ok) {
    console.error('s3 upload failed', putRes.status, await putRes.text());
    process.exit(1);
  }

  // 3. Start voiceprint job
  console.log(`[3/4] starting voiceprint job…`);
  const jobRes = await fetch(`${PY}/v1/voiceprint`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: mediaUrl }),
  });
  if (!jobRes.ok) {
    console.error('voiceprint job creation failed', jobRes.status, await jobRes.text());
    process.exit(1);
  }
  const jobBody = await jobRes.json();
  const jobId = jobBody.jobId || jobBody.id;
  if (!jobId) {
    console.error('no jobId in response', jobBody);
    process.exit(1);
  }
  console.log(`     jobId=${jobId}`);

  // 4. Poll for completion
  console.log(`[4/4] polling job…`);
  let voiceprint = null;
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const stRes = await fetch(`${PY}/v1/jobs/${jobId}`, { headers: auth });
    if (!stRes.ok) {
      console.error('job poll failed', stRes.status, await stRes.text());
      process.exit(1);
    }
    const st = await stRes.json();
    process.stdout.write(`\r     status=${st.status}                    `);
    if (st.status === 'succeeded') {
      voiceprint = st.output?.voiceprint || st.output?.voiceprintId || st.output?.id || st.output;
      console.log('');
      break;
    }
    if (st.status === 'failed' || st.status === 'cancelled') {
      console.error('\njob failed:', JSON.stringify(st));
      process.exit(1);
    }
  }
  if (!voiceprint) {
    console.error('\njob did not complete in time');
    process.exit(1);
  }

  // 5. Persist to a pending-voiceprints JSON file. The Electron app picks
  //    these up on startup (or via tray "Reload voiceprints") and inserts
  //    into SQLite proper.
  const voiceprintStr = typeof voiceprint === 'string' ? voiceprint : JSON.stringify(voiceprint);
  fs.mkdirSync(path.dirname(PENDING_PATH), { recursive: true });
  let pending = [];
  if (fs.existsSync(PENDING_PATH)) {
    try { pending = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8')); } catch {}
  }
  // De-dupe by name
  pending = pending.filter(e => e.name !== name);
  pending.push({ name, voiceprint: voiceprintStr, created_at: Date.now() });
  fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2));
  console.log(`✅ queued "${name}" (${voiceprintStr.length} chars) → ${PENDING_PATH}`);
  console.log(`   The running Annotated app will import this on next startup.`);
}

main().catch(e => { console.error('failed:', e.message); process.exit(1); });
