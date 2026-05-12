// try {
//     const reloader = require('electron-reloader');
//     reloader(module, {
//     });
// } catch (err) {
// }

// In packaged Electron, process.resourcesPath points to the resources/ dir.
// In dev, process.defaultApp is truthy (electron is the "default app"), so fall back to repo root.
const _path = require('path');
const _envPath = !process.defaultApp && process.resourcesPath
  ? _path.join(process.resourcesPath, '.env')
  : _path.join(__dirname, '..', '.env');
require('dotenv').config({ path: _envPath });

// Swallow EPIPE — happens when Electron's stdout/stderr pipe closes while
// OllamaService (or any logger) still tries to write. Prevents the uncaught
// exception dialog.
if (process.stdout) process.stdout.on('error', () => {});
if (process.stderr) process.stderr.on('error', () => {});

// Bulletproof error handling — never let the app die silently.
// All uncaught errors get logged to ~/annotated-debug.log so we can diagnose
// later. Re-throwing kills the process; we deliberately swallow.
const _crashLog = require('path').join(require('os').homedir(), 'annotated-debug.log');
function _crashLogLine(prefix, err) {
  try {
    const msg = err?.stack || err?.message || String(err);
    const line = `[${new Date().toISOString()}] [MainProcess] ${prefix}: ${msg}\n`;
    process.stdout.write(line);
    require('fs').appendFileSync(_crashLog, line);
  } catch (_) {}
}
process.on('uncaughtException', (err) => _crashLogLine('UNCAUGHT_EXCEPTION', err));
process.on('unhandledRejection', (err) => _crashLogLine('UNHANDLED_REJECTION', err));

if (require('electron-squirrel-startup')) {
    process.exit(0);
}

const { app, BrowserWindow, Tray, Menu, shell, ipcMain, dialog, desktopCapturer, session } = require('electron');

// Wrap app.quit / app.exit so we ALWAYS know who killed the process
const _origQuit = app.quit.bind(app);
const _origExit = app.exit.bind(app);
app.quit = function(...args) {
  _crashLogLine('APP_QUIT_CALLED', new Error('app.quit() stack'));
  return _origQuit(...args);
};
app.exit = function(...args) {
  _crashLogLine('APP_EXIT_CALLED code=' + JSON.stringify(args), new Error('app.exit() stack'));
  return _origExit(...args);
};
const _origProcExit = process.exit.bind(process);
process.exit = function(code) {
  try { _crashLogLine('PROCESS_EXIT_CALLED code=' + code, new Error('process.exit() stack')); } catch (_) {}
  return _origProcExit(code);
};
app.on('before-quit', () => _crashLogLine('BEFORE_QUIT_EVENT', new Error('before-quit fired')));
app.on('will-quit',   () => _crashLogLine('WILL_QUIT_EVENT', new Error('will-quit fired')));
const { createWindows, createListenWindowOnly, createAnnotatedOverlay, createOBSOverlay } = require('./window/windowManager.js');
const appDetector = require('./features/annotated/appDetector');
const listenService = require('./features/listen/listenService');
const { initializeFirebase } = require('./features/common/services/firebaseClient');
const databaseInitializer = require('./features/common/services/databaseInitializer');
const authService = require('./features/common/services/authService');
const path = require('node:path');
const express = require('express');
const fetch = require('node-fetch');
const { autoUpdater } = require('electron-updater');
const { EventEmitter } = require('events');
const askService = require('./features/ask/askService');
const settingsService = require('./features/settings/settingsService');
const sessionRepository = require('./features/common/repositories/session');
const modelStateService = require('./features/common/services/modelStateService');
const featureBridge = require('./bridge/featureBridge');
const windowBridge = require('./bridge/windowBridge');

// Global variables
const eventBridge = new EventEmitter();
let WEB_PORT = 3000;
let isShuttingDown = false; // Flag to prevent infinite shutdown loop
let tray = null;

/**
 * Seeds the provider_settings DB from .env keys if no active STT/LLM is set.
 * This lets the app run without ever going through the settings UI.
 */
async function seedProvidersFromEnv() {
  try {
    const providerSettingsRepo = require('./features/common/repositories/providerSettings');

    const activeStt = await providerSettingsRepo.getActiveProvider('stt');
    const speechmaticsKey = process.env.SPEECHMATICS_API_KEY;

    // FORCE Speechmatics as active STT whenever the key is present. This
    // overrides any prior active provider — including stale Gemini configs
    // from earlier app versions whose live STT model is no longer accessible.
    // Speechmatics is the only realtime STT we trust for this app.
    // ALWAYS seed Deepgram alongside Speechmatics so the runtime fallback
    // path has the API key available without round-tripping the user.
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    if (deepgramKey) {
      await providerSettingsRepo.upsert('deepgram', {
        api_key: deepgramKey,
        selected_stt_model: 'nova-3',
        updated_at: Date.now(),
      });
    }

    if (speechmaticsKey) {
      await providerSettingsRepo.upsert('speechmatics', {
        api_key: speechmaticsKey,
        selected_stt_model: 'speechmatics-enhanced',
        updated_at: Date.now(),
      });
      await providerSettingsRepo.setActiveProvider('speechmatics', 'stt');
      if (activeStt?.provider !== 'speechmatics') {
        console.log(`[seed] ✅ Speechmatics forced as active STT (was: ${activeStt?.provider || 'none'})`);
      }
    } else if (!activeStt && deepgramKey) {
      await providerSettingsRepo.setActiveProvider('deepgram', 'stt');
      console.log('[seed] ✅ Deepgram set as active STT from DEEPGRAM_API_KEY');
    } else {
      console.log(`[seed] STT already configured: ${activeStt?.provider}`);
    }

    const activeLlm = await providerSettingsRepo.getActiveProvider('llm');
    if (!activeLlm) {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        await providerSettingsRepo.upsert('gemini', {
          api_key: geminiKey,
          selected_llm_model: 'gemini-2.5-flash',
          updated_at: Date.now(),
        });
        await providerSettingsRepo.setActiveProvider('gemini', 'llm');
        console.log('[seed] ✅ Gemini set as active LLM from GEMINI_API_KEY');
      }
    } else {
      console.log(`[seed] LLM already configured: ${activeLlm.provider}`);
    }
  } catch (e) {
    console.warn('[seed] Provider seed failed (non-fatal):', e.message);
  }
}

