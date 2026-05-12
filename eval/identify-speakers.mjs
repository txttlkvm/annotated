#!/usr/bin/env node
// Extract per-speaker audio clips from sabi-utts.json + sabi.wav, run them
// through pyannote /v1/identify against the seeded voiceprints, and print
// the matched name. This proves the live app would attribute each diarized
// speaker to the correct real person.

import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

// Env
const env = await fs.readFile(path.join(repoRoot, 'pickleglass_web', '.env.local'), 'utf-8')
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] ||= m[2].replace(/^["']|["']$/g, '')
}
const PYANNOTE_API_KEY = process.env.PYANNOTE_API_KEY
if (!PYANNOTE_API_KEY) throw new Error('PYANNOTE_API_KEY missing')

// Load utterances + seed voiceprints
const utts = JSON.parse(await fs.readFile(path.join(here, 'sabi-utts.json'), 'utf-8'))
const seed = JSON.parse(await fs.readFile(path.join(repoRoot, 'src', 'seed-voiceprints.json'), 'utf-8'))
console.log(`Seed voiceprints: ${seed.map(s => s.name).join(', ')}`)

// Group utterances by speaker, pick chunks where speaker is talking (skip last 1s as buffer)
const bySpeaker = {}
for (const u of utts) {
  if (u.end - u.start < 1.5) continue
  if (!bySpeaker[u.speaker]) bySpeaker[u.speaker] = []
  bySpeaker[u.speaker].push({ start: u.start, end: u.end - 0.2 })
}

// For each speaker, build a 12-15s sample by concatenating their longest utterances
async function extractSpeakerAudio(speaker, segments, outFile) {
  const sorted = [...segments].sort((a, b) => (b.end - b.start) - (a.end - a.start))
  let total = 0, picked = []
  for (const s of sorted) {
    if (total >= 14) break
    const dur = s.end - s.start
    picked.push(s)
    total += dur
  }
  // ffmpeg concat using -ss/-t per segment, written to a list file
  const tmpDir = path.join(here, '_tmp_speakers')
  await fs.mkdir(tmpDir, { recursive: true })
  const partFiles = []
  for (let i = 0; i < picked.length; i++) {
    const seg = picked[i]
    const part = path.join(tmpDir, `s${speaker}_${i}.wav`)
    await runFfmpeg([
      '-y', '-ss', String(seg.start), '-t', String(seg.end - seg.start),
      '-i', path.join(here, 'sabi.wav'),
      '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', part,
    ])
    partFiles.push(part)
  }
  // Concat
  const list = partFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n')
  const listFile = path.join(tmpDir, `s${speaker}_list.txt`)
  await fs.writeFile(listFile, list)
  await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outFile])
  const stats = await fs.stat(outFile)
  return { total, segments: picked.length, bytes: stats.size }
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    p.stderr.on('data', d => err += d)
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-300)}`)))
  })
}

async function pyannoteJSON(pathSeg, body, method = 'POST') {
  const res = await fetch(`https://api.pyannote.ai${pathSeg}`, {
    method,
    headers: { Authorization: `Bearer ${PYANNOTE_API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`pyannote ${pathSeg} ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text)
}

async function pollJob(jobId, maxSec = 60) {
  for (let i = 0; i < maxSec / 2; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const res = await fetch(`https://api.pyannote.ai/v1/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${PYANNOTE_API_KEY}` },
    })
    if (!res.ok) throw new Error(`job poll ${res.status}`)
    const st = await res.json()
    if (st.status === 'succeeded') return st.output
    if (st.status === 'failed' || st.status === 'cancelled') throw new Error(`job ${st.status}`)
  }
  throw new Error('poll timeout')
}

async function identifySpeaker(wavPath) {
  const buf = await fs.readFile(wavPath)
  // Upload via /v1/media/input
  const key = `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const mediaUrl = `media://${key}`
  const { url } = await pyannoteJSON('/v1/media/input', { url: mediaUrl })
  const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'audio/wav' }, body: buf })
  if (!put.ok) throw new Error(`media PUT failed ${put.status}: ${await put.text().catch(() => '')}`)
  // Submit identify job
  const voiceprints = seed.map(v => ({ label: v.name, voiceprint: v.voiceprint }))
  const job = await pyannoteJSON('/v1/identify', { url: mediaUrl, voiceprints })
  const jobId = job.jobId || job.id
  if (!jobId) throw new Error('no jobId in identify response')
  const output = await pollJob(jobId, 60)
  return output
}

// Main
const speakers = Object.keys(bySpeaker).sort()
console.log(`Diarized speakers in clip: ${speakers.map(s => `S${s} (${bySpeaker[s].length} utts)`).join(', ')}\n`)

const results = []
for (const sp of speakers) {
  const outFile = path.join(here, `_tmp_speakers`, `speaker_${sp}_combined.wav`)
  console.log(`\n── Speaker S${sp} ──`)
  const { total, segments, bytes } = await extractSpeakerAudio(sp, bySpeaker[sp], outFile)
  console.log(`  Built sample: ${total.toFixed(1)}s across ${segments} segments, ${bytes} bytes`)
  console.log(`  Submitting to pyannote /v1/identify...`)
  try {
    const out = await identifySpeaker(outFile)
    const vps = out.voiceprints || []
    if (vps.length === 0) {
      console.log(`  ❌ no voiceprints array returned`)
      continue
    }
    // The output has one entry per diarized speaker in OUR sample (should be 1)
    for (const v of vps) {
      const conf = v.confidence || {}
      const sorted = Object.entries(conf).sort((a, b) => b[1] - a[1])
      const [winnerName, winnerScore] = sorted[0] || ['?', 0]
      const [runnerName, runnerScore] = sorted[1] || ['?', 0]
      const margin = winnerScore - runnerScore
      const gateOk = winnerScore >= 50 && margin >= 25
      console.log(`  pyannote diar=${v.speaker}  match=${v.match || '?'}`)
      console.log(`  winner: ${winnerName}@${winnerScore.toFixed(1)}  runner: ${runnerName}@${runnerScore.toFixed(1)}  margin=${margin.toFixed(1)}  ${gateOk ? '✅ STRICT' : '⚠ below strict gate'}`)
      console.log(`  top scores: ${sorted.slice(0, 5).map(([n, s]) => `${n}=${s.toFixed(1)}`).join('  ')}`)
      results.push({ speaker: sp, winner: winnerName, score: winnerScore, runner: runnerName, runnerScore, gateOk })
    }
  } catch (e) {
    console.log(`  ❌ identify failed: ${e.message}`)
  }
}

console.log('\n\n══ FINAL ATTRIBUTION ══')
for (const r of results) {
  console.log(`  S${r.speaker} → ${r.winner} (${r.score.toFixed(1)}, beats ${r.runner}@${r.runnerScore.toFixed(1)} by ${(r.score - r.runnerScore).toFixed(1)})${r.gateOk ? '' : '  ⚠'}`)
}
await fs.writeFile(path.join(here, 'speaker-attribution.json'), JSON.stringify(results, null, 2))
console.log('\nWrote eval/speaker-attribution.json')
