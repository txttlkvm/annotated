// src/bridge/featureBridge.js
const { ipcMain, app, BrowserWindow, desktopCapturer, dialog } = require('electron');
const settingsService = require('../features/settings/settingsService');
const authService = require('../features/common/services/authService');
const whisperService = require('../features/common/services/whisperService');
const ollamaService = require('../features/common/services/ollamaService');
const modelStateService = require('../features/common/services/modelStateService');
const shortcutsService = require('../features/shortcuts/shortcutsService');
const presetRepository = require('../features/common/repositories/preset');
const localAIManager = require('../features/common/services/localAIManager');
const askService = require('../features/ask/askService');
const listenService = require('../features/listen/listenService');
const permissionService = require('../features/common/services/permissionService');
const encryptionService = require('../features/common/services/encryptionService');

module.exports = {
  // Renderer로부터의 요청을 수신하고 서비스로 전달
  initialize() {
    // Settings Service
    ipcMain.handle('settings:getPresets', async () => await settingsService.getPresets());
    ipcMain.handle('settings:get-auto-update', async () => await settingsService.getAutoUpdateSetting());
    ipcMain.handle('settings:set-auto-update', async (event, isEnabled) => await settingsService.setAutoUpdateSetting(isEnabled));  
    ipcMain.handle('settings:get-model-settings', async () => await settingsService.getModelSettings());
    ipcMain.handle('settings:clear-api-key', async (e, { provider }) => await settingsService.clearApiKey(provider));
    ipcMain.handle('settings:set-selected-model', async (e, { type, modelId }) => await settingsService.setSelectedModel(type, modelId));    

    ipcMain.handle('settings:get-ollama-status', async () => await settingsService.getOllamaStatus());
    ipcMain.handle('settings:ensure-ollama-ready', async () => await settingsService.ensureOllamaReady());
    ipcMain.handle('settings:shutdown-ollama', async () => await settingsService.shutdownOllama());

    // Shortcuts
    ipcMain.handle('settings:getCurrentShortcuts', async () => await shortcutsService.loadKeybinds());
    ipcMain.handle('shortcut:getDefaultShortcuts', async () => await shortcutsService.handleRestoreDefaults());
    ipcMain.handle('shortcut:closeShortcutSettingsWindow', async () => await shortcutsService.closeShortcutSettingsWindow());
    ipcMain.handle('shortcut:openShortcutSettingsWindow', async () => await shortcutsService.openShortcutSettingsWindow());
    ipcMain.handle('shortcut:saveShortcuts', async (event, newKeybinds) => await shortcutsService.handleSaveShortcuts(newKeybinds));
    ipcMain.handle('shortcut:toggleAllWindowsVisibility', async () => await shortcutsService.toggleAllWindowsVisibility());

    // Permissions
    ipcMain.handle('check-system-permissions', async () => await permissionService.checkSystemPermissions());
    ipcMain.handle('request-microphone-permission', async () => await permissionService.requestMicrophonePermission());
    ipcMain.handle('open-system-preferences', async (event, section) => await permissionService.openSystemPreferences(section));
    ipcMain.handle('mark-keychain-completed', async () => await permissionService.markKeychainCompleted());
    ipcMain.handle('check-keychain-completed', async () => await permissionService.checkKeychainCompleted());
    ipcMain.handle('initialize-encryption-key', async () => {
        const userId = authService.getCurrentUserId();
        await encryptionService.initializeKey(userId);
        return { success: true };
    });

    // User/Auth
    ipcMain.handle('get-current-user', () => authService.getCurrentUser());
    ipcMain.handle('start-firebase-auth', async () => await authService.startFirebaseAuthFlow());
    ipcMain.handle('firebase-logout', async () => await authService.signOut());

    // App — clicking X on a UI window must NOT kill the whole app, otherwise
    // the overlay/detector dies along with it. Just hide the calling window.
    // Real quit goes through the dedicated "annotated:quitApp" IPC below.
    ipcMain.handle('quit-application', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) win.hide();
    });

    // Explicit quit — invoked from the overlay's three-dot menu "Quit app".
    // This is the ONLY user action that should actually terminate the app.
    ipcMain.handle('annotated:quitApp', () => {
      app.quit();
    });

    // Whisper
    ipcMain.handle('whisper:download-model', async (event, modelId) => await whisperService.handleDownloadModel(modelId));
    ipcMain.handle('whisper:get-installed-models', async () => await whisperService.handleGetInstalledModels());
       
    // General
    ipcMain.handle('get-preset-templates', () => presetRepository.getPresetTemplates());
    ipcMain.handle('get-web-url', () => process.env.pickleglass_WEB_URL || 'http://localhost:3000');

    // Ollama
    ipcMain.handle('ollama:get-status', async () => await ollamaService.handleGetStatus());
    ipcMain.handle('ollama:install', async () => await ollamaService.handleInstall());
    ipcMain.handle('ollama:start-service', async () => await ollamaService.handleStartService());
    ipcMain.handle('ollama:ensure-ready', async () => await ollamaService.handleEnsureReady());
    ipcMain.handle('ollama:get-models', async () => await ollamaService.handleGetModels());
    ipcMain.handle('ollama:get-model-suggestions', async () => await ollamaService.handleGetModelSuggestions());
    ipcMain.handle('ollama:pull-model', async (event, modelName) => await ollamaService.handlePullModel(modelName));
    ipcMain.handle('ollama:is-model-installed', async (event, modelName) => await ollamaService.handleIsModelInstalled(modelName));
    ipcMain.handle('ollama:warm-up-model', async (event, modelName) => await ollamaService.handleWarmUpModel(modelName));
    ipcMain.handle('ollama:auto-warm-up', async () => await ollamaService.handleAutoWarmUp());
    ipcMain.handle('ollama:get-warm-up-status', async () => await ollamaService.handleGetWarmUpStatus());
    ipcMain.handle('ollama:shutdown', async (event, force = false) => await ollamaService.handleShutdown(force));

    // Ask
    ipcMain.handle('ask:sendQuestionFromAsk', async (event, userPrompt) => await askService.sendMessage(userPrompt));
    ipcMain.handle('ask:sendQuestionFromSummary', async (event, userPrompt) => await askService.sendMessage(userPrompt));
    ipcMain.handle('ask:toggleAskButton', async () => await askService.toggleAskButton());
    ipcMain.handle('ask:closeAskWindow',  async () => await askService.closeAskWindow());
    
    // Listen
    ipcMain.handle('listen:start', async () => {
      try {
        await listenService.handleListenRequest('Listen');
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    ipcMain.handle('listen:stop', async () => {
      try {
        await listenService.handleListenRequest('Stop');
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    ipcMain.handle('listen:sendMicAudio', async (event, { data, mimeType }) => {
      return await listenService.handleSendMicAudioContent(data, mimeType);
    });
    ipcMain.handle('listen:sendSystemAudio', async (event, { data, mimeType }) => {
        if (!listenService.sttService) return { success: false, error: 'no stt session' };
        const result = await listenService.sttService.sendSystemAudioContent(data, mimeType);
        if (result?.success) {
            listenService.sendToRenderer('system-audio-data', { data });
        }
        return result ?? { success: false };
    });
    ipcMain.handle('listen:startMacosSystemAudio', async () => await listenService.handleStartMacosAudio());
    ipcMain.handle('listen:stopMacosSystemAudio', async () => await listenService.handleStopMacosAudio());
    ipcMain.handle('update-google-search-setting', async (event, enabled) => await listenService.handleUpdateGoogleSearchSetting(enabled));
    ipcMain.handle('listen:isSessionActive', async () => await listenService.isSessionActive());
    ipcMain.handle('listen:minimize', async () => {
      const { windowPool } = require('../window/windowManager');
      const listenWindow = windowPool?.get('listen');
      if (listenWindow && !listenWindow.isDestroyed()) listenWindow.minimize();
    });

    ipcMain.handle('listen:changeSession', async (event, listenButtonText) => {
      console.log('[FeatureBridge] listen:changeSession from mainheader', listenButtonText);
      try {
        await listenService.handleListenRequest(listenButtonText);
        return { success: true };
      } catch (error) {
        console.error('[FeatureBridge] listen:changeSession failed', error.message);
        return { success: false, error: error.message };
      }
    });

    // Debug log relay — renderer → main process debug file
    const fs = require('fs'), os = require('os'), path = require('path');
    ipcMain.on('debug:log', (_event, msg) => {
      const line = `[${new Date().toISOString()}] [Renderer] ${msg}\n`;
      process.stdout.write(line);
      try { fs.appendFileSync(path.join(os.homedir(), 'annotated-debug.log'), line); } catch {}
    });

    // ModelStateService
    ipcMain.handle('model:validate-key', async (e, { provider, key }) => await modelStateService.handleValidateKey(provider, key));
    ipcMain.handle('model:get-all-keys', async () => await modelStateService.getAllApiKeys());
    ipcMain.handle('model:set-api-key', async (e, { provider, key }) => await modelStateService.setApiKey(provider, key));
    ipcMain.handle('model:remove-api-key', async (e, provider) => await modelStateService.handleRemoveApiKey(provider));
    ipcMain.handle('model:get-selected-models', async () => await modelStateService.getSelectedModels());
    ipcMain.handle('model:set-selected-model', async (e, { type, modelId }) => await modelStateService.handleSetSelectedModel(type, modelId));
    ipcMain.handle('model:get-available-models', async (e, { type }) => await modelStateService.getAvailableModels(type));
    ipcMain.handle('model:are-providers-configured', async () => await modelStateService.areProvidersConfigured());
    ipcMain.handle('model:get-provider-config', () => modelStateService.getProviderConfig());
    ipcMain.handle('model:re-initialize-state', async () => await modelStateService.initialize());

    // LocalAIManager 이벤트를 모든 윈도우에 브로드캐스트
    localAIManager.on('install-progress', (service, data) => {
      const event = { service, ...data };
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('localai:install-progress', event);
        }
      });
    });
    localAIManager.on('installation-complete', (service) => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('localai:installation-complete', { service });
        }
      });
    });
    localAIManager.on('error', (error) => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('localai:error-occurred', error);
        }
      });
    });
    // Handle error-occurred events from LocalAIManager's error handling
    localAIManager.on('error-occurred', (error) => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('localai:error-occurred', error);
        }
      });
    });
    localAIManager.on('model-ready', (data) => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('localai:model-ready', data);
        }
      });
    });
    localAIManager.on('state-changed', (service, state) => {
      const event = { service, ...state };
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('localai:service-status-changed', event);
        }
      });
    });

    // 주기적 상태 동기화 시작
    localAIManager.startPeriodicSync();

    // ModelStateService 이벤트를 모든 윈도우에 브로드캐스트
    modelStateService.on('state-updated', (state) => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('model-state:updated', state);
        }
      });
    });
    modelStateService.on('settings-updated', () => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('settings-updated');
        }
      });
    });
    modelStateService.on('force-show-apikey-header', () => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('force-show-apikey-header');
        }
      });
    });

    // LocalAI 통합 핸들러 추가
    ipcMain.handle('localai:install', async (event, { service, options }) => {
      return await localAIManager.installService(service, options);
    });
    ipcMain.handle('localai:get-status', async (event, service) => {
      return await localAIManager.getServiceStatus(service);
    });
    ipcMain.handle('localai:start-service', async (event, service) => {
      return await localAIManager.startService(service);
    });
    ipcMain.handle('localai:stop-service', async (event, service) => {
      return await localAIManager.stopService(service);
    });
    ipcMain.handle('localai:install-model', async (event, { service, modelId, options }) => {
      return await localAIManager.installModel(service, modelId, options);
    });
    ipcMain.handle('localai:get-installed-models', async (event, service) => {
      return await localAIManager.getInstalledModels(service);
    });
    ipcMain.handle('localai:run-diagnostics', async (event, service) => {
      return await localAIManager.runDiagnostics(service);
    });
    ipcMain.handle('localai:repair-service', async (event, service) => {
      return await localAIManager.repairService(service);
    });
    
    // 에러 처리 핸들러
    ipcMain.handle('localai:handle-error', async (event, { service, errorType, details }) => {
      return await localAIManager.handleError(service, errorType, details);
    });
    
    // 전체 상태 조회
    ipcMain.handle('localai:get-all-states', async (event) => {
      return await localAIManager.getAllServiceStates();
    });

    // Overlay — Annotated (screen sources needed for system audio capture)
    ipcMain.handle('overlay:getDesktopCapturerSources', async () => {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      return sources.map(s => ({ id: s.id, name: s.name }));
    });

    // ── Voice biometrics (pyannote) ──────────────────────────────────────────
    // Enroll the current "Them" speaker by name. Captures the most recent
    // system-audio PCM and POSTs to pyannote /voiceprints, persists locally.
    ipcMain.handle('annotated:enrollVoiceprint', async (_evt, speakerId, name) => {
      try {
        const voiceprintService = require('../features/listen/stt/voiceprintService');
        const stt = listenService.sttService;
        if (!stt) return { success: false, error: 'no stt session' };
        const pcm = stt.getRecentTheirAudio(8);
        if (!pcm || pcm.length < 24000 * 2 * 3) {
          return { success: false, error: 'not enough audio buffered yet (need 3+ seconds)' };
        }
        const id = await voiceprintService.enroll(pcm, name, 24000);
        return id ? { success: true, pyannoteId: id } : { success: false, error: 'enrollment failed' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    // Manual identify — useful for "who's talking now?" from the UI
    ipcMain.handle('annotated:identifyVoice', async () => {
      try {
        const voiceprintService = require('../features/listen/stt/voiceprintService');
        const stt = listenService.sttService;
        if (!stt) return null;
        const pcm = stt.getRecentTheirAudio(6);
        return await voiceprintService.identify(pcm, 24000);
      } catch (e) {
        return null;
      }
    });
    ipcMain.handle('annotated:listVoiceprints', () => {
      try {
        const voiceprintService = require('../features/listen/stt/voiceprintService');
        return voiceprintService.listVoiceprints();
      } catch (_) { return []; }
    });

    // Enroll a speaker from a local audio file. Opens a system file picker
    // (if no path provided) then uploads to pyannote and persists the
    // voiceprint id locally.
    ipcMain.handle('annotated:enrollFromFile', async (event, opts = {}) => {
      try {
        let { filePath, name } = opts;
        if (!filePath) {
          const win = BrowserWindow.fromWebContents(event.sender);
          const res = await dialog.showOpenDialog(win, {
            title: 'Select audio clip of the speaker',
            properties: ['openFile'],
            filters: [
              { name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'opus'] },
            ],
          });
          if (res.canceled || !res.filePaths.length) {
            return { success: false, error: 'cancelled' };
          }
          filePath = res.filePaths[0];
        }
        if (!name || !name.trim()) {
          return { success: false, error: 'name required' };
        }
        const voiceprintService = require('../features/listen/stt/voiceprintService');
        const id = await voiceprintService.enrollFromFile(filePath, name.trim());
        return id ? { success: true, pyannoteId: id, filePath } : { success: false, error: 'enrollment failed (check log)' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    // Annotated overlay — content protection AND always-on-top z-order.
    // PRIVATE (enabled=true):
    //   • setContentProtection(true)  → window is invisible to OS capture
    //   • level 'screen-saver'         → beats fullscreen apps (e.g. Zoom)
    // PUBLIC (enabled=false):
    //   • setContentProtection(false) → capturable in screen recordings
    //   • level 'floating'             → still on top of normal windows but
    //     NOT in the screen-saver z-order, which OBS/Zoom/Windows recorders
    //     often filter out as a "system overlay". Without this lowering,
    //     setContentProtection(false) alone isn't enough — the screen-saver
    //     z-order is what made the overlay invisible in screen captures.
    ipcMain.handle('annotated:setContentProtection', (event, enabled) => {
      const { windowPool } = require('../window/windowManager');
      const win = windowPool?.get('annotated-overlay');
      if (win && !win.isDestroyed()) {
        win.setContentProtection(!!enabled);
        // Re-assert always-on-top with the right level
        if (enabled) {
          win.setAlwaysOnTop(true, 'screen-saver');
        } else {
          win.setAlwaysOnTop(true, 'floating');
        }
      }
    });

    // Annotated detector pause (manual stop — prevents auto-restart)
    ipcMain.handle('annotated:setManualStop', (event, stopped) => {
      try {
        const appDetector = require('../features/annotated/appDetector');
        if (typeof appDetector.setManualStop === 'function') {
          appDetector.setManualStop(!!stopped);
        }
      } catch (_) {}
    });

    // Annotated overlay show/hide.
    // Hide marks the user-hidden flag so the detector won't auto-pop it back
    // up while the trigger app is still running. Toggle/show clears the flag.
    ipcMain.handle('annotated:toggle', () => {
      try {
        const appDetector = require('../features/annotated/appDetector');
        appDetector.setUserHidden?.(false);
      } catch (_) {}
      const { toggleAnnotatedOverlay } = require('../window/windowManager');
      toggleAnnotatedOverlay();
    });
    ipcMain.handle('annotated:hide', () => {
      try {
        const appDetector = require('../features/annotated/appDetector');
        appDetector.setUserHidden?.(true);
      } catch (_) {}
      const { windowPool } = require('../window/windowManager');
      const win = windowPool?.get('annotated-overlay');
      if (win && !win.isDestroyed()) win.hide();
    });
    ipcMain.handle('annotated:openSettings', () => {
      const { windowPool } = require('../window/windowManager');
      const win = windowPool?.get('annotated-overlay');
      if (win && !win.isDestroyed()) win.loadURL(`http://localhost:${process.env.pickleglass_WEB_PORT}/settings`);
    });

    // Overlay — window drag/resize/pass-through IPC
    ipcMain.handle('overlay:getBounds', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return win ? win.getBounds() : null;
    });

    ipcMain.on('overlay:setBounds', (event, bounds) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) win.setBounds(bounds, true); // animated
    });

    ipcMain.on('overlay:startDrag', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      // Nothing needed — -webkit-app-region: drag handles this natively
    });

    ipcMain.on('overlay:setIgnoreMouseEvents', (event, ignore, opts) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) win.setIgnoreMouseEvents(ignore, opts || {});
    });

    console.log('[FeatureBridge] Initialized with all feature handlers.');
  },

  // Renderer로 상태를 전송
  sendAskProgress(win, progress) {
    win.webContents.send('feature:ask:progress', progress);
  },
};