//////// after_modelStateService ////////
global.modelStateService = modelStateService;
//////// after_modelStateService ////////

// Import and initialize OllamaService
const ollamaService = require('./features/common/services/ollamaService');
const ollamaModelRepository = require('./features/common/repositories/ollamaModel');

// Native deep link handling - cross-platform compatible
let pendingDeepLinkUrl = null;

function setupProtocolHandling() {
    // Protocol registration - must be done before app is ready
    try {
        if (!app.isDefaultProtocolClient('pickleglass')) {
            const success = app.setAsDefaultProtocolClient('pickleglass');
            if (success) {
                console.log('[Protocol] Successfully set as default protocol client for pickleglass://');
            } else {
                console.warn('[Protocol] Failed to set as default protocol client - this may affect deep linking');
            }
        } else {
            console.log('[Protocol] Already registered as default protocol client for pickleglass://');
        }
    } catch (error) {
        console.error('[Protocol] Error during protocol registration:', error);
    }

    // Handle protocol URLs on Windows/Linux
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        console.log('[Protocol] Second instance command line:', commandLine);
        
        focusMainWindow();
        
        let protocolUrl = null;
        
        // Search through all command line arguments for a valid protocol URL
        for (const arg of commandLine) {
            if (arg && typeof arg === 'string' && arg.startsWith('pickleglass://')) {
                // Clean up the URL by removing problematic characters
                const cleanUrl = arg.replace(/[\\₩]/g, '');
                
                // Additional validation for Windows
                if (process.platform === 'win32') {
                    // On Windows, ensure the URL doesn't contain file path indicators
                    if (!cleanUrl.includes(':') || cleanUrl.indexOf('://') === cleanUrl.lastIndexOf(':')) {
                        protocolUrl = cleanUrl;
                        break;
                    }
                } else {
                    protocolUrl = cleanUrl;
                    break;
                }
            }
        }
        
        if (protocolUrl) {
            console.log('[Protocol] Valid URL found from second instance:', protocolUrl);
            handleCustomUrl(protocolUrl);
        } else {
            console.log('[Protocol] No valid protocol URL found in command line arguments');
            console.log('[Protocol] Command line args:', commandLine);
        }
    });

    // Handle protocol URLs on macOS
    app.on('open-url', (event, url) => {
        event.preventDefault();
        console.log('[Protocol] Received URL via open-url:', url);
        
        if (!url || !url.startsWith('pickleglass://')) {
            console.warn('[Protocol] Invalid URL format:', url);
            return;
        }

        if (app.isReady()) {
            handleCustomUrl(url);
        } else {
            pendingDeepLinkUrl = url;
            console.log('[Protocol] App not ready, storing URL for later');
        }
    });
}

function focusMainWindow() {
    const { windowPool } = require('./window/windowManager.js');
    if (windowPool) {
        const header = windowPool.get('header');
        if (header && !header.isDestroyed()) {
            if (header.isMinimized()) header.restore();
            header.focus();
            return true;
        }
    }
    
    // Fallback: focus any available window
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        const mainWindow = windows[0];
        if (!mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            return true;
        }
    }
    
    return false;
}

if (process.platform === 'win32') {
    for (const arg of process.argv) {
        if (arg && typeof arg === 'string' && arg.startsWith('pickleglass://')) {
            // Clean up the URL by removing problematic characters (korean characters issue...)
            const cleanUrl = arg.replace(/[\\₩]/g, '');
            
            if (!cleanUrl.includes(':') || cleanUrl.indexOf('://') === cleanUrl.lastIndexOf(':')) {
                console.log('[Protocol] Found protocol URL in initial arguments:', cleanUrl);
                pendingDeepLinkUrl = cleanUrl;
                break;
            }
        }
    }
    
    console.log('[Protocol] Initial process.argv:', process.argv);
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
    process.exit(0);
}

// When the user re-launches the app while an instance is already running
// (e.g. double-click the desktop icon), bring the overlay to the front instead
// of silently doing nothing.
app.on('second-instance', () => {
    try {
        const appDetector = require('./features/annotated/appDetector');
        appDetector.setUserHidden?.(false); // clear "snooze" flag so the overlay can show
    } catch (_) {}
    try {
        const { windowPool } = require('./window/windowManager');
        const win = windowPool?.get('annotated-overlay');
        if (win && !win.isDestroyed()) {
            win.show();
            win.setAlwaysOnTop(true, 'screen-saver');
            win.moveTop();
        }
    } catch (_) {}
});

// setup protocol after single instance lock
setupProtocolHandling();

