import fs from 'node:fs/promises'
const env = await fs.readFile('../pickleglass_web/.env.local', 'utf-8')
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] ||= m[2].replace(/^["']|["']$/g, '')
}
const KEY = process.env.PYANNOTE_API_KEY

// Hit /v1/usage or similar — first check what endpoints respond
for (const path of ['/v1/usage', '/v1/billing', '/v1/account', '/v1/me']) {
  const r = await fetch('https://api.pyannote.ai' + path, {
    headers: { Authorization: `Bearer ${KEY}` },
  })
  const text = await r.text()
  console.log(`GET ${path} → ${r.status}: ${text.slice(0, 200)}`)
}

// Quick identify test (small WAV) to see if identify also denied
const wav = await fs.readFile('sabi.wav')
const small = wav.slice(0, 16000 * 2 * 6 + 44)  // 6s
const key = `cred-test-${Date.now()}`
const url = 'media://' + key
const r1 = await fetch('https://api.pyannote.ai/v1/media/input', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ url }),
})
console.log('POST /v1/media/input →', r1.status)
if (r1.ok) {
  const { url: putUrl } = await r1.json()
  await fetch(putUrl, { method: 'PUT', headers: { 'Content-Type': 'audio/wav' }, body: small })
  // Try identify with empty voiceprints to see if endpoint itself is blocked
  const r2 = await fetch('https://api.pyannote.ai/v1/identify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, voiceprints: [{ label: 'test', voiceprint: 'placeholder' }] }),
  })
  const t2 = await r2.text()
  console.log('POST /v1/identify →', r2.status, t2.slice(0, 300))
}
