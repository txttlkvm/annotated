/**
 * dump-voiceprints.js
 * Reads voiceprints from the dev SQLite DB and emits a JSON file the app
 * can consume on first run to seed Jason / Lon / etc. without manual enrollment.
 *
 * Output: src/seed-voiceprints.json
 *
 * Run via:  npm run dump:voiceprints
 *           (or: ./node_modules/.bin/electron scripts/dump-voiceprints.js)
 */
const path = require('path');
const fs   = require('fs');
const { app } = require('electron');

// Override the userData path so we read from the production app's DB,
// not Electron's default 'Roaming/Electron' sandbox.
app.setName('annotated');
app.setPath('userData', path.join(process.env.APPDATA || '', 'annotated'));

app.whenReady().then(() => {
  const Database = require('better-sqlite3');
  const dbPath = path.join(app.getPath('userData'), 'pickleglass.db');
  if (!fs.existsSync(dbPath)) {
    console.error('[dump] no DB at', dbPath);
    app.exit(1);
    return;
  }
  const db = new Database(dbPath, { readonly: true });
  let rows = [];
  try {
    rows = db.prepare('SELECT name, pyannote_id, created_at FROM voiceprints ORDER BY created_at').all();
  } catch (e) {
    console.error('[dump] query failed:', e.message);
    app.exit(1);
    return;
  }
  const out = rows.map(r => ({ name: r.name, voiceprint: r.pyannote_id }));
  const dest = path.join(__dirname, '..', 'src', 'seed-voiceprints.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(`[dump] wrote ${out.length} voiceprint(s) to ${dest}:`);
  for (const r of out) console.log(`  - ${r.name}`);
  app.exit(0);
});
