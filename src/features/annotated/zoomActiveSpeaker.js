/**
 * zoomActiveSpeaker.js
 * Reads the currently-active speaker from Zoom's window via Windows UI
 * Automation. Zoom marks the active speaker's video tile with a distinctive
 * "Talking" / green-bordered state, and the participant name is exposed on
 * the tile through accessibility APIs.
 *
 * No voice biometrics needed when on Zoom — Zoom already knows who's speaking.
 *
 * Spawns a long-running PowerShell process that polls UI Automation 2× per
 * second and pipes the active-speaker name to stdout.
 */
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const _logFile = path.join(os.homedir(), 'annotated-debug.log');
function _log(...args) {
  const line = `[${new Date().toISOString()}] [ZoomSpeaker] ${args.join(' ')}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(_logFile, line); } catch {}
}

class ZoomActiveSpeaker extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this._stopped = false;
    this._restartTimer = null;
    this._lastEmitted = null;
  }

  start() {
    if (this.proc) return;
    this._stopped = false;
    this._spawn();
  }

  stop() {
    this._stopped = true;
    if (this._restartTimer) { clearTimeout(this._restartTimer); this._restartTimer = null; }
    if (this.proc) { try { this.proc.kill('SIGTERM'); } catch (_) {} this.proc = null; }
  }

  _spawn() {
    const psScript = `
$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Get-ZoomMainWindow {
  $procs = Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -in @('Zoom','ZoomWorkplace','CptHost') -and $_.MainWindowHandle -ne 0
  }
  foreach ($p in $procs) {
    $hwnd = $p.MainWindowHandle
    $elem = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
    if ($elem) { return $elem }
  }
  return $null
}

function Find-ActiveSpeaker($root) {
  if (-not $root) { return $null }
  # Strategy 1: walk the tree for any element whose name contains "is talking"
  # or whose helpText/automationId hints active speaker.
  try {
    $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Text)
    $textElems = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
    foreach ($t in $textElems) {
      $n = $t.Current.Name
      if ($n -match '^(.+?)\\s+is talking') { return $matches[1].Trim() }
      if ($n -match '^(.+?)\\s+is unmuted') { return $matches[1].Trim() }
    }
  } catch {}
  # Strategy 2: spotlight / pinned name on title bar
  try {
    $tb = $root.Current.Name
    if ($tb -match '^(?:Zoom\\s+Meeting\\s+(?:-|—)\\s+)(.+?)$') { return $matches[1].Trim() }
  } catch {}
  return $null
}

while ($true) {
  Start-Sleep -Milliseconds 500
  try {
    $root = Get-ZoomMainWindow
    $speaker = Find-ActiveSpeaker $root
    if ($speaker) {
      Write-Host "SPEAKER:$speaker"
      [Console]::Out.Flush()
    }
  } catch { }
}
`;
    const psExe = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
    this.proc = spawn(psExe, ['-NoProfile', '-NonInteractive', '-Command', psScript], { windowsHide: true });

    let buffer = '';
    this.proc.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const m = line.match(/^SPEAKER:(.+)$/);
        if (!m) continue;
        const name = m[1].trim();
        if (name && name !== this._lastEmitted) {
          this._lastEmitted = name;
          _log(`active speaker: ${name}`);
          this.emit('active', name);
        }
      }
    });
    this.proc.stderr.on('data', (chunk) => {
      _log('PS stderr:', chunk.toString().trim().slice(0, 200));
    });
    this.proc.on('exit', (code) => {
      _log(`PS exited code=${code} — restart in 3s`);
      this.proc = null;
      if (!this._stopped) {
        this._restartTimer = setTimeout(() => this._spawn(), 3000);
      }
    });
    _log('zoom active-speaker watcher started');
  }
}

module.exports = ZoomActiveSpeaker;
