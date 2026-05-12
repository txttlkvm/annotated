/**
 * appDetector.js
 * Two independent detection loops:
 *   NATIVE  — wmic process query (~750ms), polls every 500ms → ~1.25s per cycle
 *   BROWSER — PowerShell window-title check (~3s),  polls every 3s  → ~6s per cycle
 *
 * Either loop returning true shows the overlay.
 * Native covers Zoom/OBS/Teams/etc.; browser covers YouTube/Meet in Chrome.
 */

const { execFile } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { windowPool } = require('../../window/windowManager');
const listenService  = require('../listen/listenService');
const WmiWatcher     = require('./wmiWatcher');
const ZoomActiveSpeaker = require('./zoomActiveSpeaker');

// WMI events give us instant start/stop notifications. Polling is kept as a
// backstop in case events are missed, but the cadence is relaxed since events
// handle the fast path.
const NATIVE_POLL_MS = 750;   // tasklist is fast (~150-300ms) so we can poll aggressively
const TITLE_POLL_MS  = 2500;  // PS browser-title check (no event API for browser tabs)
const STICKY_MS      = 30000; // ignore WMIC false negatives within 30s of a true reading

let _lastWmicTrueAt = 0;

const _logFile = path.join(os.homedir(), 'annotated-debug.log');
function _log(...args) {
  const line = `[${new Date().toISOString()}] [AppDetector] ${args.join(' ')}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(_logFile, line); } catch {}
}

// Desktop processes whose presence means "show overlay"
const TRIGGER_PROCESSES_WIN = [
  'zoom.exe',           // Zoom (classic)
  'zoomworkplace.exe',  // Zoom Workplace (2024+ rebrand)
  'cpthost.exe',        // Zoom Workplace renderer process (Windows)
  'obs64.exe',          // OBS Studio
  'obs32.exe',
  'obs.exe',
  'loom.exe',           // Loom desktop
  'teams.exe',          // Microsoft Teams (classic)
  'ms-teams.exe',       // Microsoft Teams (new)
  'webex.exe',          // Cisco Webex
  'ciscowebexstart.exe',
  'discord.exe',        // Discord (calls)
  'slack.exe',          // Slack huddles
  'streamlabs obs.exe',
  'streamlabs.exe',
];

const TRIGGER_PROCESSES_MAC = [
  'zoom.us',
  'obs',
  'Loom',
  'Microsoft Teams',
  'Cisco Webex',
  'WebexHelper',
  'Discord',
  'Slack',
  'Streamlabs',
];

// Browser window-title substrings that trigger the overlay (browser loop only).
// IMPORTANT: never include a pattern starting with '|' (it creates an empty
// regex alternation that silently breaks PowerShell -match). Use "Meet -" or
// similar instead.
const TITLE_PATTERNS = [
  'YouTube',
  'YouTube Studio',
  'Google Meet',
  'Meet -',
  'Riverside',
  'Squadcast',
  'Zencastr',
  'StreamYard',
  'Loom',
  'Zoom',
  'Twitch',
  'Webex',
  'Teams',
  'Discord',
  'Whereby',
  'Daily.co',
  'Restream',
  'Streamyard',
  'Spotify',
  'Apple Podcasts',
  'Overcast',
  'Audible',
  'TWiST',
  'All-In',
  'Podcast',             // any podcast browser tab
  'X Spaces',
  'Vimeo',
  'Rumble',
  'Kick',
];

// ─── Windows detection ────────────────────────────────────────────────────────

// Build a single wmic WHERE clause covering all trigger processes
const _wmicWhere = TRIGGER_PROCESSES_WIN.map(p => `name='${p}'`).join(' or ');

const _triggerSetLower = new Set(TRIGGER_PROCESSES_WIN.map(p => p.toLowerCase()));
// Names without the .exe suffix — what Get-Process returns.
const _triggerSetNoExt = new Set(TRIGGER_PROCESSES_WIN.map(p => p.toLowerCase().replace(/\.exe$/, '')));

const _PSEXE = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';

// Fast, reliable native-process check on Windows.
// Order of preference (each attempt is async; fail-through on error):
//   1. tasklist.exe — ~150-300ms cold, no PowerShell startup tax
//   2. Get-Process via PowerShell — ~5s cold first time, ~200ms subsequent
//   3. WMIC — last resort, flaky on Win11
function checkNativeProcesses() {
  return new Promise((resolve) => {
    // (1) tasklist — fastest path
    execFile('tasklist.exe', ['/NH', '/FO', 'CSV'], { timeout: 4000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (!err && stdout) {
          for (const line of stdout.split(/\r?\n/)) {
            const m = line.match(/^"([^"]+)"/);
            if (m && _triggerSetLower.has(m[1].toLowerCase())) { resolve(true); return; }
          }
          // tasklist returned cleanly with no matches → not running
          resolve(false);
          return;
        }
        // (2) PowerShell Get-Process
        const psCmd =
          `try { ` +
          `  $hits = Get-Process -ErrorAction Ignore | Where-Object { $_.Name -in @(${[..._triggerSetNoExt].map(n => `'${n}'`).join(',')}) } | Select-Object -First 1; ` +
          `  if ($hits) { exit 0 } ` +
          `} catch {}; exit 1`;
        execFile(_PSEXE, ['-NoProfile', '-NonInteractive', '-Command', psCmd],
          { timeout: 10000 },
          (err2) => {
            if (err2 === null || err2?.code === 0) { resolve(true); return; }
            if (err2?.code === 1) { resolve(false); return; }
            // (3) WMIC last resort
            execFile('wmic', ['process', 'where', _wmicWhere, 'get', 'name', '/value'],
              { timeout: 5000 },
              (err3, stdout3) => resolve(stdout3 != null && stdout3.includes('Name='))
            );
          }
        );
      }
    );
  });
}

// Escape regex special chars so any pattern (e.g. "Daily.co", "X Spaces") is
// matched literally inside the PowerShell -match alternation.
function _reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkBrowserTitles() {
  return new Promise((resolve) => {
    const cleanPatterns = TITLE_PATTERNS
      .filter(p => p && p.trim() && !p.trim().startsWith('|'))
      .map(_reEscape);
    if (cleanPatterns.length === 0) { resolve(false); return; }
    const titlePattern = cleanPatterns.join('|');
    // Cover ALL Chromium/Gecko-based browsers in common use. New browsers can
    // be added without code change as long as their process name shows up via
    // Get-Process.
    const browserNames = 'chrome,msedge,firefox,brave,opera,vivaldi,arc,zen,librewolf,floorp,waterfox,thunderbird';
    // Use double-quoted string with escaped quotes; safer than single-quote
    // PowerShell strings because it lets us use a here-string-style payload
    // without worrying about embedded single quotes.
    const psCmd =
      `try { $t = Get-Process -Name ${browserNames} -ErrorAction Ignore | ` +
      `Where-Object { $_.MainWindowTitle -match "${titlePattern}" } | ` +
      `Select-Object -First 1 -ExpandProperty MainWindowTitle; ` +
      `if ($t) { Write-Host "MATCH:$t"; exit 0 } } catch {}; exit 1`;
    const psExe = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
    execFile(psExe, ['-NoProfile', '-NonInteractive', '-Command', psCmd],
      { timeout: 15000 },
      (err, stdout) => {
        const matched = (err === null || err?.code === 0);
        if (matched && stdout && stdout.startsWith('MATCH:')) {
          // Log the matched title once per state change so we can see WHAT triggered.
          const m = stdout.slice(6).split(/\r?\n/)[0];
          if (m && m !== _lastBrowserMatch) {
            _log(`browser title match: "${m.slice(0, 80)}"`);
            _lastBrowserMatch = m;
          }
        } else if (!matched) {
          _lastBrowserMatch = null;
        }
        resolve(matched);
      }
    );
  });
}

let _lastBrowserMatch = null;

function checkMac() {
  const { exec } = require('child_process');
  return new Promise((resolve) => {
    exec(
      `osascript -e 'tell application "System Events" to get name of every process whose background only is false'`,
      { timeout: 4000 },
      (err, stdout) => {
        if (!err) {
          const lower = stdout.toLowerCase();
          if (TRIGGER_PROCESSES_MAC.some(p => lower.includes(p.toLowerCase()))) return resolve(true);
        }
        const titleMatches = TITLE_PATTERNS.map(p => `t contains "${p}"`).join(' or ');
        const script = `
          tell application "System Events"
            set names to name of every process whose background only is false
          end tell
          repeat with n in {"Google Chrome","Safari","Firefox","Brave Browser","Microsoft Edge","Arc"}
            if n is in names then
              tell application n
                try
                  set t to title of active tab of front window
                  if ${titleMatches} then return t
                end try
              end tell
            end if
          end repeat
          return ""
        `;
        exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 5000 }, (err2, out2) => {
          resolve(!err2 && out2.trim().length > 0);
        });
      }
    );
  });
}

// ─── overlay + listen control ────────────────────────────────────────────────

// We DO NOT track _sessionActive ourselves — the source of truth is
// listenService.sttService.isSessionActive(). This way if the user clicks
// the Stop button manually (which calls handleListenRequest('Stop') from
// outside our control), the next detection tick will see isSessionActive()===false
// and correctly auto-restart the session.
let _sessionStarting = false;

// Manual-stop flag: when the user clicks Stop in the overlay, we briefly
// suppress auto-restart so the user has time to do whatever they wanted to
// do. After MANUAL_STOP_SNOOZE_MS elapses, the flag auto-clears and the next
// trigger detection re-starts the listen session normally.
//
// Plug-and-play priority: never permanently disable auto-start. If the user
// stops, we resume soon — the alternative (sticky stop) is a footgun where
// the user thinks the app is broken because they once clicked Stop.
let _manuallyStopped = false;
let _manuallyStoppedAt = 0;
const MANUAL_STOP_SNOOZE_MS = 10 * 1000; // 10s — was 60s. Accidental clicks on STOP (hovering near PRIVATE pill or X) used to dead-end the listen session for a full minute. 10s self-heals fast while still respecting an intentional "give me a beat" tap.
function setManualStop(v) {
  _manuallyStopped = !!v;
  _manuallyStoppedAt = _manuallyStopped ? Date.now() : 0;
  _log(`manual-stop set to ${_manuallyStopped}`);
}

// User-hidden flag: when the user explicitly hides the overlay, the detector
// should NOT auto-show it again — even though the trigger app is still detected.
// Cleared when the trigger app closes, or the user explicitly opens via tray,
// OR after a snooze timer expires (so the user can dismiss-and-resume without
// having to remember the tray icon).
let _userHidden = false;
let _userHiddenAt = 0;
const USER_HIDDEN_SNOOZE_MS = 90 * 1000; // 90s — long enough to ignore for now, short enough to come back
function setUserHidden(v) {
  _userHidden = !!v;
  _userHiddenAt = _userHidden ? Date.now() : 0;
  _log(`user-hidden set to ${_userHidden}`);
}

let _missCount = 0;
const MISS_THRESHOLD = 3; // 3 × ~1.25s ≈ 4s grace before hiding

function _isListenActive() {
  try {
    return !!listenService.sttService?.isSessionActive?.();
  } catch (_) {
    return false;
  }
}

async function setOverlayVisible(shouldShow) {
  let win;
  try {
    win = windowPool.get('annotated-overlay');
  } catch (_) {
    return;
  }
  if (!win || win.isDestroyed()) return;

  if (shouldShow) {
    _missCount = 0;

    // Respect the user-hidden flag, but auto-clear after the snooze window
    // expires so the overlay returns even if the trigger app stayed open.
    if (_userHidden) {
      if (Date.now() - _userHiddenAt > USER_HIDDEN_SNOOZE_MS) {
        _userHidden = false;
        _userHiddenAt = 0;
        _log('user-hidden cleared (snooze expired)');
      } else {
        return;
      }
    }

    // Show overlay — wrap in try/catch in case window is in a weird state
    try {
      const wasVisible = win.isVisible();
      if (!wasVisible) {
        const showT0 = Date.now();
        win.show();
        _log(`⏱ overlay shown — trigger app detected (win.show took ${Date.now() - showT0}ms)`);
      }
      // Re-assert every tick so Zoom/Teams can't bury us after opening fullscreen
      win.setAlwaysOnTop(true, 'screen-saver');
      win.moveTop();
    } catch (e) {
      _log('overlay show error: ' + e.message);
    }

    // Auto-start listen session — STOP means STOP. We deliberately do NOT
    // auto-clear the manual-stop flag on a timer. Once the user clicks STOP,
    // the listen session stays off until they click START again, or the
    // trigger app closes (which clears _manuallyStopped in the else branch
    // below). Net behavior: auto-start fires exactly once per trigger-app
    // open, plus on explicit START clicks.
    if (!_manuallyStopped && !_sessionStarting && !_isListenActive()) {
      _sessionStarting = true;
      try {
        await listenService.handleListenRequest('Listen');
        _log('listen session started');
      } catch (e) {
        _log('could not auto-start listen session: ' + e.message);
      } finally {
        _sessionStarting = false;
      }
    }
  } else {
    _missCount++;
    if (_missCount < MISS_THRESHOLD) return;

    try {
      if (win.isVisible()) {
        win.hide();
        _log('overlay hidden — no trigger app');
      }
    } catch (e) {
      _log('overlay hide error: ' + e.message);
    }

    // Trigger app closed — clear the manual-stop flag so next launch starts fresh
    if (_manuallyStopped) {
      _manuallyStopped = false;
      _log('manual-stop cleared (trigger app closed)');
    }
    // Trigger app closed — clear the user-hidden flag too so next launch
    // shows the overlay automatically as expected.
    if (_userHidden) {
      _userHidden = false;
      _log('user-hidden cleared (trigger app closed)');
    }

    // Stop listen if still active
    if (_isListenActive()) {
      try {
        await listenService.handleListenRequest('Stop');
        _log('listen session stopped');
      } catch (e) {
        _log('could not auto-stop listen session: ' + e.message);
      }
    }
  }
}

// ─── native process loop (fast) ──────────────────────────────────────────────

let _timer    = null;
let _checking = false;

async function tick() {
  if (_checking) return;
  _checking = true;
  try {
    let nativeDetected = false;
    try {
      nativeDetected = await checkNativeProcesses();
    } catch (e) {
      _log('checkNativeProcesses threw: ' + e.message);
    }
    // WMIC is flaky on Windows 11 and intermittently returns false even when
    // a trigger process is running. Three layers of defense:
    //  (1) WMI event watcher's live set — if a trigger fired __InstanceCreationEvent
    //      we count as detected.
    //  (2) Stickiness — if wmic returned true within the last STICKY_MS, ignore
    //      a transient false. This kills flapping caused by WMIC race conditions.
    const now = Date.now();
    if (nativeDetected) _lastWmicTrueAt = now;
    const sticky = (now - _lastWmicTrueAt) < STICKY_MS;
    const wmiHasLive = _liveTriggerSet.size > 0;
    const finalNative = nativeDetected || wmiHasLive || sticky;
    const detected = finalNative || _browserDetected;
    _log(`tick wmic=${nativeDetected} sticky=${sticky} wmiSet=${wmiHasLive} browser=${_browserDetected} → ${detected}`);
    try {
      await setOverlayVisible(detected);
    } catch (e) {
      _log('setOverlayVisible threw: ' + e.message);
    }
  } catch (e) {
    _log('tick fatal: ' + e.message);
  } finally {
    _checking = false;
    if (_timer !== null) _timer = setTimeout(tick, NATIVE_POLL_MS);
  }
}

// ─── browser title loop (slow, independent) ──────────────────────────────────

let _browserDetected = false;
let _titleTimer      = null;
let _titleChecking   = false;

async function titleTick() {
  if (!_titleChecking) {
    _titleChecking = true;
    try {
      _browserDetected = await checkBrowserTitles();
      _log(`titleTick browser=${_browserDetected}`);
    } catch (e) {
      _browserDetected = false;
      _log('titleTick error: ' + e.message);
    } finally {
      _titleChecking = false;
    }
  }
  // ALWAYS reschedule — never let the title loop die
  if (_titleTimer !== null) _titleTimer = setTimeout(titleTick, TITLE_POLL_MS);
}

// ─── WMI event watcher (instant start/stop notifications) ───────────────────

// Live set of trigger processes currently running, maintained by WMI events.
// When the set transitions 0→1, fire show. When 1→0, fire hide (after grace).
const _liveTriggerSet = new Set();
let _wmi = null;

function _onProcStart(name) {
  const t0 = Date.now();
  const lower = name.toLowerCase();
  if (!TRIGGER_PROCESSES_WIN.includes(lower)) return;
  const wasEmpty = _liveTriggerSet.size === 0;
  _liveTriggerSet.add(lower);
  _log(`⏱ WMI start: ${lower} (live=${_liveTriggerSet.size}, wasEmpty=${wasEmpty})`);
  // CRITICAL: when a new trigger app starts, the user is clearly back at
  // their meeting / podcast / call. Override any prior X-button hide
  // (user-hidden snooze) so the overlay pops immediately. Without this,
  // closing+reopening Zoom during the 90s snooze leaves the overlay dark.
  if (_userHidden) {
    _userHidden = false;
    _userHiddenAt = 0;
    _log('⏱ user-hidden cleared by new trigger start');
  }
  if (process.platform !== 'darwin') {
    setOverlayVisible(true)
      .then(() => _log(`⏱ event-show done in ${Date.now() - t0}ms (${lower})`))
      .catch(e => _log('event-driven show err: ' + e.message));
  }
}

function _onProcStop(name) {
  const lower = name.toLowerCase();
  if (!_liveTriggerSet.has(lower)) return;
  _liveTriggerSet.delete(lower);
  _log(`WMI stop: ${lower} (live=${_liveTriggerSet.size})`);
  if (_liveTriggerSet.size === 0 && _browserDetected === false && process.platform !== 'darwin') {
    setOverlayVisible(false).catch(e => _log('event-driven hide err: ' + e.message));
  }
}

// ─── Zoom active-speaker watcher (UI Automation, no voice biometrics) ────────

let _zoomWatcher = null;
function _onZoomActive(name) {
  // Forward Zoom's known active speaker to the renderer as the most-recent
  // Speechmatics speaker label. Zoom knows exactly who's talking — no need
  // to guess via voice biometrics.
  try {
    // Determine which Speechmatics speaker label most likely corresponds
    // to "right now". The simplest assumption: the most recent one. The
    // renderer will rename whichever id is currently active.
    const stt = listenService.sttService;
    if (!stt) return;
    // Pick the speaker label whose latest range ended most recently
    let bestLabel = null;
    let bestEnd = -Infinity;
    for (const [label, ranges] of (stt._speakerTimeRanges || new Map())) {
      const lastEnd = ranges[ranges.length - 1]?.t2 ?? -Infinity;
      if (lastEnd > bestEnd) { bestEnd = lastEnd; bestLabel = label; }
    }
    if (!bestLabel) return;
    stt.sendToRenderer('speaker-identified', {
      speakerLabel: bestLabel,
      name,
      score: 100, // sourced from Zoom directly — full confidence
      source: 'zoom',
    });
    _log(`zoom-driven identify: ${bestLabel} → ${name}`);
  } catch (e) {
    _log('onZoomActive err: ' + e.message);
  }
}

// ─── start / stop ─────────────────────────────────────────────────────────────

function startPolling() {
  if (_timer !== null) return;
  _log(`native poll every ~${NATIVE_POLL_MS + 750}ms (backstop), title poll every ~${TITLE_POLL_MS + 3000}ms (PS+wait)`);
  _timer      = setTimeout(tick,      0); // immediate first native check
  _titleTimer = setTimeout(titleTick, 0); // immediate first title check

  // WMI event subscription — instant start/stop on Windows. macOS falls back
  // to polling (no equivalent API exposed cheaply from Node).
  if (process.platform === 'win32' && !_wmi) {
    _wmi = new WmiWatcher(TRIGGER_PROCESSES_WIN);
    _wmi.on('start', _onProcStart);
    _wmi.on('stop',  _onProcStop);
    _wmi.start();

    // Seed _liveTriggerSet with a one-shot snapshot of currently-running
    // trigger processes. Without this, processes that started BEFORE the app
    // launched are invisible to the WMI event watcher (events only fire on
    // create/delete). Use tasklist (fast & reliable on Win11) with WMIC as
    // backup.
    const _logSeedResult = () => {
      _log(`seed snapshot: live=${_liveTriggerSet.size} (${[..._liveTriggerSet].join(',') || 'none'})`);
    };
    const psCmd =
      `try { ` +
      `  Get-Process -ErrorAction Ignore | Where-Object { $_.Name -in @(${[..._triggerSetNoExt].map(n => `'${n}'`).join(',')}) } | ForEach-Object { Write-Output $_.Name }; ` +
      `} catch {}`;
    execFile(_PSEXE, ['-NoProfile', '-NonInteractive', '-Command', psCmd],
      { timeout: 15000 },
      (err, stdout, stderr) => {
        if (err) _log(`seed PS err=${err.message?.slice(0, 80) || err.code}`);
        if (!err && stdout) {
          for (const line of stdout.split(/\r?\n/)) {
            const name = line.trim().toLowerCase();
            if (!name) continue;
            const canonical = name.endsWith('.exe') ? name : `${name}.exe`;
            if (_triggerSetLower.has(canonical)) _liveTriggerSet.add(canonical);
          }
        }
        _logSeedResult();
      }
    );
  }

  // Zoom active-speaker reader — uses UI Automation to grab the name Zoom
  // already knows. Falls back to voice biometrics when Zoom isn't in front.
  if (process.platform === 'win32' && !_zoomWatcher) {
    _zoomWatcher = new ZoomActiveSpeaker();
    _zoomWatcher.on('active', _onZoomActive);
    _zoomWatcher.start();
  }
}

function stopPolling() {
  if (_timer      !== null) { clearTimeout(_timer);      _timer      = null; }
  if (_titleTimer !== null) { clearTimeout(_titleTimer); _titleTimer = null; }
  if (_wmi) { _wmi.stop(); _wmi = null; }
  if (_zoomWatcher) { _zoomWatcher.stop(); _zoomWatcher = null; }
  _sessionStarting = false;
  _missCount       = 0;
  _checking        = false;
  _titleChecking   = false;
  _browserDetected = false;
  _liveTriggerSet.clear();
}

module.exports = { startPolling, stopPolling, setManualStop, setUserHidden };
