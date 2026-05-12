// Find where in a WAV file the audio actually starts, and where the spike is.
const fs = require('fs');
const path = require('path');
const os = require('os');

const dir = path.join(os.tmpdir(), 'annotated-identify-samples');
const file = process.argv[2] || 'identify-1778258061301-7s.wav';
const buf = fs.readFileSync(path.join(dir, file));
const pcm = buf.slice(44);
const totalSamples = pcm.length / 2;
console.log(`File ${file}: ${totalSamples} samples (${(totalSamples / 24000).toFixed(2)}s)\n`);

let firstNonzero = -1;
let maxSeen = 0;
let maxAt = -1;
for (let i = 0; i < totalSamples; i++) {
  const s = pcm.readInt16LE(i * 2);
  if (s !== 0 && firstNonzero === -1) firstNonzero = i;
  if (Math.abs(s) > maxSeen) { maxSeen = Math.abs(s); maxAt = i; }
}
console.log(`First non-zero sample: index ${firstNonzero} (${(firstNonzero / 24000).toFixed(3)}s in)`);
console.log(`Max abs value: ${maxSeen} at index ${maxAt} (${(maxAt / 24000).toFixed(3)}s)`);

// Show context around the max
const start = Math.max(0, maxAt - 5);
const end = Math.min(totalSamples, maxAt + 6);
console.log(`\nContext around peak (samples ${start}-${end-1}):`);
for (let i = start; i < end; i++) {
  console.log(`  [${i}] = ${pcm.readInt16LE(i * 2)}`);
}

// Also check for DC offset: average value
let sum = 0;
for (let i = 0; i < totalSamples; i++) sum += pcm.readInt16LE(i * 2);
console.log(`\nDC offset (average): ${(sum / totalSamples).toFixed(2)}`);

// Distribution of zero-runs (long silent stretches)
let curRun = 0;
const runs = [];
for (let i = 0; i < totalSamples; i++) {
  const s = pcm.readInt16LE(i * 2);
  if (Math.abs(s) < 50) curRun++;
  else { if (curRun > 100) runs.push(curRun); curRun = 0; }
}
console.log(`Silent runs (>100 samples): ${runs.length}`);
console.log(`Longest silent stretch: ${runs.length ? Math.max(...runs) : 0} samples (${runs.length ? (Math.max(...runs)/24000).toFixed(2) : 0}s)`);
