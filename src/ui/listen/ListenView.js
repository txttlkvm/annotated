import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';
import './stt/SttView.js';
import './summary/SummaryView.js';

export class ListenView extends LitElement {
    static styles = css`
        :host {
            display: block;
            width: 100%;
            transform: translate3d(0, 0, 0);
            backface-visibility: hidden;
            transition: transform 0.2s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.2s ease-out;
            will-change: transform, opacity;
        }

        :host(.hiding) {
            animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }

        :host(.showing) {
            animation: slideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        :host(.hidden) {
            opacity: 0;
            transform: translateY(-150%) scale(0.85);
            pointer-events: none;
        }


        * {
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: default;
            user-select: none;
        }

/* Allow text selection in insights responses */
.insights-container, .insights-container *, .markdown-content {
    user-select: text !important;
    cursor: text !important;
}

/* highlight.js 스타일 추가 */
.insights-container pre {
    background: rgba(0, 0, 0, 0.4) !important;
    border-radius: 8px !important;
    padding: 12px !important;
    margin: 8px 0 !important;
    overflow-x: auto !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    white-space: pre !important;
    word-wrap: normal !important;
    word-break: normal !important;
}

.insights-container code {
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace !important;
    font-size: 11px !important;
    background: transparent !important;
    white-space: pre !important;
    word-wrap: normal !important;
    word-break: normal !important;
}

.insights-container pre code {
    white-space: pre !important;
    word-wrap: normal !important;
    word-break: normal !important;
    display: block !important;
}

.insights-container p code {
    background: rgba(255, 255, 255, 0.1) !important;
    padding: 2px 4px !important;
    border-radius: 3px !important;
    color: #ffd700 !important;
}

.hljs-keyword {
    color: #ff79c6 !important;
}

.hljs-string {
    color: #f1fa8c !important;
}

.hljs-comment {
    color: #6272a4 !important;
}

.hljs-number {
    color: #bd93f9 !important;
}

.hljs-function {
    color: #50fa7b !important;
}

.hljs-title {
    color: #50fa7b !important;
}

.hljs-variable {
    color: #8be9fd !important;
}

.hljs-built_in {
    color: #ffb86c !important;
}

.hljs-attr {
    color: #50fa7b !important;
}

.hljs-tag {
    color: #ff79c6 !important;
}
        /* ── Resize handles ─────────────────────────────── */
        .resize-bottom {
            position: absolute;
            bottom: 0; left: 8px; right: 8px;
            height: 10px;
            cursor: s-resize;
            -webkit-app-region: no-drag;
            z-index: 100;
            border-radius: 0 0 16px 16px;
        }
        .resize-right {
            position: absolute;
            top: 8px; right: 0; bottom: 8px;
            width: 10px;
            cursor: e-resize;
            -webkit-app-region: no-drag;
            z-index: 100;
        }
        .resize-corner {
            position: absolute;
            bottom: 0; right: 0;
            width: 28px; height: 28px;
            cursor: se-resize;
            -webkit-app-region: no-drag;
            z-index: 101;
            border-radius: 0 0 16px 0;
            opacity: 0.4;
            transition: opacity 0.15s;
        }
        .resize-corner:hover { opacity: 1; }
        .resize-corner::after {
            content: '';
            position: absolute;
            right: 5px; bottom: 5px;
            width: 10px; height: 10px;
            border-right: 2.5px solid rgba(255,255,255,0.7);
            border-bottom: 2.5px solid rgba(255,255,255,0.7);
            border-radius: 0 0 3px 0;
        }

        .assistant-container {
            display: flex;
            flex-direction: column;
            color: #ffffff;
            box-sizing: border-box;
            position: relative;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            /* Single unified glass pill — nav bar lives inside here */
            background: rgba(0, 0, 0, 0.64);
            box-shadow: 0px 0px 0px 1.5px rgba(255, 255, 255, 0.64) inset;
            border-radius: 16px;
            overflow: hidden;
            width: 100%;
            height: 100%;
            border: none;
        }

        .assistant-container::after,
        .assistant-container::before {
            display: none;
        }

        /* Glass scrollbars */
        ::-webkit-scrollbar {
            width: 4px;
            height: 4px;
        }
        ::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.04);
            border-radius: 2px;
        }
        ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.28);
            border-radius: 2px;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.20);
        }
        ::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.45);
        }

        /* ── Embedded nav bar — exact port of MainHeader.js glass style ── */
        .nav-bar {
            -webkit-app-region: drag;
            height: 47px;
            padding: 2px 10px 2px 13px;
            background: transparent;
            overflow: hidden;
            border-radius: 16px 16px 0 0;
            justify-content: space-between;
            align-items: center;
            display: flex;
            box-sizing: border-box;
            position: relative;
            flex-shrink: 0;
        }

        /* dark background layer */
        .nav-bar::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            border-radius: 16px 16px 0 0;
            z-index: -1;
        }

        /* gradient border layer */
        .nav-bar::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            border-radius: 16px 16px 0 0;
            padding: 1px;
            background: linear-gradient(169deg, rgba(255,255,255,0.17) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.17) 100%);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: destination-out;
            mask-composite: exclude;
            pointer-events: none;
        }

        /* ── Listen pill button ── */
        .nav-listen-btn {
            -webkit-app-region: no-drag;
            height: 26px;
            padding: 0 13px;
            background: transparent;
            border-radius: 9000px;
            justify-content: center;
            width: 78px;
            align-items: center;
            gap: 6px;
            display: inline-flex;
            border: none;
            cursor: pointer;
            color: white;
            font-size: 12px;
            font-weight: 500;
            font-family: 'Helvetica Neue', sans-serif;
            position: relative;
            transition: none;
        }
        .nav-listen-btn:disabled { cursor: default; opacity: 0.8; }

        /* pill background */
        .nav-listen-btn::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.14);
            border-radius: 9000px;
            z-index: -1;
            transition: background 0.15s ease;
        }
        .nav-listen-btn:hover::before { background: rgba(255,255,255,0.18); }
        .nav-listen-btn.active::before { background: rgba(215,0,0,0.5); }
        .nav-listen-btn.active:hover::before { background: rgba(255,20,20,0.6); }
        .nav-listen-btn.done { background-color: rgba(255,255,255,0.6); transition: background-color 0.15s ease; }
        .nav-listen-btn.done::before { display: none; }
        .nav-listen-btn.done::after { display: none; }
        .nav-listen-btn.done .nav-btn-text { color: black; }
        .nav-listen-btn.done .nav-listen-icon svg rect,
        .nav-listen-btn.done .nav-listen-icon svg path { fill: black; }

        /* gradient border on pill */
        .nav-listen-btn::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            border-radius: 9000px;
            padding: 1px;
            background: linear-gradient(169deg, rgba(255,255,255,0.17) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.17) 100%);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: destination-out;
            mask-composite: exclude;
            pointer-events: none;
        }

        /* ── Action groups (Ask / Show-Hide) ── */
        .nav-action {
            -webkit-app-region: no-drag;
            height: 26px;
            box-sizing: border-box;
            justify-content: flex-start;
            align-items: center;
            gap: 9px;
            display: inline-flex;
            padding: 0 8px;
            border-radius: 6px;
            border: none;
            background: transparent;
            cursor: pointer;
            color: white;
            font-size: 12px;
            font-weight: 500;
            font-family: 'Helvetica Neue', sans-serif;
            transition: background 0.15s ease;
        }
        .nav-action:hover { background: rgba(255,255,255,0.10); }

        .nav-btn-text {
            padding-bottom: 1px;
            color: white;
            font-size: 12px;
            font-family: 'Helvetica Neue', sans-serif;
            font-weight: 500;
        }

        .nav-key-badge {
            color: white;
            font-size: 12px;
            font-family: 'Helvetica Neue', sans-serif;
            font-weight: 500;
            background-color: rgba(255,255,255,0.10);
            border-radius: 13%;
            width: 18px;
            height: 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        /* ── Settings button ── */
        .nav-settings-btn {
            -webkit-app-region: no-drag;
            padding: 5px;
            border-radius: 50%;
            background: transparent;
            border: none;
            cursor: pointer;
            color: white;
            display: inline-flex;
            align-items: center;
            transition: background 0.15s ease;
        }
        .nav-settings-btn:hover { background: rgba(255,255,255,0.10); }

        /* ── Minimize button ── */
        .nav-minimize-btn {
            -webkit-app-region: no-drag;
            padding: 5px;
            border-radius: 50%;
            background: transparent;
            border: none;
            cursor: pointer;
            color: rgba(255,255,255,0.75);
            display: inline-flex;
            align-items: center;
            transition: background 0.15s ease, color 0.15s ease;
        }
        .nav-minimize-btn:hover { background: rgba(255,255,255,0.10); color: white; }

        /* ── Loading dots ── */
        .nav-dots {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .nav-dots span {
            width: 6px;
            height: 6px;
            background-color: white;
            border-radius: 50%;
            animation: navPulse 1.4s infinite ease-in-out both;
        }
        .nav-dots span:nth-of-type(1) { animation-delay: -0.32s; }
        .nav-dots span:nth-of-type(2) { animation-delay: -0.16s; }
        @keyframes navPulse {
            0%, 80%, 100% { opacity: 0.2; }
            40% { opacity: 1.0; }
        }

        .nav-listen-icon { display: inline-flex; align-items: center; position: relative; top: 1px; }

        .top-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 16px;
            min-height: 32px;
            position: relative;
            z-index: 1;
            width: 100%;
            box-sizing: border-box;
            flex-shrink: 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .bar-left-text {
            color: white;
            font-size: 13px;
            font-family: 'Helvetica Neue', sans-serif;
            font-weight: 500;
            position: relative;
            overflow: hidden;
            white-space: nowrap;
            flex: 1;
            min-width: 0;
            max-width: 200px;
        }

        .bar-left-text-content {
            display: inline-block;
            transition: transform 0.3s ease;
        }

        .bar-left-text-content.slide-in {
            animation: slideIn 0.3s ease forwards;
        }

        .bar-controls {
            display: flex;
            gap: 4px;
            align-items: center;
            flex-shrink: 0;
            width: 120px;
            justify-content: flex-end;
            box-sizing: border-box;
            padding: 4px;
        }

        .toggle-button {
            display: flex;
            align-items: center;
            gap: 5px;
            background: transparent;
            color: rgba(255, 255, 255, 0.9);
            border: none;
            outline: none;
            box-shadow: none;
            padding: 4px 8px;
            border-radius: 5px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            height: 24px;
            white-space: nowrap;
            transition: background-color 0.15s ease;
            justify-content: center;
        }

        .toggle-button:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .toggle-button svg {
            flex-shrink: 0;
            width: 12px;
            height: 12px;
        }

        .copy-button {
            background: transparent;
            color: rgba(255, 255, 255, 0.9);
            border: none;
            outline: none;
            box-shadow: none;
            padding: 4px;
            border-radius: 3px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 24px;
            height: 24px;
            flex-shrink: 0;
            transition: background-color 0.15s ease;
            position: relative;
            overflow: hidden;
        }

        .copy-button:hover {
            background: rgba(255, 255, 255, 0.15);
        }

        .copy-button svg {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
        }

        .copy-button .check-icon {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
        }

        .copy-button.copied .copy-icon {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
        }

        .copy-button.copied .check-icon {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }

        .timer {
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.7);
        }
        
        /* ────────────────[ GLASS BYPASS ]─────────────── */
        :host-context(body.has-glass) .assistant-container,
        :host-context(body.has-glass) .top-bar,
        :host-context(body.has-glass) .toggle-button,
        :host-context(body.has-glass) .copy-button,
        :host-context(body.has-glass) .transcription-container,
        :host-context(body.has-glass) .insights-container,
        :host-context(body.has-glass) .stt-message,
        :host-context(body.has-glass) .outline-item,
        :host-context(body.has-glass) .request-item,
        :host-context(body.has-glass) .markdown-content,
        :host-context(body.has-glass) .insights-container pre,
        :host-context(body.has-glass) .insights-container p code,
        :host-context(body.has-glass) .insights-container pre code {
            background: transparent !important;
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
        }

        :host-context(body.has-glass) .assistant-container::before,
        :host-context(body.has-glass) .assistant-container::after {
            display: none !important;
        }

        :host-context(body.has-glass) .toggle-button:hover,
        :host-context(body.has-glass) .copy-button:hover,
        :host-context(body.has-glass) .outline-item:hover,
        :host-context(body.has-glass) .request-item.clickable:hover,
        :host-context(body.has-glass) .markdown-content:hover {
            background: transparent !important;
            transform: none !important;
        }

        :host-context(body.has-glass) .transcription-container::-webkit-scrollbar-track,
        :host-context(body.has-glass) .transcription-container::-webkit-scrollbar-thumb,
        :host-context(body.has-glass) .insights-container::-webkit-scrollbar-track,
        :host-context(body.has-glass) .insights-container::-webkit-scrollbar-thumb {
            background: transparent !important;
        }
        :host-context(body.has-glass) * {
            animation: none !important;
            transition: none !important;
            transform: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            box-shadow: none !important;
        }

        :host-context(body.has-glass) .assistant-container,
        :host-context(body.has-glass) .stt-message,
        :host-context(body.has-glass) .toggle-button,
        :host-context(body.has-glass) .copy-button {
            border-radius: 0 !important;
        }

        :host-context(body.has-glass) ::-webkit-scrollbar,
        :host-context(body.has-glass) ::-webkit-scrollbar-track,
        :host-context(body.has-glass) ::-webkit-scrollbar-thumb {
            background: transparent !important;
            width: 0 !important;      /* 스크롤바 자체 숨기기 */
        }
        :host-context(body.has-glass) .assistant-container,
        :host-context(body.has-glass) .top-bar,
        :host-context(body.has-glass) .toggle-button,
        :host-context(body.has-glass) .copy-button,
        :host-context(body.has-glass) .transcription-container,
        :host-context(body.has-glass) .insights-container,
        :host-context(body.has-glass) .stt-message,
        :host-context(body.has-glass) .outline-item,
        :host-context(body.has-glass) .request-item,
        :host-context(body.has-glass) .markdown-content,
        :host-context(body.has-glass) .insights-container pre,
        :host-context(body.has-glass) .insights-container p code,
        :host-context(body.has-glass) .insights-container pre code {
            background: transparent !important;
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
        }

        :host-context(body.has-glass) .assistant-container::before,
        :host-context(body.has-glass) .assistant-container::after {
            display: none !important;
        }

        :host-context(body.has-glass) .toggle-button:hover,
        :host-context(body.has-glass) .copy-button:hover,
        :host-context(body.has-glass) .outline-item:hover,
        :host-context(body.has-glass) .request-item.clickable:hover,
        :host-context(body.has-glass) .markdown-content:hover {
            background: transparent !important;
            transform: none !important;
        }

        :host-context(body.has-glass) .transcription-container::-webkit-scrollbar-track,
        :host-context(body.has-glass) .transcription-container::-webkit-scrollbar-thumb,
        :host-context(body.has-glass) .insights-container::-webkit-scrollbar-track,
        :host-context(body.has-glass) .insights-container::-webkit-scrollbar-thumb {
            background: transparent !important;
        }
        :host-context(body.has-glass) * {
            animation: none !important;
            transition: none !important;
            transform: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            box-shadow: none !important;
        }

        :host-context(body.has-glass) .assistant-container,
        :host-context(body.has-glass) .stt-message,
        :host-context(body.has-glass) .toggle-button,
        :host-context(body.has-glass) .copy-button {
            border-radius: 0 !important;
        }

        :host-context(body.has-glass) ::-webkit-scrollbar,
        :host-context(body.has-glass) ::-webkit-scrollbar-track,
        :host-context(body.has-glass) ::-webkit-scrollbar-thumb {
            background: transparent !important;
            width: 0 !important;
        }
    `;

