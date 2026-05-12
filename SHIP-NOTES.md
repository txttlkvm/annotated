# Annotated — Ship Package for Jason & Lon

**File to send:** `dist/Annotated Setup 1.0.0.exe` (~107 MB)

**Alt:** `dist/Annotated 1.0.0.exe` (portable single-exe — no install, just run)

---

## Plug-and-play install (recipient steps)

1. Double-click `Annotated Setup 1.0.0.exe`.
2. **Windows SmartScreen will appear** ("Windows protected your PC") because the build isn't code-signed yet. Click **"More info"** → **"Run anyway"**. One-time approval per machine.
3. NSIS one-click installer runs — no prompts. Creates desktop + start-menu shortcuts.
4. Launch via desktop shortcut OR open Zoom / YouTube and the overlay auto-pops.
5. **First-run only** — bundled voiceprint seed imports automatically. Jason / Lon / Oliver / Alex / Chamath / Sacks / Friedberg / Naval / Garry are pre-enrolled. Voice biometrics start working immediately on first speech.

### About the SmartScreen warning

The installer is unsigned (no code-signing cert yet). Windows treats every unsigned `.exe` as suspicious by default. Two paths to suppress:

- **Cheap fix ($70/yr):** OV code-signing cert from Sectigo or SSL.com. Once obtained, `electron-builder.yml` `win.certificateFile` + `win.certificatePassword` env var → no more warning, ever, for anyone.
- **Free workaround:** Recipients click "More info" → "Run anyway". Same warning users see for every indie developer's installer. They only see it once.

Publisher identity is set to `twoshares.app` (visible in right-click → Properties → Details, and in the post-cert SmartScreen flow).

## API keys — how to handle when you ship

The current build bundles **your** API keys inside `.env` as an extraResource. When Jason and Lon use the app, every transcription, fact-check, and voice-identify hits **your** quota and bill. Three ways to handle this:

### Option A — Ship with bundled keys (current state, simplest)
- ✅ Zero setup for recipients. Open and use immediately.
- ❌ You eat all the cost. Speechmatics ~$1/hr, Pyannote ~$0.10/identify, Anthropic ~$0.05/FC card.
- ❌ Keys are extractable from the installed app's `resources/.env` (low security).
- 🟡 Acceptable for friends-and-family beta. Cap risk by using a separate key per recipient and rate-limit at the API console.

### Option B — Per-recipient keys (recommended for paid users)
- Recipients sign up for their own Pyannote / Speechmatics / Anthropic accounts.
- First-run wizard prompts them to paste their keys, stored in `electron-store` per-machine.
- ✅ They pay their own bills.
- ❌ Setup friction (3-5 keys to create accounts for).
- 🟡 Friction-killer: you create accounts on their behalf, pre-fund $20 in each, send credentials.

### Option C — Proxy through your backend (future SaaS path)
- Replace direct API calls with calls to `https://api.twoshares.app/v1/*`.
- Your backend holds the keys, charges users monthly, rate-limits per account.
- ✅ Full revenue control, can offer tiers.
- ❌ Requires backend infrastructure (Vercel + Supabase + Stripe webhooks).
- ❌ Adds 50-150ms latency per call.
- 🟡 Right move at scale, overkill for first 5-10 users.

### Recommendation for this drop
**Stay on Option A for Jason and Lon specifically.** They're 2 users. Total monthly cost <$50 even if they use it daily. Way more important: zero friction so they actually try it. Migrate to Option B before opening to a 10+ user beta.

To rotate / revoke a bundled key: edit `.env`, run `npm run build:win`, send new installer.

## What's bundled

- `.env` — production API keys (Pyannote, Speechmatics, Deepgram, OpenAI, Anthropic, Google) — see API section above.
- `seed-voiceprints.json` — 9 pre-enrolled voiceprints, imported on first run:
  - **All-In crew:** Jason Calacanis, Chamath Palihapitiya, David Sacks, David Friedberg
  - **TWiST crew:** Jason, Lon Harris, Alex Wilhelm, Oliver
  - **Frequent guests:** Naval Ravikant, Garry Tan
- Native `better-sqlite3` for the local voiceprint DB.
- All renderer assets, fact-checker prompts, Cynic prompts.

## What runs in the background