app.whenReady().then(async () => {

    // ── Apply user-pasted API key overrides ──────────────────────────────
    // The user can paste their own API keys via the tray "API key settings"
    // window; those are stored in electron-store and mirrored into process.env
    // here at startup so all downstream services pick them up transparently.
    try {
      const apiKeyService = require('./features/common/services/apiKeyService');
      for (const meta of apiKeyService.KNOWN_KEYS) {
        const v = apiKeyService.getApiKey(meta.name);
        if (v) process.env[meta.name] = v;
      }
    } catch (e) {
      console.warn('[index] could not apply API key overrides:', e?.message);
    }

    // Autostart at login so the detector is always running — the overlay
    // can't appear when Zoom/YouTube opens if the app isn't running. We
    // launch hidden so the user doesn't see a window on every login.
    try {
      app.setLoginItemSettings({
        openAtLogin: true,
        args: ['--hidden'],
      });
    } catch (e) {
      console.warn('[index] could not set login-item autostart:', e?.message);
    }

    // Watchdog: install a Windows Scheduled Task that respawns the app within
    // 60 seconds if it ever dies. User scope (no admin needed), runs every
    // minute, idempotent (schtasks /F overwrites). Approach:
    //   1. Drop a tiny watchdog.ps1 next to Annotated.exe
    //   2. Register it via simple schtasks CLI (no XML — XML form was
    //      silently failing with the StartBoundary/Repetition combo)
    if (process.platform === 'win32' && app.isPackaged) {
      try {
        const fs = require('fs');
        const path = require('path');
        const exePath = process.execPath;
        const exeDir = path.dirname(exePath);
        const watchdogPath = path.join(exeDir, 'watchdog.ps1');
        // Quote any single quotes in the exe path for the PS string literal.
        const psSafeExe = exePath.replace(/'/g, "''");
        const watchdogScript = `$ErrorActionPreference = 'SilentlyContinue'\nif (-not (Get-Process -Name Annotated)) {\n    Start-Process '${psSafeExe}' -WindowStyle Hidden\n}\n`;
        try { fs.writeFileSync(watchdogPath, watchdogScript, 'utf8'); } catch (_) {}

        const { exec } = require('child_process');
        const tr = `powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "${watchdogPath}"`;
        // schtasks needs the /TR value double-quoted on the command line.
        const cmd = `schtasks /Create /TN AnnotatedWatchdog /SC MINUTE /MO 1 /RL LIMITED /TR "${tr.replace(/"/g, '\\"')}" /F`;
        exec(cmd, (err) => {
          if (err) console.warn('[index] watchdog task create failed:', err.message);
          else console.log('[index] watchdog task installed (every 1 min)');
        });
      } catch (e) {
        console.warn('[index] could not install watchdog:', e?.message);
      }
    }

    // Setup native loopback audio capture for Windows
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
            // Grant access to the first screen found with loopback audio
            callback({ video: sources[0], audio: 'loopback' });
        }).catch((error) => {
            console.error('Failed to get desktop capturer sources:', error);
            callback({});
        });
    });

    // Initialize core services
    initializeFirebase();
    
    try {
        await databaseInitializer.initialize();
        console.log('>>> [index.js] Database initialized successfully');
        
        // Clean up zombie sessions from previous runs first - MOVED TO authService
        // sessionRepository.endAllActiveSessions();

        await authService.initialize();

        //////// after_modelStateService ////////
        await modelStateService.initialize();
        //////// after_modelStateService ////////

        featureBridge.initialize();  // 추가: featureBridge 초기화
        windowBridge.initialize();
        setupWebDataHandlers();

        // Initialize Ollama models in database
        await ollamaModelRepository.initializeDefaultModels();

        // Auto warm-up selected Ollama model in background (non-blocking)
        setTimeout(async () => {
            try {
                console.log('[index.js] Starting background Ollama model warm-up...');
                await ollamaService.autoWarmUpSelectedModel();
            } catch (error) {
                console.log('[index.js] Background warm-up failed (non-critical):', error.message);
            }
        }, 2000); // Wait 2 seconds after app start

        // Seed provider config from .env if DB has nothing active (first run / UI-less mode)
        await seedProvidersFromEnv();

        // Start web server and create windows ONLY after all initializations are successful
        WEB_PORT = await startWebStack();
        console.log('Web front-end listening on', WEB_PORT);

        // Skip the full PickleGlass UI — only create the hidden listen window for audio capture
        createListenWindowOnly();

        createAnnotatedOverlay(WEB_PORT);
        createOBSOverlay(WEB_PORT);
        appDetector.startPolling();

        // Import any pending voiceprints (queued by scripts/enroll-voiceprint.js)
        try {
          const voiceprintService = require('./features/listen/stt/voiceprintService');
          const beforeCount = voiceprintService.listVoiceprints().length;
          console.log(`[index] voiceprints in DB at startup: ${beforeCount}`);
          const n = voiceprintService.importPendingVoiceprints();
          if (n > 0) console.log(`[index] imported ${n} pending voiceprint(s)`);
          const afterCount = voiceprintService.listVoiceprints().length;
          console.log(`[index] voiceprints in DB after import: ${afterCount}`);
        } catch (e) {
          console.warn('[index] voiceprint import failed:', e.message);
        }

        // ── API Key settings window opener ───────────────────────────────
        let _apiKeyWin = null;
        const openApiKeySettings = () => {
          const apiKeyService = require('./features/common/services/apiKeyService');
          if (_apiKeyWin && !_apiKeyWin.isDestroyed()) {
            _apiKeyWin.focus(); return;
          }
          _apiKeyWin = new BrowserWindow({
            width: 580, height: 640,
            title: 'Annotated — API Keys',
            resizable: false,
            minimizable: false,
            maximizable: false,
            autoHideMenuBar: true,
            backgroundColor: '#0f1115',
            webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') },
          });
          // Inline HTML — avoid shipping yet another renderer bundle.
          const initial = apiKeyService.listApiKeys();
          const html = `<!doctype html><html><head><meta charset="utf-8"><title>API Keys — Annotated</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:linear-gradient(180deg,#0c0e13 0%,#0f1218 100%);color:rgba(255,255,255,.88);font-family:-apple-system,'Segoe UI',sans-serif;padding:24px 28px;font-size:13px;-webkit-font-smoothing:antialiased}
  h1{font-size:17px;margin:0 0 4px;font-weight:600;letter-spacing:-.01em}
  p.sub{margin:0 0 22px;color:rgba(255,255,255,.55);font-size:12px;line-height:1.5}
  p.sub strong{color:rgba(255,255,255,.78);font-weight:500}
  .row{padding:12px 0;border-top:1px solid rgba(255,255,255,.06);display:grid;grid-template-columns:1fr;gap:8px}
  .row:first-of-type{border-top:0;padding-top:6px}
  .row .meta{display:flex;justify-content:space-between;align-items:center;color:rgba(255,255,255,.45);font-size:11px}
  .row .label-line{display:flex;align-items:center;gap:8px}
  .row .label-line .label-text{font-size:12.5px;color:rgba(255,255,255,.92);font-weight:500}
  .badge{font-size:9px;padding:2px 7px;border-radius:999px;letter-spacing:.05em;text-transform:uppercase;font-weight:600}
  .b-user{background:rgba(96,165,250,.16);color:#60a5fa;border:1px solid rgba(96,165,250,.28)}
  .b-bundled{background:rgba(255,255,255,.07);color:rgba(255,255,255,.62);border:1px solid rgba(255,255,255,.10)}
  .b-missing{background:rgba(239,68,68,.14);color:#f87171;border:1px solid rgba(239,68,68,.25)}
  .row .meta a{color:#60a5fa;text-decoration:none;font-size:11px}
  .row .meta a:hover{text-decoration:underline}
  .input-group{display:flex;gap:6px}
  input{flex:1;background:#15171d;border:1px solid rgba(255,255,255,.10);color:rgba(255,255,255,.92);padding:8px 10px;border-radius:6px;font-family:Menlo,Consolas,monospace;font-size:11.5px;outline:0;transition:border-color .15s}
  input:focus{border-color:rgba(96,165,250,.55);background:#181b22}
  input::placeholder{color:rgba(255,255,255,.28)}
  .test-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.85);padding:0 12px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:500;letter-spacing:.02em;transition:background .12s,border-color .12s;min-width:56px}
  .test-btn:hover{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.22)}
  .test-btn:disabled{opacity:.5;cursor:wait}
  .test-result{font-size:11px;padding:4px 8px;border-radius:4px;display:none;margin-top:2px;animation:fadeIn .2s ease-out}
  .test-result.ok{display:inline-block;background:rgba(74,222,128,.13);color:#4ade80;border:1px solid rgba(74,222,128,.25)}
  .test-result.fail{display:inline-block;background:rgba(239,68,68,.13);color:#f87171;border:1px solid rgba(239,68,68,.25)}
  @keyframes fadeIn{from{opacity:0;transform:translateY(-2px)}to{opacity:1;transform:none}}
  .spinner{display:inline-block;width:10px;height:10px;border:1.5px solid rgba(255,255,255,.30);border-top-color:rgba(255,255,255,.85);border-radius:50%;animation:spin .7s linear infinite;vertical-align:-1px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .actions{display:flex;gap:10px;margin-top:24px;justify-content:flex-end;padding-top:16px;border-top:1px solid rgba(255,255,255,.08)}
  button.btn{background:#60a5fa;border:0;color:#0a0c10;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;font-size:12.5px;letter-spacing:.01em;transition:filter .12s,transform .08s}
  button.btn:hover{filter:brightness(1.08)}
  button.btn:active{transform:translateY(1px)}
  button.btn.secondary{background:rgba(255,255,255,.08);color:rgba(255,255,255,.88)}
  button.btn.secondary:hover{background:rgba(255,255,255,.12)}
</style></head><body>
<h1>API Keys</h1>
<p class="sub">Annotated ships with <strong>working defaults</strong> — you can use the app immediately. To use your own quota, paste your keys below and click <strong>Test</strong> to verify before saving. Keys are stored encrypted on this machine and never uploaded.</p>
<form id="f">
  ${initial.map(k => `
    <div class="row" data-key="${k.name}">
      <div class="meta">
        <div class="label-line">
          <span class="label-text">${k.label}</span>
          <span class="badge b-${k.source}">${k.source}</span>
        </div>
        <a href="${k.signupUrl}" target="_blank" rel="noopener">get key →</a>
      </div>
      <div class="input-group">
        <input name="${k.name}" type="password" placeholder="${k.maskedValue ? `current: ${k.maskedValue}` : (k.required ? 'required — paste your key' : 'optional')}" autocomplete="off" spellcheck="false" />
        <button type="button" class="test-btn" data-test="${k.name}">Test</button>
      </div>
      <div class="test-result" data-result="${k.name}"></div>
    </div>`).join('')}
  <div class="actions">
    <button type="button" class="btn secondary" id="cancel">Cancel</button>
    <button type="submit" class="btn">Save</button>
  </div>
</form>
<script>
  document.getElementById('cancel').onclick = () => window.close();

  // Test button — fires the auth probe and updates the inline status pill.
  document.querySelectorAll('.test-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.test;
      const input = document.querySelector(\`input[name="\${name}"]\`);
      const result = document.querySelector(\`[data-result="\${name}"]\`);
      const value = input.value;
      const original = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';
      result.className = 'test-result';
      try {
        const r = await window.api.annotated.testApiKey(name, value);
        result.className = 'test-result ' + (r.ok ? 'ok' : 'fail');
        result.textContent = (r.ok ? '✓ ' : '✗ ') + r.message;
      } catch (e) {
        result.className = 'test-result fail';
        result.textContent = '✗ ' + (e?.message || 'unexpected error');
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  });

  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {};
    new FormData(e.target).forEach((v, k) => { data[k] = v; });
    await window.api.annotated.saveApiKeys(data);
    window.close();
  });
</script></body></html>`;
          _apiKeyWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
          _apiKeyWin.on('closed', () => { _apiKeyWin = null; });
        };

        // IPC: save API keys from the settings window. Empty values leave the
        // bundled key in place; non-empty values override.
        ipcMain.handle('annotated:saveApiKeys', (event, data) => {
          const apiKeyService = require('./features/common/services/apiKeyService');
          for (const [name, value] of Object.entries(data || {})) {
            if (value && String(value).trim()) {
              apiKeyService.setApiKey(name, String(value).trim());
              // Mirror into process.env so already-loaded modules see the new value
              process.env[name] = String(value).trim();
            }
          }
          return { ok: true };
        });

        // IPC: test a single API key against its provider with a tiny auth probe
        ipcMain.handle('annotated:testApiKey', async (event, { name, value }) => {
          const apiKeyService = require('./features/common/services/apiKeyService');
          return apiKeyService.testApiKey(name, value);
        });

        // ── System tray — keeps app alive in background ───────────────────
        const iconPath = path.join(__dirname, 'ui', 'assets', 'logo.ico');
        tray = new Tray(iconPath);
        tray.setToolTip('Annotated — watching for Zoom / YouTube');
        const showOverlayFromTray = () => {
          // Clear user-hidden flag so the detector resumes auto-show behavior
          try { appDetector.setUserHidden?.(false); } catch (_) {}
          const { windowPool } = require('./window/windowManager');
          const win = windowPool?.get('annotated-overlay');
          if (win && !win.isDestroyed()) win.show();
        };
        // ── Voice enrollment from clip — pre-train pyannote voiceprints ──
        const enrollFromClipFlow = async () => {
          try {
            const voiceprintService = require('./features/listen/stt/voiceprintService');

            // Step 1: pick the audio clip
            const fileRes = await dialog.showOpenDialog({
              title: 'Pick a clip of just this person speaking (≥ 5 sec)',
              properties: ['openFile'],
              filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'opus'] }],
            });
            if (fileRes.canceled || !fileRes.filePaths.length) return;
            const filePath = fileRes.filePaths[0];

            // Step 2: prompt for the speaker's name via a tiny BrowserWindow
            //         dialog (Electron has no built-in input prompt).
            const promptHtml = `
              <html><body style="margin:0;font:13px system-ui;background:#1a1a1f;color:#eee;padding:18px;">
                <div style="margin-bottom:8px">Name for this speaker:</div>
                <div style="font-size:11px;color:#888;margin-bottom:14px">From: ${path.basename(filePath)}</div>
                <input id="n" autofocus style="width:100%;padding:8px;font:13px system-ui;background:#2a2a30;border:1px solid #444;color:#fff;border-radius:4px"/>
                <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
                  <button id="cancel" style="padding:6px 14px">Cancel</button>
                  <button id="ok" style="padding:6px 14px;background:#3b82f6;color:#fff;border:0;border-radius:4px">Enroll</button>
                </div>
                <script>
                  const { ipcRenderer } = require('electron');
                  const n = document.getElementById('n');
                  function commit() { ipcRenderer.send('voiceprint-prompt-result', n.value.trim()); }
                  function cancel() { ipcRenderer.send('voiceprint-prompt-result', null); }
                  document.getElementById('ok').onclick = commit;
                  document.getElementById('cancel').onclick = cancel;
                  n.onkeydown = e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); };
                </script>
              </body></html>
            `;
            const promptWin = new BrowserWindow({
              width: 360, height: 180, frame: true, resizable: false,
              alwaysOnTop: true, modal: false, skipTaskbar: true,
              webPreferences: { nodeIntegration: true, contextIsolation: false },
            });
            promptWin.setMenuBarVisibility(false);
            await promptWin.loadURL('data:text/html,' + encodeURIComponent(promptHtml));

            const name = await new Promise(resolve => {
              ipcMain.once('voiceprint-prompt-result', (_e, val) => {
                try { promptWin.close(); } catch(_) {}
                resolve(val);
              });
              promptWin.on('closed', () => resolve(null));
            });
            if (!name) return;

            // Step 3: enroll
            const id = await voiceprintService.enrollFromFile(filePath, name);
            if (id) {
              dialog.showMessageBox({ type: 'info', message: `Enrolled "${name}" successfully.`, detail: `Voiceprint id: ${id}` });
            } else {
              dialog.showMessageBox({ type: 'error', message: `Enrollment failed for "${name}".`, detail: 'Check ~/annotated-debug.log — most likely a clip too short or PYANNOTE_API_KEY issue.' });
            }
          } catch (err) {
            dialog.showMessageBox({ type: 'error', message: 'Enrollment error', detail: String(err.message || err) });
          }
        };

        const trayMenu = Menu.buildFromTemplate([
          { label: 'Show overlay', click: showOverlayFromTray },
          { type: 'separator' },
          { label: 'Enroll voice from clip…', click: enrollFromClipFlow },
          { label: 'API key settings…', click: () => openApiKeySettings() },
          { type: 'separator' },
          { label: 'Quit', click: () => app.quit() },
        ]);
        tray.setContextMenu(trayMenu);
        tray.on('double-click', showOverlayFromTray);

        // ── Auto-start at Windows login ───────────────────────────────────
        if (process.platform === 'win32') {
          app.setLoginItemSettings({
            openAtLogin: true,
            openAsHidden: true,
            path: process.execPath,
            args: [path.resolve(__dirname, '..')],
          });
        }

    } catch (err) {
        console.error('>>> [index.js] Database initialization failed - some features may not work', err);
        // Optionally, show an error dialog to the user
        dialog.showErrorBox(
            'Application Error',
            'A critical error occurred during startup. Some features might be disabled. Please restart the application.'
        );
    }

    // initAutoUpdater should be called after auth is initialized
    initAutoUpdater();

    // Process any pending deep link after everything is initialized
    if (pendingDeepLinkUrl) {
        console.log('[Protocol] Processing pending URL:', pendingDeepLinkUrl);
        handleCustomUrl(pendingDeepLinkUrl);
        pendingDeepLinkUrl = null;
    }
});

