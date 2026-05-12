#!/usr/bin/env node
// Re-enroll Jason / Lon / Oliver voiceprints from the Sabi E2282 clip.
//
// Why: pyannote scores degrade through the live-app loopback path (system
// audio engine resamples, may add compression). The seed voiceprints were
// enrolled from clean source files and produce strong scores there but mis-
// rank under live conditions (observed: Jason mis-ID'd as Lon@90/gap=66).
//
// Strategy: enroll from the same source the user actually replays. Repeat
// for any new clip that mis-attributes — voiceprints get richer over time.

import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

const env = await fs.readFile(path.join(repoRoot, 'pickleglass_web', '.env.local'), 'utf-8')
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] ||= m[2].replace(/^["']|["']$/g, '')
}
const PYANNOTE_API_KEY = process.env.PYANNOTE_API_KEY
if (!PYANNOTE_API_KEY) throw new Error('PYANNOTE_API_KEY missing')

// Speaker → diarized-id mapping for THIS clip (validated by content + offline pyannote run)
const SPEAKER_MAP = { Lon: 0, Jason: 1, Oliver: 2 }

const utts = JSON.parse(await fs.readFile(path.join(here, 'sabi-utts.json'), 'utf-8'))

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    p.stderr.on('data', d => err += d)
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${err.slice(-200)}`)))
  })
}

async function pyannoteJSON(p, body, method = 'POST') {
  const res = await fetch(`https://api.pyannote.ai${p}`, {
    method,
    headers: { Authorization: `Bearer ${PYANNOTE_API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`pyannote ${p} ${res.status}: ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

async function pollJob(jobId, maxSec = 60) {
  for (let i = 0; i < maxSec / 2; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const r = await fetch(`https://api.pyannote.ai/v1/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${PYANNOTE_API_KEY}` },
    })
    if (!r.ok) throw new Error(`job poll ${r.status}`)
    const st = await r.json()
    if (st.status === 'succeeded') return st.output
    if (st.status === 'failed' || st.status === 'cancelled') throw new Error(`job ${st.status}`)
  }
  throw new Error('poll timeout')
}

async function buildSpeakerWav(speakerId, outFile) {
  // Use ffmpeg's aselect filter to keep only frames within the speaker's
  // utterance windows (single-pass, no concat fragility). Pick this speaker's
  // longest utterances up to ~14s.
  const segs = utts.filter(u => u.speaker === speakerId && u.end - u.start >= 1.5)
                   .sort((a, b) => (b.end - b.start) - (a.end - a.start))
  let total = 0, picked = []
  for (const s of segs) {
    if (total >= 14) break
    picked.push(s); total += (s.end - s.start)
  }
  if (!picked.length) throw new Error(`no utterances for speaker ${speakerId}`)
  // Build between-clauses for aselect: between(t,start,end)+between(t,start,end)+...
  const ranges = picked
    .map(s => `between(t,${s.start.toFixed(3)},${(s.end - 0.2).toFixed(3)})`)
    .join('+')
  const filter = `aselect='${ranges}',asetpts=N/SR/TB`
  await fs.mkdir(path.join(here, '_tmp_enroll'), { recursive: true })
  await runFfmpeg([
    '-y', '-i', path.join(here, 'sabi.wav'),
    '-af', filter,
    '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le',
    outFile,
  ])
  return total
}

async function enroll(name, wavPath) {
  const buf = await fs.readFile(wavPath)
  const key = `enroll-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const mediaUrl = `media://${key}`
  const { url } = await pyannoteJSON('/v1/media/input', { url: mediaUrl })
  const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'audio/wav' }, body: buf })
  if (!put.ok) throw new Error(`media PUT ${put.status}`)
  const job = await pyannoteJSON('/v1/voiceprint', { url: mediaUrl })
  const jobId = job.jobId || job.id
  if (!jobId) throw new Error('no jobId')
  const out = await pollJob(jobId, 60)
  const vp = out?.voiceprint
  if (!vp) throw new Error('no voiceprint in output')
  return typeof vp === 'string' ? vp : JSON.stringify(vp)
}

// Build samples + enroll in parallel
const seedPath = path.join(repoRoot, 'src', 'seed-voiceprints.json')
const existing = JSON.parse(await fs.readFile(seedPath, 'utf-8'))
const tasks = await Promise.all(
  Object.entries(SPEAKER_MAP).map(async ([name, sid]) => {
    const out = path.join(here, '_tmp_enroll', `${name}_combined.wav`)
    const total = await buildSpeakerWav(sid, out)
    console.log(`Built ${name} sample: ${total.toFixed(1)}s of speech from S${sid}`)
    const voiceprint = await enroll(name, out)
    console.log(`✅ Enrolled ${name} → voiceprint length ${voiceprint.length}`)
    return { name, voiceprint }
  })
)

// Replace entries by name in seed file (keep all the other speakers)
const byName = new Map(tasks.map(t => [t.name, t.voiceprint]))
const updated = existing.map(e =>
  byName.has(e.name) ? { name: e.name, voiceprint: byName.get(e.name) } : e
)
await fs.writeFile(seedPath, JSON.stringify(updated, null, 2))
console.log(`\nWrote ${seedPath}`)
console.log('Updated:', tasks.map(t => t.name).join(', '))
console.log('\nNext: restart dev electron — voiceprints are re-imported on launch.')
