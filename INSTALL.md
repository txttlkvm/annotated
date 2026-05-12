# Annotated — Install Guide

> Real-time fact-checker overlay for live podcasts and video. Built for TWiST + All-In hosts.

## What you get

- **Auto-detects** Zoom, Microsoft Teams, OBS, Discord, Slack, Loom (native apps) AND YouTube, Twitch, Spotify, Apple Podcasts, Vimeo, Rumble, Kick, Riverside, Zencastr (browser tabs across Chrome / Edge / Firefox / Brave / Opera / Vivaldi / Arc)
- **Pops the overlay** within 1–2 seconds of any of those starting
- **Names every speaker** via voice biometrics — Jason, Lon, Alex, Oliver, Chamath, Sacks, Friedberg, Naval, Garry are pre-enrolled
- **Fact-checks** verifiable claims (numbers, named entities, attribution) with primary-source citations (AP, Reuters, SEC, gov, .edu — no random blogs)
- **Counter-flags** rhetorical fallacies via the Cynic persona
- **Privacy mode**: the overlay can be hidden from your own screen captures so it doesn't show up in your livestream / recording

## Install (Windows 10/11)

1. **Download** `Annotated Setup 1.0.0.exe` (107 MB)
2. **Double-click** to launch
3. **Windows SmartScreen warning will appear** — "Windows protected your PC". This is expected for any unsigned indie installer.
   - Click **"More info"**
   - Click **"Run anyway"**
   - One-time approval per machine
4. NSIS installer runs silently — no further prompts. Creates a Start menu entry, desktop shortcut, and a tray icon.
5. Annotated launches automatically into the system tray

## First-run

The app starts hidden in the tray. To trigger the overlay:

- **Open Zoom or any podcast app** → overlay pops to the top-left within ~1.5s
- **Open YouTube/Twitch/Riverside in any browser** → same
- Or right-click the tray icon → "Show overlay"

The overlay header has:
- **● START / ● STOP** — manual listen control (auto-resumes after 60s if a trigger app stays open)
- **PRIVATE / PUBLIC** — toggle screen-capture protection
- **▾** — minimize to a thin bar
- **✕** — hide for 90s

## Voice biometrics — already done

9 voiceprints ship bundled and import on first run:
- **All-In:** Jason Calacanis · Chamath Palihapitiya · David Sacks · David Friedberg · Naval Ravikant
- **TWiST:** Jason · Lon Harris · Alex Wilhelm · Oliver Korzen
- **Bonus:** Garry Tan

The moment audio plays, voice biometrics fire on each diarized speaker. Within 5–10 seconds of clean speech, the speaker label upgrades from "Speaker 1" to the real name (e.g., "JASON") and is locked at high confidence (≥80).

## API keys (advanced)

Annotated ships with developer-bundled keys so it works out of the box. To use your own quota:

- **Right-click tray icon → "API key settings…"**
- Each row has a **Test** button — instant green/red feedback
- Paste your own keys for any of: Pyannote, Speechmatics, Deepgram, Gemini, OpenAI, Anthropic, Groq
- Saves encrypted to local userData. Never uploaded.

## Auto-start

The app sets itself to launch hidden at every Windows login. A scheduled task (`AnnotatedWatchdog`) re-spawns it every 5 minutes if it ever crashes. So once installed, you never think about it — open Zoom or any podcast tab, the overlay just appears.

## Uninstall

Settings → Apps → Annotated → Uninstall. Removes the app + tray + watchdog task. Voice biometric DB stays in `%APPDATA%\Annotated\` (delete manually if you want a clean wipe).

## Support

- **Email:** matt@twoshares.app
- **Site:** [twoshares.app](https://twoshares.app)