    static properties = {
        viewMode: { type: String },
        isHovering: { type: Boolean },
        isAnimating: { type: Boolean },
        copyState: { type: String },
        elapsedTime: { type: String },
        captureStartTime: { type: Number },
        isSessionActive: { type: Boolean },
        hasCompletedRecording: { type: Boolean },
        // Nav bar state
        listenSessionStatus: { type: String },
        isTogglingSession: { type: Boolean },
        shortcuts: { type: Object },
    };

    constructor() {
        super();
        this.isSessionActive = false;
        this.hasCompletedRecording = false;
        this.viewMode = 'insights';
        this.isHovering = false;
        this.isAnimating = false;
        this.elapsedTime = '00:00';
        this.captureStartTime = null;
        this.timerInterval = null;
        this.adjustHeightThrottle = null;
        this.isThrottled = false;
        this.copyState = 'idle';
        this.copyTimeout = null;
        // Nav bar
        this.listenSessionStatus = 'beforeSession';
        this.isTogglingSession = false;
        this.shortcuts = {};
        this.dragState = null;
        this.wasJustDragged = false;

        this.adjustWindowHeight = this.adjustWindowHeight.bind(this);
        this._handleNavMouseMove = this._handleNavMouseMove.bind(this);
        this._handleNavMouseUp = this._handleNavMouseUp.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        // Only start timer if session is active
        if (this.isSessionActive) {
            this.startTimer();
        }
        if (window.api) {
            // Nav bar: session toggle result
            this._sessionResultListener = (event, { success }) => {
                if (success) {
                    this.listenSessionStatus = ({
                        beforeSession: 'inSession',
                        inSession: 'afterSession',
                        afterSession: 'beforeSession',
                    })[this.listenSessionStatus] || 'beforeSession';
                } else {
                    this.listenSessionStatus = 'beforeSession';
                }
                this.isTogglingSession = false;
                this.requestUpdate();
            };
            window.api.mainHeader.onListenChangeSessionResult(this._sessionResultListener);

            this._shortcutListener = (event, keybinds) => {
                this.shortcuts = keybinds;
                this.requestUpdate();
            };
            window.api.mainHeader.onShortcutsUpdated(this._shortcutListener);

            window.api.listenView.onSessionStateChanged((event, { isActive }) => {
                const wasActive = this.isSessionActive;
                this.isSessionActive = isActive;

                if (!wasActive && isActive) {
                    this.hasCompletedRecording = false;
                    this.startTimer();
                    // Reset child components
                    this.updateComplete.then(() => {
                        const sttView = this.shadowRoot.querySelector('stt-view');
                        const summaryView = this.shadowRoot.querySelector('summary-view');
                        if (sttView) sttView.resetTranscript();
                        if (summaryView) summaryView.resetAnalysis();
                    });
                    this.requestUpdate();
                }
                if (wasActive && !isActive) {
                    this.hasCompletedRecording = true;
                    this.stopTimer();
                    this.requestUpdate();
                }
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.stopTimer();

        if (this.adjustHeightThrottle) {
            clearTimeout(this.adjustHeightThrottle);
            this.adjustHeightThrottle = null;
        }
        if (this.copyTimeout) {
            clearTimeout(this.copyTimeout);
        }
        if (window.api) {
            if (this._sessionResultListener) window.api.mainHeader.removeOnListenChangeSessionResult(this._sessionResultListener);
            if (this._shortcutListener) window.api.mainHeader.removeOnShortcutsUpdated(this._shortcutListener);
        }
        window.removeEventListener('mousemove', this._handleNavMouseMove, { capture: true });
    }

    // ── Nav bar drag ──
    async handleNavMouseDown(e) {
        if (e.target.closest('button')) return; // buttons handle their own clicks
        e.preventDefault();
        if (!window.api) return;
        const pos = await window.api.mainHeader.getHeaderPosition();
        this.dragState = {
            initialMouseX: e.screenX,
            initialMouseY: e.screenY,
            initialWindowX: pos.x,
            initialWindowY: pos.y,
            moved: false,
        };
        window.addEventListener('mousemove', this._handleNavMouseMove, { capture: true });
        window.addEventListener('mouseup', this._handleNavMouseUp, { once: true, capture: true });
    }

    _handleNavMouseMove(e) {
        if (!this.dragState) return;
        if (Math.abs(e.screenX - this.dragState.initialMouseX) > 3 ||
            Math.abs(e.screenY - this.dragState.initialMouseY) > 3) {
            this.dragState.moved = true;
        }
        const newX = this.dragState.initialWindowX + (e.screenX - this.dragState.initialMouseX);
        const newY = this.dragState.initialWindowY + (e.screenY - this.dragState.initialMouseY);
        if (window.api) window.api.mainHeader.moveHeaderTo(newX, newY);
    }

    _handleNavMouseUp() {
        if (!this.dragState) return;
        const wasDragged = this.dragState.moved;
        window.removeEventListener('mousemove', this._handleNavMouseMove, { capture: true });
        this.dragState = null;
        if (wasDragged) {
            this.wasJustDragged = true;
            setTimeout(() => { this.wasJustDragged = false; }, 0);
        }
    }

    // ── Nav bar button handlers ──
    async _handleListenClick() {
        if (this.wasJustDragged || this.isTogglingSession) return;
        this.isTogglingSession = true;
        this.requestUpdate();
        try {
            const text = { beforeSession: 'Listen', inSession: 'Stop', afterSession: 'Done' }[this.listenSessionStatus] || 'Listen';
            if (window.api) await window.api.mainHeader.sendListenButtonClick(text);
        } catch (e) {
            console.error(e);
            this.isTogglingSession = false;
        }
    }

    async _handleAskClick() {
        if (this.wasJustDragged) return;
        if (window.api) await window.api.mainHeader.sendAskButtonClick();
    }

    async _handleToggleVisibility() {
        if (this.wasJustDragged) return;
        if (window.api) await window.api.mainHeader.sendToggleAllWindowsVisibility();
    }

    async _handleTogglePanel() {
        if (this.wasJustDragged) return;
        if (window.api) await window.api.annotated.toggle();
    }

    async _handleMinimize() {
        if (this.wasJustDragged) return;
        if (window.api) await window.api.listenView.minimizeWindow();
    }

    _shortcutKey(accelerator) {
        if (!accelerator) return '';
        const map = { 'Cmd':'⌘','Command':'⌘','Ctrl':'⌃','Control':'⌃','Alt':'⌥','Option':'⌥','Shift':'⇧','Enter':'↵' };
        return accelerator.split('+').map(k => map[k] || k).join('');
    }

    startTimer() {
        this.captureStartTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.captureStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60)
                .toString()
                .padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            this.elapsedTime = `${minutes}:${seconds}`;
            this.requestUpdate();
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    adjustWindowHeight() {
        if (!window.api) return;

        this.updateComplete
            .then(() => {
                const topBar = this.shadowRoot.querySelector('.top-bar');
                const activeContent = this.viewMode === 'transcript'
                    ? this.shadowRoot.querySelector('stt-view')
                    : this.shadowRoot.querySelector('summary-view');

                if (!topBar || !activeContent) return;

                const topBarHeight = topBar.offsetHeight;

                const contentHeight = activeContent.scrollHeight;

                const idealHeight = topBarHeight + contentHeight;

                const targetHeight = Math.min(700, idealHeight);

                console.log(
                    `[Height Adjusted] Mode: ${this.viewMode}, TopBar: ${topBarHeight}px, Content: ${contentHeight}px, Ideal: ${idealHeight}px, Target: ${targetHeight}px`
                );

                window.api.listenView.adjustWindowHeight('listen', targetHeight);
            })
            .catch(error => {
                console.error('Error in adjustWindowHeight:', error);
            });
    }

    toggleViewMode() {
        this.viewMode = this.viewMode === 'insights' ? 'transcript' : 'insights';
        this.requestUpdate();
    }

    handleCopyHover(isHovering) {
        this.isHovering = isHovering;
        if (isHovering) {
            this.isAnimating = true;
        } else {
            this.isAnimating = false;
        }
        this.requestUpdate();
    }

    async handleCopy() {
        if (this.copyState === 'copied') return;

        let textToCopy = '';

        if (this.viewMode === 'transcript') {
            const sttView = this.shadowRoot.querySelector('stt-view');
            textToCopy = sttView ? sttView.getTranscriptText() : '';
        } else {
            const summaryView = this.shadowRoot.querySelector('summary-view');
            textToCopy = summaryView ? summaryView.getSummaryText() : '';
        }

        try {
            await navigator.clipboard.writeText(textToCopy);
            console.log('Content copied to clipboard');

            this.copyState = 'copied';
            this.requestUpdate();

            if (this.copyTimeout) {
                clearTimeout(this.copyTimeout);
            }

            this.copyTimeout = setTimeout(() => {
                this.copyState = 'idle';
                this.requestUpdate();
            }, 1500);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    adjustWindowHeightThrottled() {
        if (this.isThrottled) {
            return;
        }

        this.adjustWindowHeight();

        this.isThrottled = true;

        this.adjustHeightThrottle = setTimeout(() => {
            this.isThrottled = false;
        }, 16);
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        if (changedProperties.has('viewMode')) {
            this.adjustWindowHeight();
        }
    }

    handleSttMessagesUpdated(event) {
        // Handle messages update from SttView if needed
        this.adjustWindowHeightThrottled();
    }

    firstUpdated() {
        super.firstUpdated();
        setTimeout(() => this.adjustWindowHeight(), 200);
    }

    render() {
        const displayText = this.isHovering
            ? this.viewMode === 'transcript'
                ? 'Copy Transcript'
                : 'Copy Glass Analysis'
            : this.viewMode === 'insights'
            ? `Live insights`
            : `Glass is Listening ${this.elapsedTime}`;

        const listenText = { beforeSession: 'Listen', inSession: 'Stop', afterSession: 'Done' }[this.listenSessionStatus] || 'Listen';
        const navIsActive = listenText === 'Stop';
        const navIsDone = listenText === 'Done';

        return html`
            <div class="assistant-container">
                <!-- Embedded nav bar — exact glass replica of MainHeader.js -->
                <div class="nav-bar">
                    <!-- Listen/Stop/Done pill -->
                    <button
                        class="nav-listen-btn ${navIsActive ? 'active' : ''} ${navIsDone ? 'done' : ''}"
                        @click=${this._handleListenClick}
                        ?disabled=${this.isTogglingSession}
                    >
                        ${this.isTogglingSession
                            ? html`<div class="nav-dots"><span></span><span></span><span></span></div>`
                            : html`
                                <span class="nav-btn-text">${listenText}</span>
                                <span class="nav-listen-icon">
                                    ${(navIsActive || navIsDone) ? html`
                                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                            <rect width="9" height="9" rx="1" fill="white"/>
                                        </svg>
                                    ` : html`
                                        <svg width="12" height="11" viewBox="0 0 12 11" fill="none">
                                            <path d="M1.69922 2.7515C1.69922 2.37153 2.00725 2.0635 2.38722 2.0635H2.73122C3.11119 2.0635 3.41922 2.37153 3.41922 2.7515V8.2555C3.41922 8.63547 3.11119 8.9435 2.73122 8.9435H2.38722C2.00725 8.9435 1.69922 8.63547 1.69922 8.2555V2.7515Z" fill="white"/>
                                            <path d="M5.13922 1.3755C5.13922 0.995528 5.44725 0.6875 5.82722 0.6875H6.17122C6.55119 0.6875 6.85922 0.995528 6.85922 1.3755V9.6315C6.85922 10.0115 6.55119 10.3195 6.17122 10.3195H5.82722C5.44725 10.3195 5.13922 10.0115 5.13922 9.6315V1.3755Z" fill="white"/>
                                            <path d="M8.57922 3.0955C8.57922 2.71553 8.88725 2.4075 9.26722 2.4075H9.61122C9.99119 2.4075 10.2992 2.71553 10.2992 3.0955V7.9115C10.2992 8.29147 9.99119 8.5995 9.61122 8.5995H9.26722C8.88725 8.5995 8.57922 8.29147 8.57922 7.9115V3.0955Z" fill="white"/>
                                        </svg>
                                    `}
                                </span>
                            `}
                    </button>

                    <!-- Ask -->
                    <button class="nav-action" @click=${this._handleAskClick}>
                        <span class="nav-btn-text">Ask</span>
                        ${this.shortcuts?.nextStep ? html`<span class="nav-key-badge">${this._shortcutKey(this.shortcuts.nextStep)}</span>` : ''}
                    </button>

                    <!-- Show/Hide -->
                    <button class="nav-action" @click=${this._handleToggleVisibility}>
                        <span class="nav-btn-text">Show/Hide</span>
                        ${this.shortcuts?.toggleVisibility ? html`<span class="nav-key-badge">${this._shortcutKey(this.shortcuts.toggleVisibility)}</span>` : ''}
                    </button>

                    <!-- Settings -->
                    <button class="nav-settings-btn"
                        @mouseenter=${() => window.api && window.api.mainHeader.showSettingsWindow()}
                        @mouseleave=${() => window.api && window.api.mainHeader.hideSettingsWindow()}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 17" fill="none">
                            <path d="M8.0013 3.16406C7.82449 3.16406 7.65492 3.2343 7.5299 3.35932C7.40487 3.48435 7.33464 3.65392 7.33464 3.83073C7.33464 4.00754 7.40487 4.17711 7.5299 4.30213C7.65492 4.42716 7.82449 4.4974 8.0013 4.4974C8.17811 4.4974 8.34768 4.42716 8.47271 4.30213C8.59773 4.17711 8.66797 4.00754 8.66797 3.83073C8.66797 3.65392 8.59773 3.48435 8.47271 3.35932C8.34768 3.2343 8.17811 3.16406 8.0013 3.16406ZM8.0013 7.83073C7.82449 7.83073 7.65492 7.90097 7.5299 8.02599C7.40487 8.15102 7.33464 8.32058 7.33464 8.4974C7.33464 8.67421 7.40487 8.84378 7.5299 8.9688C7.65492 9.09382 7.82449 9.16406 8.0013 9.16406C8.17811 9.16406 8.34768 9.09382 8.47271 8.9688C8.59773 8.84378 8.66797 8.67421 8.66797 8.4974C8.66797 8.32058 8.59773 8.15102 8.47271 8.02599C8.34768 7.90097 8.17811 7.83073 8.0013 7.83073ZM8.0013 12.4974C7.82449 12.4974 7.65492 12.5676 7.5299 12.6927C7.40487 12.8177 7.33464 12.9873 7.33464 13.1641C7.33464 13.3409 7.40487 13.5104 7.5299 13.6355C7.65492 13.7605 7.82449 13.8307 8.0013 13.8307C8.17811 13.8307 8.34768 13.7605 8.47271 13.6355C8.59773 13.5104 8.66797 13.3409 8.66797 13.1641C8.66797 12.9873 8.59773 12.8177 8.47271 12.6927C8.34768 12.5676 8.17811 12.4974 8.0013 12.4974Z" fill="white" stroke="white" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>

                    <!-- Panel (toggle annotated overlay) -->
                    <button class="nav-action" @click=${this._handleTogglePanel} title="Show/hide side panel">
                        <span class="nav-btn-text">Panel</span>
                    </button>

                    <!-- Minimize -->
                    <button class="nav-minimize-btn" @click=${this._handleMinimize}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 7h10" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>

                <div class="top-bar">
                    <div class="bar-left-text">
                        <span class="bar-left-text-content ${this.isAnimating ? 'slide-in' : ''}">${displayText}</span>
                    </div>
                    <div class="bar-controls">
                        <button class="toggle-button" @click=${this.toggleViewMode}>
                            ${this.viewMode === 'insights'
                                ? html`
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                                          <circle cx="12" cy="12" r="3" />
                                      </svg>
                                      <span>Show Transcript</span>
                                  `
                                : html`
                                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                          <path d="M9 11l3 3L22 4" />
                                          <path d="M22 12v7a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                                      </svg>
                                      <span>Show Insights</span>
                                  `}
                        </button>
                        <button
                            class="copy-button ${this.copyState === 'copied' ? 'copied' : ''}"
                            @click=${this.handleCopy}
                            @mouseenter=${() => this.handleCopyHover(true)}
                            @mouseleave=${() => this.handleCopyHover(false)}
                        >
                            <svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                            <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M20 6L9 17l-5-5" />
                            </svg>
                        </button>
                    </div>
                </div>

                <stt-view 
                    .isVisible=${this.viewMode === 'transcript'}
                    @stt-messages-updated=${this.handleSttMessagesUpdated}
                ></stt-view>

                <summary-view
                    .isVisible=${this.viewMode === 'insights'}
                    .hasCompletedRecording=${this.hasCompletedRecording}
                ></summary-view>

                <!-- Resize handles -->
                <div class="resize-bottom"></div>
                <div class="resize-right"></div>
                <div class="resize-corner"></div>
            </div>
        `;
    }
}

customElements.define('listen-view', ListenView);