app.on('before-quit', async (event) => {
    // Prevent infinite loop by checking if shutdown is already in progress
    if (isShuttingDown) {
        console.log('[Shutdown] 🔄 Shutdown already in progress, allowing quit...');
        return;
    }
    
    console.log('[Shutdown] App is about to quit. Starting graceful shutdown...');
    
    // Set shutdown flag to prevent infinite loop
    isShuttingDown = true;
    
    // Prevent immediate quit to allow graceful shutdown
    event.preventDefault();
    
    try {
        // 0. Stop app detector polling
        appDetector.stopPolling();

        // 1. Stop audio capture first (immediate)
        await listenService.closeSession();
        console.log('[Shutdown] Audio capture stopped');
        
        // 2. End all active sessions (database operations) - with error handling
        try {
            await sessionRepository.endAllActiveSessions();
            console.log('[Shutdown] Active sessions ended');
        } catch (dbError) {
            console.warn('[Shutdown] Could not end active sessions (database may be closed):', dbError.message);
        }
        
        // 3. Shutdown Ollama service (potentially time-consuming)
        console.log('[Shutdown] shutting down Ollama service...');
        const ollamaShutdownSuccess = await Promise.race([
            ollamaService.shutdown(false), // Graceful shutdown
            new Promise(resolve => setTimeout(() => resolve(false), 8000)) // 8s timeout
        ]);
        
        if (ollamaShutdownSuccess) {
            console.log('[Shutdown] Ollama service shut down gracefully');
        } else {
            console.log('[Shutdown] Ollama shutdown timeout, forcing...');
            // Force shutdown if graceful failed
            try {
                await ollamaService.shutdown(true);
            } catch (forceShutdownError) {
                console.warn('[Shutdown] Force shutdown also failed:', forceShutdownError.message);
            }
        }
        
        // 4. Close database connections (final cleanup)
        try {
            databaseInitializer.close();
            console.log('[Shutdown] Database connections closed');
        } catch (closeError) {
            console.warn('[Shutdown] Error closing database:', closeError.message);
        }
        
        console.log('[Shutdown] Graceful shutdown completed successfully');
        
    } catch (error) {
        console.error('[Shutdown] Error during graceful shutdown:', error);
        // Continue with shutdown even if there were errors
    } finally {
        // Actually quit the app now
        console.log('[Shutdown] Exiting application...');
        app.exit(0); // Use app.exit() instead of app.quit() to force quit
    }
});

