// Analyze production audio samples — RMS, peak, content distribution.
const fs = require('fs');
const path = require('path');
const os = require('os');

const dir = path.join(os.tmpdir(), 'annotated-identify-samples');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.wav'));

for (const f of files) {
  const buf = fs.readFileSync(path.join(dir, f));
  const pcm = buf.slice(44); // strip WAV header
  const n = pcm.length / 2;
  let sumSq = 0, peak = 0, zero = 0;
  for (let i = 0; i < pcm.length - 1; i += 2) {
    const s = pcm.readInt16LE(i);
    sumSq += s * s;
    peak = Math.max(peak, Math.abs(s));
    if (s === 0) zero++;
  }
  const rms = Math.sqrt(sumSq / n);
  console.log(`${f}:`);
  console.log(`  duration: ${(n / 24000).toFixed(1)}s`);
  console.log(`  RMS: ${rms.toFixed(0)}`);
  console.log(`  peak: ${peak} (${(peak / 32767 * 100).toFixed(1)}% of max)`);
  console.log(`  zeros: ${(zero / n * 100).toFixed(1)}%`);
  // sample distribution check
  const maxAbsList = [];
  const winSize = 24000; // 1s windows
  for (let off = 0; off < pcm.length - winSize * 2; off += winSize * 2) {
    let m = 0;
    for (let i = 0; i < winSize * 2; i += 2) {
      const s = Math.abs(pcm.readInt16LE(off + i));
      if (s > m) m = s;
    }
    maxAbsList.push(m);
  }
  console.log(`  per-second peaks: [${maxAbsList.join(', ')}]`);
  console.log('');
}
