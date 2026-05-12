/**
 * wmiWatcher.js
 * Spawns a long-running PowerShell process that subscribes to Windows WMI
 * process start/stop events. Emits 'start' / 'stop' events the instant a
 * matching trigger process is created or destroyed — no polling delay.
 *
 * Usage:
 *   const watcher = new WmiWatcher(['zoom.exe', 'cpthost.exe', ...]);
 *   watcher.on('start', name => console.log(name + ' STARTED'));
 *   watcher.on('stop',  name => console.log(name + ' STOPPED'));
 *   watcher.start();
 *   ...
 *   watcher.stop();
 */
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const _logFile = path.join(os.homedir(), 'annotated-debug.log');
function _log(...args) {
  const line = `[${new Date().toISOString()}] [WmiWatcher] ${args.join(' ')}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(_logFile, line); } catch {}
}

class WmiWatcher extends EventEmitter {
  constructor(triggerNamesLowercase) {
    super();
    this.triggerNames = triggerNamesLowercase.map(n => n.toLowerCase());
    this.proc = null;
    this._restartTimer = null;
    this._stopped = false;
  }

  start() {
    if (this.proc) return;
    this._stopped = false;
    this._spawn();
  }

  stop() {
    this._stopped = true;
    if (this._restartTimer) { clearTimeout(this._restartTimer); this._restartTimer = null; }
    if (this.proc) {
      try { this.proc.kill('SIGTERM'); } catch (_) {}
      this.proc = null;
    }
  }

  _spawn() {
    // PowerShell script: register WMI event subscriptions for process start
    // and stop traces, then loop pumping events to stdout. We use the broader
    // __InstanceCreationEvent on Win32_Process — works without admin.
    const namesArr = this.triggerNames.map(n => `'${n}'`).join(',');
    // PS sigils ($name, $kind, $e) without ${} are just literal text in a JS
    // template literal — they pass through to PowerShell unchanged.
    const psScript = `
$ErrorActionPreference = 'Continue';
$names = @(${namesArr});

Register-WmiEvent -Query "SELECT * FROM __InstanceCreationEvent WITHIN 1 WHERE TargetInstance ISA 'Win32_Process'" -SourceIdentifier ProcStart
Register-WmiEvent -Query "SELECT * FROM __InstanceDeletionEvent WITHIN 1 WHERE TargetInstance ISA 'Win32_Process'" -SourceIdentifier ProcStop

while ($true) {
  $e = Wait-Event -Timeout 30
  if (-not $e) { continue }
  try {
    $procName = ($e.SourceEventArgs.NewEvent.TargetInstance.Name).ToLower()
    if ($names -contains $procName) {
      $kind = if ($e.SourceIdentifier -eq 'ProcStart') { 'START' } else { 'STOP' }
      Write-Host "\${kind}:$procName"
      [Console]::Out.Flush()
    }
  } catch { }
  Remove-Event -EventIdentifier $e.EventIdentifier
}
`;

    const psExe = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
    this.proc = spawn(psExe, ['-NoProfile', '-NonInteractive', '-Command', psScript], {
      windowsHide: true,
    });

    let buffer = '';
    this.proc.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const m = line.match(/^(START|STOP):(.+)$/);
        if (!m) continue;
        const [, kind, name] = m;
        if (kind === 'START') this.emit('start', name);
        else                  this.emit('stop',  name);
      }
    });
    this.proc.stderr.on('data', (chunk) => {
      // PS errors are non-fatal — log and keep going
      _log('PS stderr:', chunk.toString().trim().slice(0, 200));
    });
    this.proc.on('error', (err) => {
      _log('PS spawn error:', err.message);
    });
    this.proc.on('exit', (code) => {
      _log(`PS exited code=${code} — restarting in 2s`);
      this.proc = null;
      if (!this._stopped) {
        this._restartTimer = setTimeout(() => this._spawn(), 2000);
      }
    });
    _log(`watching ${this.triggerNames.length} processes via WMI events`);
  }
}

module.exports = WmiWatcher;