// Keep running in system tray — do NOT quit when all windows close
app.on('window-all-closed', (e) => {
    // intentionally empty — tray keeps the app alive
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindows();
    }
});

function setupWebDataHandlers() {
    const sessionRepository = require('./features/common/repositories/session');
    const sttRepository = require('./features/listen/stt/repositories');
    const summaryRepository = require('./features/listen/summary/repositories');
    const askRepository = require('./features/ask/repositories');
    const userRepository = require('./features/common/repositories/user');
    const presetRepository = require('./features/common/repositories/preset');

    const handleRequest = async (channel, responseChannel, payload) => {
        let result;
        // const currentUserId = authService.getCurrentUserId(); // No longer needed here
        try {
            switch (channel) {
                // SESSION
                case 'get-sessions':
                    // Adapter injects UID
                    result = await sessionRepository.getAllByUserId();
                    break;
                case 'get-session-details':
                    const session = await sessionRepository.getById(payload);
                    if (!session) {
                        result = null;
                        break;
                    }
                    const [transcripts, ai_messages, summary] = await Promise.all([
                        sttRepository.getAllTranscriptsBySessionId(payload),
                        askRepository.getAllAiMessagesBySessionId(payload),
                        summaryRepository.getSummaryBySessionId(payload)
                    ]);
                    result = { session, transcripts, ai_messages, summary };
                    break;
                case 'delete-session':
                    result = await sessionRepository.deleteWithRelatedData(payload);
                    break;
                case 'create-session':
                    // Adapter injects UID
                    const id = await sessionRepository.create('ask');
                    if (payload && payload.title) {
                        await sessionRepository.updateTitle(id, payload.title);
                    }
                    result = { id };
                    break;
                
                // USER
                case 'get-user-profile':
                    // Adapter injects UID
                    result = await userRepository.getById();
                    break;
                case 'update-user-profile':
                     // Adapter injects UID
                    result = await userRepository.update(payload);
                    break;
                case 'find-or-create-user':
                    result = await userRepository.findOrCreate(payload);
                    break;
                case 'save-api-key':
                    // Use ModelStateService as the single source of truth for API key management
                    result = await modelStateService.setApiKey(payload.provider, payload.apiKey);
                    break;
                case 'check-api-key-status':
                    // Use ModelStateService to check API key status
                    const hasApiKey = await modelStateService.hasValidApiKey();
                    result = { hasApiKey };
                    break;
                case 'delete-account':
                    // Adapter injects UID
                    result = await userRepository.deleteById();
                    break;

                // PRESET
                case 'get-presets':
                    // Adapter injects UID
                    result = await presetRepository.getPresets();
                    break;
                case 'create-preset':
                    // Adapter injects UID
                    result = await presetRepository.create(payload);
                    settingsService.notifyPresetUpdate('created', result.id, payload.title);
                    break;
                case 'update-preset':
                    // Adapter injects UID
                    result = await presetRepository.update(payload.id, payload.data);
                    settingsService.notifyPresetUpdate('updated', payload.id, payload.data.title);
                    break;
                case 'delete-preset':
                    // Adapter injects UID
                    result = await presetRepository.delete(payload);
                    settingsService.notifyPresetUpdate('deleted', payload);
                    break;
                
                // BATCH
                case 'get-batch-data':
                    const includes = payload ? payload.split(',').map(item => item.trim()) : ['profile', 'presets', 'sessions'];
                    const promises = {};
            
                    if (includes.includes('profile')) {
                        // Adapter injects UID
                        promises.profile = userRepository.getById();
                    }
                    if (includes.includes('presets')) {
                        // Adapter injects UID
                        promises.presets = presetRepository.getPresets();
                    }
                    if (includes.includes('sessions')) {
                        // Adapter injects UID
                        promises.sessions = sessionRepository.getAllByUserId();
                    }
                    
                    const batchResult = {};
                    const promiseResults = await Promise.all(Object.values(promises));
                    Object.keys(promises).forEach((key, index) => {
                        batchResult[key] = promiseResults[index];
                    });

                    result = batchResult;
                    break;

                default:
                    throw new Error(`Unknown web data channel: ${channel}`);
            }
            eventBridge.emit(responseChannel, { success: true, data: result });
        } catch (error) {
            console.error(`Error handling web data request for ${channel}:`, error);
            eventBridge.emit(responseChannel, { success: false, error: error.message });
        }
    };
    
    eventBridge.on('web-data-request', handleRequest);
}

