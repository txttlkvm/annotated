/**
 * reenroll-jason.js
 *
 * Re-enroll Jason Calacanis from a clean YouTube clip. Overwrites the existing
 * Jason voiceprint so confidence scores climb back into the 80+ range and
 * stop being mistaken for Sacks.
 *
 * Usage:
 *   node scripts/reenroll-jason.js  [<youtube-url>]
 *
 * Default URL is a known clean solo Jason clip.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PY = 'https://api.pyannote.ai';
const DEFAULT_URL = 'https://www.youtube.com/shorts/mBpEDDHVgsA'; // Jason solo, original enrollment
const PENDING_PATH = path.join(process.env.APPDATA || '', 'annotated', 'pending-voiceprints.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const url = process.argv[2] || DEFAULT_URL;
  const apiKey = process.env.PYANNOTE_API_KEY;
  if (!apiKey) { console.error('PYANNOTE_API_KEY missing'); process.exit(1); }
  const auth = { Authorization: `Bearer ${apiKey}` };

  // 1. yt-dlp → wav
  const tmp = path.join(os.tmpdir(), `jason-${Date.now()}.wav`);
  console.log('[step 1/5] downloading audio:', url);
  const ytdlp = spawnSync('yt-dlp', [
    '-x', '--audio-format', 'wav', '--audio-quality', '0',
    '-o', tmp.replace(/\.wav$/, '.%(ext)s'),
    url,
  ], { stdio: 'inherit' });
  if (ytdlp.status !== 0) { console.error('yt-dlp failed'); process.exit(1); }
  if (!fs.existsSync(tmp)) {
    // yt-dlp may have written a slightly different filename — find the latest .wav matching our prefix
    const dir = path.dirname(tmp);
    const prefix = path.basename(tmp, '.wav');
    const found = fs.readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.wav'));
    if (found.length === 0) { console.error('no wav produced'); process.exit(1); }
    fs.renameSync(path.join(dir, found[0]), tmp);
  }
  const sizeMb = (fs.statSync(tmp).size / 1048576).toFixed(2);
  console.log(`[step 1/5] downloaded ${sizeMb} MB → ${tmp}`);

  // 2. Get presigned upload URL
  console.log('[step 2/5] requesting upload slot');
  const mediaRes = await fetch(`${PY}/v1/media/input`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: `media://reenroll-jason-${Date.now()}.wav` }),
  });
  if (!mediaRes.ok) { console.error('media/input failed:', mediaRes.status, await mediaRes.text()); process.exit(1); }
  const mediaData = await mediaRes.json();
  const presignedUrl = mediaData.url;
  const mediaUrl = mediaData.media_url || mediaData.url;

  // 3. Upload
  console.log('[step 3/5] uploading audio');
  const audioBytes = fs.readFileSync(tmp);
  const upRes = await fetch(presignedUrl, {
    method: 'PUT',
    body: audioBytes,
    headers: { 'Content-Type': 'audio/wav' },
  });
  if (!upRes.ok) { console.error('upload failed:', upRes.status); process.exit(1); }

  // 4. Voiceprint job
  console.log('[step 4/5] starting voiceprint job');
  const vpRes = await fetch(`${PY}/v1/voiceprint`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: mediaUrl }),
  });
  if (!vpRes.ok) { console.error('voiceprint failed:', vpRes.status, await vpRes.text()); process.exit(1); }
  const { jobId } = await vpRes.json();
  console.log('  jobId =', jobId);

  // 5. Poll
  console.log('[step 5/5] polling for completion');
  let voiceprint = null;
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const j = await fetch(`${PY}/v1/jobs/${jobId}`, { headers: auth });
    const jd = await j.json();
    process.stdout.write(`  status=${jd.status} `);
    if (jd.status === 'succeeded') {
      voiceprint = jd.output?.voiceprint;
      console.log('\n  ✅ done');
      break;
    }
    if (jd.status === 'canceled' || jd.status === 'failed') {
      console.log('\n  ❌', jd.status, jd.error || '');
      process.exit(1);
    }
  }
  if (!voiceprint) { console.error('timed out'); process.exit(1); }

  // Queue for the running Annotated app to import on next startup. Uses a
  // unique name suffix so the app's findByName lookup misses, then the
  // saveVoiceprint ON CONFLICT(pyannote_id) DO UPDATE clause replaces the
  // old voiceprint blob even though the name field stays "Jason".
  fs.mkdirSync(path.dirname(PENDING_PATH), { recursive: true });
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8')); } catch (_) {}
  // Replace any stale Jason entry first
  existing = existing.filter(e => e.name !== 'Jason');
  existing.push({ name: 'Jason', voiceprint });
  fs.writeFileSync(PENDING_PATH, JSON.stringify(existing, null, 2));
  console.log(`\n[done] queued fresh Jason voiceprint at ${PENDING_PATH}`);
  console.log('Restart Annotated to pick it up (or the seed marker auto-handles it).');

  // Cleanup
  try { fs.unlinkSync(tmp); } catch (_) {}
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
