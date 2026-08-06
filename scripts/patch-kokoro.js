#!/usr/bin/env node
// Metro's Babel transform rejects any import() call whose argument isn't a
// static string literal (same class of issue as the pdfjs-dist patch in
// patches/). kokoro-js's bundled onnxruntime-web ships one such call, used
// only for its optional worker-proxy path: `async e=>(await import(e)).default`.
// A real patch-package diff for this is unusable here -- kokoro.web.js is a
// single 2MB+ minified line, so a line-granularity diff is the whole file --
// so this does the one-substring fix directly instead of via a patch file.
//
// Wrapping the import in `new Function(...)` hides it from Metro's static
// AST scan (it's inside a string until the Function constructor compiles it
// at runtime) while still using the browser's real dynamic import when that
// code path actually runs.

const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'kokoro-js', 'dist', 'kokoro.web.js');
const FROM = 'je=async e=>(await import(e)).default,';
const TO = 'je=async e=>(await new Function("u","return import(u)")(e)).default,';

if (!fs.existsSync(target)) {
  console.log('[patch-kokoro] kokoro-js not installed, skipping.');
  process.exit(0);
}

const contents = fs.readFileSync(target, 'utf8');
if (contents.includes(TO)) {
  console.log('[patch-kokoro] already patched.');
  process.exit(0);
}
if (!contents.includes(FROM)) {
  console.error('[patch-kokoro] expected pattern not found -- kokoro-js likely changed version. Update scripts/patch-kokoro.js.');
  process.exit(1);
}

fs.writeFileSync(target, contents.replace(FROM, TO));
console.log('[patch-kokoro] patched kokoro-js/dist/kokoro.web.js for Metro.');