async function handleCustomUrl(url) {
    try {
        console.log('[Custom URL] Processing URL:', url);
        
        // Validate and clean URL
        if (!url || typeof url !== 'string' || !url.startsWith('pickleglass://')) {
            console.error('[Custom URL] Invalid URL format:', url);
            return;
        }
        
        // Clean up URL by removing problematic characters
        const cleanUrl = url.replace(/[\\₩]/g, '');
        
        // Additional validation
        if (cleanUrl !== url) {
            console.log('[Custom URL] Cleaned URL from:', url, 'to:', cleanUrl);
            url = cleanUrl;
        }
        
        const urlObj = new URL(url);
        const action = urlObj.hostname;
        const params = Object.fromEntries(urlObj.searchParams);
        
        console.log('[Custom URL] Action:', action, 'Params:', params);

        switch (action) {
            case 'login':
            case 'auth-success':
                await handleFirebaseAuthCallback(params);
                break;
            case 'personalize':
                handlePersonalizeFromUrl(params);
                break;
            default:
                const { windowPool } = require('./window/windowManager.js');
                const header = windowPool.get('header');
                if (header) {
                    if (header.isMinimized()) header.restore();
                    header.focus();
                    
                    const targetUrl = `http://localhost:${WEB_PORT}/${action}`;
                    console.log(`[Custom URL] Navigating webview to: ${targetUrl}`);
                    header.webContents.loadURL(targetUrl);
                }
        }

    } catch (error) {
        console.error('[Custom URL] Error parsing URL:', error);
    }
}

