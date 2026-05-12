// renderer.js
const listenCapture = require('./listenCapture.js');
const params        = new URLSearchParams(window.location.search);
const isListenView  = params.get('view') === 'listen';

function dbg(msg) {
    try { window.api.debug.log(msg); } catch (e) { console.log('[Renderer-dbg]', msg); }
}

window.pickleGlass = {
    startCapture: listenCapture.startCapture,
    stopCapture: listenCapture.stopCapture,
    isLinux: listenCapture.isLinux,
    isMacOS: listenCapture.isMacOS,
    captureManualScreenshot: listenCapture.captureManualScreenshot,
    getCurrentScreenshot: listenCapture.getCurrentScreenshot,
};

dbg(`renderer.js loaded isListenView=${isListenView}`);

window.api.renderer.onChangeListenCaptureState((_event, { status }) => {
    dbg(`onChangeListenCaptureState status=${status} isListenView=${isListenView}`);
    if (!isListenView) {
        return;
    }
    if (status === "stop") {
        dbg('stopping local capture');
        listenCapture.stopCapture();
    } else {
        dbg('starting local capture via event');
        listenCapture.startCapture().then(() => {
            dbg('startCapture resolved');
        }).catch(err => {
            dbg('startCapture ERROR: ' + String(err));
        });
    }
});

// Catch-up: if the renderer loaded after the auto-start event was already fired
if (isListenView) {
    window.api.listenCapture.isSessionActive().then(active => {
        dbg(`catch-up check: isSessionActive=${active}`);
        if (active) {
            dbg('session already active on load — starting capture (catch-up)');
            listenCapture.startCapture().then(() => {
                dbg('catch-up startCapture resolved');
            }).catch(err => {
                dbg('catch-up startCapture ERROR: ' + String(err));
            });
        }
    }).catch(err => {
        dbg('catch-up isSessionActive ERROR: ' + String(err));
    });
}