- Auto-launches at login (`openAtLogin: true`, `openAsHidden: true`).
- **Four-layer trigger detection** — overlay fires the moment ANY of these is true:
  1. Native trigger process via `Get-Process` (Zoom/Teams/OBS/Discord/Slack/Webex/Loom/Streamlabs).
  2. WMI event subscription — instant create/delete notifications.
  3. Stickiness debounce — 30-second cache so transient process-list misses don't cause flapping.
  4. Browser tab title — YouTube, Twitch, Google Meet, Riverside, Squadcast, Zencastr, StreamYard, Loom, Zoom, Webex, Teams, Discord, Whereby, Daily.co, Restream, Spotify, Apple Podcasts, Overcast, Audible, TWiST, All-In, Podcast, X Spaces, Vimeo, Rumble, Kick across Chrome / Edge / Firefox / Brave / Opera / Vivaldi / Arc / Zen / LibreWolf / Floorp / Waterfox.
- One-shot snapshot at app start populates the WMI live-set with already-running trigger apps.
- Listen session starts only when at least one detection layer is true — no idle resource use.

## How the user controls it

- **Tray icon** — right-click → "Show overlay" / "Enroll voice from clip…" / "Quit".
- **X button** on overlay — hides for 90 s; auto-unhides if a trigger app stays open.
- **Privacy pill** in header — toggles screen-capture protection (PRIVATE = hidden from screen capture).
- **Start/Stop** in header — manual session control if needed.

## Key fixes baked into 1.0.0

| Bug | Fix |
|-----|-----|
| Overlay flapping show/hide on Win11 | 3-layer detection: WMIC + WMI events + 30s stickiness debounce + startup snapshot |
| Auto-scroll lagging behind live tail | Direct `scrollTop = scrollHeight` (atomic) + rAF-double-buffered suppression flag |
| Same final emitted twice (Speechmatics dup) | sttService 4-rule dedupe (12 s window): identical / prefix-superset / prefix-shrink / 85 % word overlap |
| 3 speakers concatenated under one label | groupIntoTurns now requires both `speaker` AND `speakerId` to match |
| Stale transcript persists across sessions | IPC subscription to `change-listen-capture-state status='start'` clears state |
| First visible block has no speaker header | Sticky speaker mini-header pinned at top while turn header is offscreen |
| User scrolled away misses new lines | Orange count badge on LATEST button (e.g. "LATEST 23") |
| Cards feel dead between fires | "Thinking…" indicator pulses while LLMs run, even when both return empty |
| Demo polluted by user's mic | Demo-mode unconditionally drops all `speaker='Me'` events at IPC layer |
| Plug-and-play voice IDs for the hosts | 9 voiceprints bundled in installer, auto-imported on first run |
| Browser title detection silently broken | Empty regex alternation `\|\|` (from `'\| Meet'`) caused PowerShell `-match` to fail. Patterns sanitized + escaped; YouTube/Twitch/Meet/Spotify/Apple Podcasts/All-In/TWiST/Vimeo/Rumble/Kick all fire now |
| Native process check unreliable on Win11 | Replaced WMIC with `Get-Process` (kernel-level, never stalls). Tasklist + WMIC remain as fallbacks |
| Snapshot seed missing already-running apps | Same Get-Process upgrade — overlay shows even if Zoom/Chrome were running before app launch |
| PowerShell cold-start contention | Timeouts bumped 8s → 15s so first-tick PS calls don't time out under load |

## If recipients want to enroll new voices

- Tray menu → "Enroll voice from clip…" → paste a YouTube URL with a clean ~30 s solo clip → name the speaker.
- The clip downloads, gets diarized, the dominant speaker's audio is uploaded to pyannote, voiceprint stored locally.

## What's not in this build (known gaps)

- Pyannote credit balance — if enrollment 402s, recipient must top up at https://pyannote.ai. Identification (already-enrolled) is much cheaper.
- No auto-update wiring — `electron-updater` is bundled but no public release feed yet. Future versions ship by sending a new `.exe`.
- Mac DMG build is configured but not produced for this drop.

## Verification before shipping

1. ✅ `Annotated Setup 1.0.0.exe` ≥ 14:15 (latest build with all polish).
2. ✅ Open Zoom or YouTube; overlay shows within ~1.5 s.
3. ✅ Speak / play audio; transcripts appear with proper speaker headers.
4. ✅ FC card fires on a verifiable claim (numeric, named entity, attribution).
5. ✅ Voice biometric locks on a known speaker (Alex / Jason / Lon) within ~30 s.
6. ✅ Auto-scroll keeps viewport at live tail.
7. ✅ Overlay stays steady while trigger app runs (no flapping).