async function handleFirebaseAuthCallback(params) {
    const userRepository = require('./features/common/repositories/user');
    const { token: idToken } = params;

    if (!idToken) {
        console.error('[Auth] Firebase auth callback is missing ID token.');
        // No need to send IPC, the UI won't transition without a successful auth state change.
        return;
    }

    console.log('[Auth] Received ID token from deep link, exchanging for custom token...');

    try {
        const functionUrl = 'https://us-west1-pickle-3651a.cloudfunctions.net/pickleGlassAuthCallback';
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: idToken })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to exchange token.');
        }

        const { customToken, user } = data;
        console.log('[Auth] Successfully received custom token for user:', user.uid);

        const firebaseUser = {
            uid: user.uid,
            email: user.email || 'no-email@example.com',
            displayName: user.name || 'User',
            photoURL: user.picture
        };

        // 1. Sync user data to local DB
        userRepository.findOrCreate(firebaseUser);
        console.log('[Auth] User data synced with local DB.');

        // 2. Sign in using the authService in the main process
        await authService.signInWithCustomToken(customToken);
        console.log('[Auth] Main process sign-in initiated. Waiting for onAuthStateChanged...');

        // 3. Focus the app window
        const { windowPool } = require('./window/windowManager.js');
        const header = windowPool.get('header');
        if (header) {
            if (header.isMinimized()) header.restore();
            header.focus();
        } else {
            console.error('[Auth] Header window not found after auth callback.');
        }
        
    } catch (error) {
        console.error('[Auth] Error during custom token exchange or sign-in:', error);
        // The UI will not change, and the user can try again.
        // Optionally, send a generic error event to the renderer.
        const { windowPool } = require('./window/windowManager.js');
        const header = windowPool.get('header');
        if (header) {
            header.webContents.send('auth-failed', { message: error.message });
        }
    }
}

function handlePersonalizeFromUrl(params) {
    console.log('[Custom URL] Personalize params:', params);
    
    const { windowPool } = require('./window/windowManager.js');
    const header = windowPool.get('header');
    
    if (header) {
        if (header.isMinimized()) header.restore();
        header.focus();
        
        const personalizeUrl = `http://localhost:${WEB_PORT}/settings`;
        console.log(`[Custom URL] Navigating to personalize page: ${personalizeUrl}`);
        header.webContents.loadURL(personalizeUrl);
        
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('enter-personalize-mode', {
                message: 'Personalization mode activated',
                params: params
            });
        });
    } else {
        console.error('[Custom URL] Header window not found for personalize');
    }
}


async function startWebStack() {
  console.log('NODE_ENV =', process.env.NODE_ENV); 
  const isDev = !app.isPackaged;

  const getAvailablePort = () => {
    return new Promise((resolve, reject) => {
      const server = require('net').createServer();
      server.listen(0, (err) => {
        if (err) reject(err);
        const port = server.address().port;
        server.close(() => resolve(port));
      });
    });
  };

  const apiPort = await getAvailablePort();
  const frontendPort = await getAvailablePort();

  console.log(`🔧 Allocated ports: API=${apiPort}, Frontend=${frontendPort}`);

  process.env.pickleglass_API_PORT = apiPort.toString();
  process.env.pickleglass_API_URL = `http://localhost:${apiPort}`;
  process.env.pickleglass_WEB_PORT = frontendPort.toString();
  process.env.pickleglass_WEB_URL = `http://localhost:${frontendPort}`;

  console.log(`🌍 Environment variables set:`, {
    pickleglass_API_URL: process.env.pickleglass_API_URL,
    pickleglass_WEB_URL: process.env.pickleglass_WEB_URL
  });

  const createBackendApp = require('../pickleglass_web/backend_node');
  const nodeApi = createBackendApp(eventBridge);

  const staticDir = app.isPackaged
    ? path.join(process.resourcesPath, 'out')
    : path.join(__dirname, '..', 'pickleglass_web', 'out');

  const fs = require('fs');

  if (!fs.existsSync(staticDir)) {
    console.error(`============================================================`);
    console.error(`[ERROR] Frontend build directory not found!`);
    console.error(`Path: ${staticDir}`);
    console.error(`Please run 'npm run build' inside the 'pickleglass_web' directory first.`);
    console.error(`============================================================`);
    app.quit();
    return;
  }

  const runtimeConfig = {
    API_URL: `http://localhost:${apiPort}`,
    WEB_URL: `http://localhost:${frontendPort}`,
    timestamp: Date.now()
  };
  
  // 쓰기 가능한 임시 폴더에 런타임 설정 파일 생성
  const tempDir = app.getPath('temp');
  const configPath = path.join(tempDir, 'runtime-config.json');
  fs.writeFileSync(configPath, JSON.stringify(runtimeConfig, null, 2));
  console.log(`📝 Runtime config created in temp location: ${configPath}`);

  const frontSrv = express();

  // Parse JSON bodies so proxy routes can read req.body
  frontSrv.use(express.json());

  // 프론트엔드에서 /runtime-config.json을 요청하면 임시 폴더의 파일을 제공
  frontSrv.get('/runtime-config.json', (req, res) => {
    res.sendFile(configPath);
  });

  // ── Debug log endpoint — overlay posts console logs here for main-process visibility ──
  frontSrv.post('/api/debug-log', (req, res) => {
    console.log('[overlay-log]', req.body?.msg || JSON.stringify(req.body));
    res.json({ ok: true });
  });

  // ── Annotated API proxy — forward LLM calls from overlay to apiPort ───────
  // The overlay page makes relative /api/* calls → frontendPort.
  // These routes proxy them to apiPort where backend_node handles them.
  const ANNOTATED_API_PATHS = ['/api/gemini', '/api/cynic-groq', '/api/citations'];
  ANNOTATED_API_PATHS.forEach(apiPath => {
    frontSrv.post(apiPath, async (req, res) => {
      try {
        const target = `http://127.0.0.1:${apiPort}${apiPath}`;
        const upstream = await fetch(target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body),
        });
        const data = await upstream.json();
        res.status(upstream.status).json(data);
      } catch (err) {
        console.error(`[proxy] ${apiPath} failed:`, err.message);
        res.status(500).json({ error: String(err), text: '~' });
      }
    });
  });

  frontSrv.use((req, res, next) => {
    if (req.path.indexOf('.') === -1 && req.path !== '/') {
      const htmlPath = path.join(staticDir, req.path + '.html');
      if (fs.existsSync(htmlPath)) {
        return res.sendFile(htmlPath);
      }
    }
    next();
  });
  
  frontSrv.use(express.static(staticDir));
  
  // Start API server FIRST so proxy routes can reach it immediately
  const apiSrv = express();
  apiSrv.use(nodeApi);

  const apiServer = await new Promise((resolve, reject) => {
    const server = apiSrv.listen(apiPort, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
    app.once('before-quit', () => server.close());
  });

  console.log(`✅ API server started on http://localhost:${apiPort}`);

  const frontendServer = await new Promise((resolve, reject) => {
    const server = frontSrv.listen(frontendPort, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
    app.once('before-quit', () => server.close());
  });

  console.log(`✅ Frontend server started on http://localhost:${frontendPort}`);

  console.log(`🚀 All services ready:
   Frontend: http://localhost:${frontendPort}
   API:      http://localhost:${apiPort}`);

  return frontendPort;
}

// Auto-update initialization
async function initAutoUpdater() {
    if (process.env.NODE_ENV === 'development') {
        console.log('Development environment, skipping auto-updater.');
        return;
    }

    try {
        await autoUpdater.checkForUpdates();
        autoUpdater.on('update-available', () => {
            console.log('Update available!');
            autoUpdater.downloadUpdate();
        });
        autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName, date, url) => {
            console.log('Update downloaded:', releaseNotes, releaseName, date, url);
            dialog.showMessageBox({
                type: 'info',
                title: 'Application Update',
                message: `A new version of Annotated (${releaseName}) has been downloaded. It will be installed the next time you launch the application.`,
                buttons: ['Restart', 'Later']
            }).then(response => {
                if (response.response === 0) {
                    autoUpdater.quitAndInstall();
                }
            });
        });
        autoUpdater.on('error', (err) => {
            console.error('Error in auto-updater:', err);
        });
    } catch (err) {
        console.error('Error initializing auto-updater:', err);
    }
}