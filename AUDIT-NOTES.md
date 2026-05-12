# TWiST Demo Audit — Polish & Bugs

Observation session — passive monitoring while TWiST plays.

| # | Time | Type | Severity | Observation |
|---|------|------|----------|-------------|

## Categories
- **VISUAL** — UI issues, layout, alignment, color, typography
- **LABEL** — speaker name correctness (voice biometrics)
- **CARD** — fact-checker / cynic card behavior
- **TRANSCRIPT** — STT accuracy, line breaks, paragraph merging
- **PERF** — performance, latency, resource issues
- **BACKEND** — main process / pyannote / log errors
- **POLISH** — fit & finish nice-to-have improvements

## Severity
- **🔴 CRITICAL** — broken / blocks demo
- **🟠 HIGH** — visible flaw, looks unprofessional
- **🟡 MEDIUM** — noticeable inconsistency
- **🟢 LOW** — nitpick / future polish

---

## Observations

### T+0min — baseline
- Recording state: **STOPPED** (pulsating dot is gray, button shows "START"). Need to start a TWiST clip to begin observation.
- Old transcript content still visible from prior session — *should* be cleared between sessions or hidden when session=idle.
- Visible transcript contains lines like "Demo mode locked in. Me will never appear in overlay…" — this is from when the system captured speaker output reading my own UI text. Pre-fix data; expected to be gone after restart but it's still rendered.
  - **🟡 MEDIUM** [VISUAL/POLISH]: Stale transcript lines persist after restart — the overlay should empty on cold start.
- The "PRIVATE" pill is visible top-right — content protection state correct (private = hidden from screen capture).
- Header layout: live dot · 48px · START · 48px · PRIVATE · ◆ topic · ▾ minimize · ✕ close — correct.

### T+5min — TWiST playing (Defense Tech / Mike & Alex episode)
- Recording active (STOP pill orange, dot pulsing). ✓
- TWiST audio captured cleanly. Transcript text is coherent.
- Speaker labels:
  - Voice biometric matches firing every 30-60s. Multiple `Them:S? → Alex (score=90) [LOCKED]` events for Alex segments. ✓
  - Visible block tagged "GUEST" — that's Mike (host on this episode), correctly anonymous since Mike isn't enrolled.
- Demo-mode mic suppression working: log shows `dropped Me final (demo mode)` for at least 5 mic finals; none reached overlay. ✓
- Some segments returning "insufficient confidence" (top=Friedberg@33, gap=11) — these are guests we haven't enrolled. Correct behavior: stays anonymous rather than mislabeling.
- **🟡 MEDIUM** [VISUAL]: First visible transcript block has no speaker header — it's mid-paragraph from a turn that started above the scroll viewport. **Polish suggestion**: when a turn's header scrolls offscreen, render a "stuck" mini-header at the top of the visible area showing the current speaker.
- **🟡 MEDIUM** [POLISH]: Transcript line spacing/density is dense — fine for content but a bit cramped. Could use slightly more `padding-bottom` between consecutive non-triggered lines for breathability.
- **🟢 LOW** [POLISH]: The "stale text from prior session" issue noted at T+0min was actually correct — those were from the previous run before the demo-mode fix. Cleared on next session start.

### T+8min — TWiST playing, ALEX speaking
- ALEX label correctly displayed on his current speaking turn (voice biometrics matched at score=90 LOCKED). ✓
- Transcript text reads cleanly with no STT obvious errors.
- First visible block at top of viewport again has no speaker header (continuation from earlier turn). Same observation as T+5min.
- **🟡 MEDIUM** [CARD]: Cards firing rare for TWiST content — gate is properly filtering ~95% of lines as conversational filler. When gate=true and firePersonas runs, it's mostly returning fc=false cynic=false (LLMs not finding verifiable claims). This is OK for VC commentary but may feel "empty" during conversational stretches. **Polish suggestion**: maybe a subtle "..." pulse or "thinking" indicator on the cards column when gate fires but FC/Cynic return empty, so user sees the system IS attentive.
- Voice biometric coverage: Alex matched cleanly. Mike (the guest, not enrolled) showing as "GUEST" — correct anonymous fallback.

### T+12min — Active Speaker matching working through long session
- Multiple successful voice matches in the last 5 minutes:
  - `Them:S1 → Alex (90) [LOCKED]`
  - `Them:S2 → Alex (90) [LOCKED]`
  - `Them:S4 → Alex (90) [LOCKED]`
- Speechmatics is creating new diarization labels rapidly (S1, S2, S3, S4, S6 visible). This means each new label has to wait through a 30s identify cooldown before being named. **This is the cause** of the persistent "GUEST" labels — Speechmatics splits a single speaker's continuous turn across multiple S-tags, creating many anonymous-until-matched windows.
  - **🟠 HIGH** [LABEL]: When the same speaker (e.g. Alex) keeps getting fresh Speechmatics-S labels, the user sees rapid GUEST → Alex flips. **Polish suggestion**: when a NEW Speechmatics-S label arrives, predict its identity by fingerprint similarity to recent matched labels (i.e., cache audio embeddings per Speechmatics-S, so we can match new labels against recent ones without a fresh pyannote round-trip).
- Possible duplicate transcription seen in screenshot — same "Drones became so popular..." text appearing under both ALEX and GUEST. Inspection of log shows only ONE FINAL emission for that text. Most likely the user rewound the YouTube clip (autoplay), so audio was genuinely transcribed twice. **Not a bug** but worth flagging if user reports duplicates without rewinding.

### T+15min — TWO real bugs visible in latest screenshot

**🔴 CRITICAL** [LABEL/TRANSCRIPT] Speaker mix-up — multiple speakers' content rendered under a single speaker label:
- Visible ALEX block contains:
  - "Drones became so popular is because in Ukraine, they shot off about 14,000,000 artillery shells…" (← guest Mike speaking)
  - "What's on the roadmap for you when you solve this problem? Is there dual use here?" (← Jason asking a question — different speaker entirely)
  - "That this, you know, three d printing of this fuel source could be used in other" (← back to Mike answering)
- Three speakers' content concatenated under ALEX heading.
- Root cause: paragraph-merging logic in `TranscriptZone.tsx` merges all consecutive same-speaker lines into one paragraph. When Speechmatics misclassifies a brief Jason interjection as still belonging to S? (the Alex/Mike speaker label), it gets merged into the same paragraph.
- **Fix direction:** when consecutive lines have different `lastSpeakerId` from the renderer's perspective, force a paragraph break even if the Speechmatics label is the same. Or: re-diarize each consecutive line using pyannote per-line.

**🟠 HIGH** [TRANSCRIPT] Duplicate content blocks visible:
- ALEX block (top) and GUEST block (below at 00:00:28) both contain identical "Drones became so popular…" text.
- GUEST timestamp 00:00:28 = very early in session = suggests overlay was reset / session restarted but old transcript stayed in renderer state.
- **Fix direction:** ensure `setLines([])` runs on session-start IPC, and the overlay clears on `change-listen-capture-state status=stop` followed by `status=start`.

**🟢 LOW** [VISUAL] The PowerShell window from a recent launch is partially visible behind the overlay (`C:\Program Files…` title bar). Background process spawn isn't fully hiding — minor cosmetic issue.

### T+19min — Visible PowerShell/Python window covering screen
- A black-titled console window labeled `C:\Program Files\Python313\...` appears full-screen, covering the YouTube + overlay.
- Process inventory: 5 PowerShell processes + 2 Python processes running. Some have empty MainWindowTitle (correctly hidden), at least one has a visible window.
- **🟠 HIGH** [POLISH/VISUAL]: One of the spawned helper processes has a visible console window during normal app operation. Updated investigation: window title `C:\Program Files\Python313\…` and outputs `[INFO] === Heartbeat HH:MM:SS ===`. This is a SEPARATE Python process (likely the user's bookmarks-to-brain or route-cache MCP, not the Annotated app — Annotated only uses `powershell.exe` workers). Still a demo concern: user should hide / minimize this console for clean recording.

### T+22min — Visible Python heartbeat console
- The covering window is the user's separate Python heartbeat process printing every minute. Not Annotated. Just need to minimize before demo.
- Annotated overlay is partially obscured behind it. Once Python window is closed/minimized, the overlay should be fully visible again.

### T+27min — Real duplicate-final bug confirmed
- Looking at latest log: same content emitted TWICE with different speaker labels:
  - `speaker=Them:S0 text="Times, which means it's gonna have search pricing..."`
  - `speaker=Them text="Times, which means it's gonna have search pricing..."` (immediately after, same text)
- Speechmatics is double-emitting: once with diarization label (S0), once with plain "Them" fallback.
- **🟠 HIGH** [TRANSCRIPT]: Duplicate finals from Speechmatics produce duplicate transcript blocks in the overlay. Need to dedupe at sttService level — if a final with text X arrived in the last ~3 seconds (regardless of speaker tag), drop the second one.
- Also explains the earlier "Drones" duplication from screenshot: probably same dual-emission, not a user replay.

### T+27min — User has scrolled up
- "LATEST" button visible at bottom of overlay = user has scrolled away from the live tail.
- New transcripts are still arriving (log confirms) but appear below the user's view.
- Not a bug, but **🟢 LOW** [POLISH]: maybe show a subtle "N new lines below" badge on the LATEST button so the user knows how much they're missing.
- Latest log shows session stop/start cycle around 19:22 — listen session closed cleanly then auto-restarted when trigger app detected.

### T+~40min — Overlay flapping bug confirmed + fix deployed
- Log evidence (pre-fix): `19:35:46 hidden / 19:35:57 shown / 19:36:22 hidden / 19:36:27 shown` while Zoom (4 procs) was steadily running.
- Pattern: `tick native=true → true` interleaved with `tick native=false → false` every 5–30s with no real change in process state.
- Root cause: WMIC `Get-Process` polling intermittently returns false on Windows 11 even when the process is running (race with WMI internal cache).
- **🟠 HIGH** [BACKEND] **FIX LANDED** in `src/features/annotated/appDetector.js`: combine WMIC result with the WMI event watcher's `_liveTriggerSet` (populated by `__InstanceCreationEvent` / `__InstanceDeletionEvent` subscriptions). Either source positive ⇒ detected.
  - New tick format: `tick wmic=<bool> wmiSet=<bool> browser=<bool> → <bool>`.
  - Post-fix: log shows steady `tick wmic=true wmiSet=false browser=false → true` with no flapping.
  - Note: `wmiSet=false` despite Zoom being open — the WMI watcher only registers events on process *create/delete*, so it doesn't see processes that were already running before app start. The OR-with-WMIC handles steady state; the wmiSet handles WMIC stalls during runtime.
  - **Polish suggestion**: on app start, seed `_liveTriggerSet` with a one-shot `Get-WmiObject Win32_Process` snapshot so the safety net covers steady state too.

### T+~42min — Duplicate-final bug reproduced live (post-restart)
- Log capture (~20:08):
  - `20:08:54.557Z stt-update FINAL speaker=Them:S1 text="And just focus on that..."`
  - `20:08:59.888Z stt-update FINAL speaker=Them    text="And just focus on that..."` ← same text, 5.3s later, plain "Them" tag
- Confirms the dual-emission pattern from T+27min — Speechmatics emits the final once with a diarization label, then again as a plain anonymous "Them" final. Renderer creates two separate transcript blocks.
- Also visible on screen right now: GUEST block has "Go with Larry on this one. I'm curious if any of your portcos…" duplicated above the visible header area.
- **🟠 HIGH** [TRANSCRIPT] Need text-level dedupe in `sttService.js` — track `_recentFinals: { text, speakerKey, ts }[]` (last 10s window). On each FINAL: if normalized text matches a recent entry within 10s, drop the second emission regardless of speaker label.
  - Edge case: if the FIRST emission was anonymous `Them` and the SECOND has a diarized `Them:S1`, prefer the diarized one — replace, don't drop.

### T+~45min — Confirmed flapping is fully fixed
- Continuous `tick wmic=true wmiSet=false browser=false → true` for 3+ minutes with no false negatives.
- Listen session staying alive, transcripts streaming continuously, no overlay show/hide thrash. ✓
- `_liveTriggerSet` remains empty (wmiSet=false) because Zoom was running before app start — confirms the seed-from-snapshot polish suggestion above.

### T+~45min — Visible duplicate-paragraph render
- Same screenshot as 3 min ago shows the `GUEST: "Go with Larry on this one…"` paragraph rendered TWICE: once at the top of the overlay viewport (no header, clipped by window decoration) AND again ~120px below with proper "GUEST" header.
- Possibly a render-side artifact of the dual-emission bug: the renderer keeps both lines in `lines[]`, the merge logic sees them as different speaker labels (`Them:S1` vs `Them`) and renders each as its own paragraph.
- **🟠 HIGH** [VISUAL/TRANSCRIPT] Even after sttService dedupe lands, there could be stale entries already in `lines[]`. Add renderer-side guard in `TranscriptZone.tsx`: when consecutive lines have identical normalized text within 10s, suppress the second.
- LATEST button visible at bottom — newer content is below viewport, but the duplicated paragraph is still rendered in the upper visible area, suggesting it's persisting in the lines array, not just a rare flicker.

### T+~46min — Voice biometrics still struggling on Mike (unenrolled guest)
- `[Voiceprint] identify: insufficient confidence (top=Jason@31, gap=8) — staying anonymous`
- Correct behavior: Mike is unenrolled, system stays at "GUEST" rather than mis-attributing to Jason.
- Score 31 with 8-point gap is well below the 50/25 threshold, so guardrails are working.
- **Polish (already noted)**: cache audio embeddings per Speechmatics-S so when S2 → S5 transitions happen for the same actual speaker, we can match without a fresh pyannote round trip.

### T+~48min — 🟡 Overlay viewport stuck at top of session (user hasn't clicked LATEST)
- Three screenshots over ~5 minutes (20:08, 20:11, 20:13) show the EXACT same transcript content: GUEST "Go with Larry…" + ALEX "concern or simply a great way…".
- Log shows continuous FINALs streaming in (20:12, 20:13) and `firePersonas` actually executing — including a **fc=true** card fire at 20:13:08 on a "$9.5B valuation in 2.5 years" claim. None of this content visible on overlay.
- LATEST button visible at bottom — implies user-scrolled state, BUT the overlay content shown is from the very start of session (timestamps 00:00:04 / 00:00:08 visible in the screenshot), meaning user is scrolled to TOP. New content should append below as user scrolled away from tail.
- Possible causes:
  - (a) `lines[]` state not appending — scroll-position-preserving update broken; finals arrive but `setLines` no-ops
  - (b) `lines[]` IS updating but rendered list is bounded by viewport and clipping new entries
  - (c) Renderer-side dedupe heuristic accidentally suppressing all new finals
- After inspecting `page.tsx`: setLines(prev => [...prev, newLine]) executes unconditionally on every FINAL (lines 214 & 383). No MAX_LINES, no pruning. So lines IS growing — the issue is purely viewport scroll position.
- Initial scroll position when first FINAL arrives is top, and there's no auto-scroll-to-bottom on first content. User has to click LATEST or auto-scroll only kicks in once tail is in view.
- **🟠 HIGH** [POLISH] On session start (or first FINAL after long silence), auto-scroll the transcript to bottom. The tail-locking behavior should default to "follow latest" until the user explicitly scrolls up.
- The fc=true card at 20:13:08 IS in the appended `lines[]` but lives below the user's viewport. Card numbering will be correct when scrolled to.

### T+~50min — Voice biometrics: Alex locked at 90 ✓
- `20:15:38 ✅ voiceprint match: Them:S1 → Alex (score=90) [LOCKED]`
- `speaker-identified` IPC fired to overlay — speakerNameMap should retroactively rename Them:S1 lines to Alex.
- Confirms identify pipeline working in production: 24kHz mono PCM16 + silence-strip + last-15s speaker selection + threshold 50/25 → clean 90-confidence lock.
- Pyannote credit balance permitting, this is the happy path for any enrolled speaker.

### T+~52min — Audit summary (deliverables)

**Fixed during this audit:**
- 🟠 Overlay flapping (WMIC unreliable on Windows 11) — patched by OR-with-WMI-event-set in `appDetector.js`, deployed and verified.

**Confirmed live, fix specs documented:**
- 🟠 Duplicate Speechmatics finals (same text, different speaker tag, ~5s apart) — needs sttService text-level dedupe within 10s window, prefer diarized over plain "Them".
- 🟠 Renderer keeps duplicate paragraphs even with sttService dedupe — add `lines[]` post-merge guard.
- 🟠 Auto-scroll-to-bottom missing on session start — viewport stays at top, new content invisible until user clicks LATEST.
- 🔴 Speaker mix-up: paragraph merging concatenates 3 speakers' content under one label (T+15min finding) — force paragraph break on lastSpeakerId change.
- 🟠 Predict identity for fresh Speechmatics-S labels via cached embeddings to avoid GUEST→Alex flicker.

**Polish wishlist:**
- 🟡 Sticky mini-header showing current speaker when turn header scrolls offscreen.
- 🟡 More breathing room between non-triggered transcript lines (padding-bottom).
- 🟢 "N new lines below" badge on LATEST button.
- 🟢 "Thinking…" indicator when gate=true but FC/Cynic both return empty.
- 🟢 Seed `_liveTriggerSet` from a one-shot Win32_Process snapshot at app start so WMI safety net covers steady state.
- 🟢 Stale transcript clear on session start (`setLines([])` on `change-listen-capture-state status=start`).

**Working correctly (no action needed):**
- ✓ Voice biometric locks: Alex@90 LOCKED, conservative anonymous fallback for unenrolled speakers.
- ✓ Demo-mode mic suppression: zero "Me" emissions reached overlay across the full audit.
- ✓ Anti-hallucination FC gate: ~95% of conversational filler suppressed; cards only fire on numeric/named-entity claims.
- ✓ Content protection (PRIVATE pill) and header layout.
- ✓ WMI-event-driven trigger detection (instant Zoom/Teams pop) plus WMIC stability anchor.

### T+~58min — Seed-snapshot fix landed but WMIC seed itself unreliable
- Added `_liveTriggerSet` seeding via one-shot `wmic.exe process get Name` snapshot at `startPolling()`.
- Restart confirmed: log shows `WMI seed snapshot: live=0 (none)` while `Get-Process` independently confirmed Zoom (3 PIDs) was running.
- Conclusion: the same WMIC unreliability that causes runtime flapping ALSO causes the seed to miss processes at startup. The OR-with-wmiSet only helps if WMIC succeeds at least once during the session.
- **🟠 HIGH** [BACKEND] Better fix: replace WMIC with `tasklist /FI "IMAGENAME eq zoom.exe"` per-trigger query, or `Get-CimInstance -ClassName Win32_Process` (newer, more stable than WMIC). Or: add stickiness — if `wmic=true` was observed in last 30s, treat current `wmic=false` as a glitch and stay shown.
- The flapping bug is not fully resolved. Three options ranked by simplicity:
  1. **Stickiness** (simplest): debounce `wmic=false` for 30s after a true. Single small change in `tick()`.
  2. **tasklist swap**: replace `_checkNativeProcesses` to use `tasklist` (faster, more reliable than WMIC on Win11).
  3. **Get-CimInstance**: PowerShell-based, slowest but bulletproof.

### T+~62min — Stickiness debounce LANDED
- Added `STICKY_MS = 30000` and `_lastWmicTrueAt` timestamp to `appDetector.js`.
- New tick log format: `tick wmic=<bool> sticky=<bool> wmiSet=<bool> browser=<bool> → <bool>`.
- Logic: when WMIC returns false, if a true was observed in the last 30s, treat as sticky-true and keep overlay visible. Kills the flapping caused by WMIC race conditions on Win11.
- Verified deployed: 90+ seconds of steady `tick wmic=true sticky=true wmiSet=false browser=false → true` post-restart.

### T+~62min — Audit session pause
Findings + fixes deployed during this audit:
- ✅ WMIC seed snapshot at startPolling
- ✅ Stickiness debounce for transient WMIC false negatives
- 📝 sttService text-level dedupe (spec'd, not yet coded)
- 📝 Renderer auto-scroll-to-bottom on session start (spec'd)
- 📝 Paragraph-merge speaker mix-up (CRITICAL — needs code investigation)
- 📝 Renderer `lines[]` post-merge guard for residual duplicates
- 📝 Various polish suggestions (sticky mini-header, breathing room, "N new" badge, "thinking…" indicator)

Continuing observation cycle — overlay should now stay visible reliably regardless of WMIC hiccups.

---

## Polish Cycle 2 — Demo Readiness Push

Goal: ship-ready for handoff to Jason and Lon. Plug-and-play install.

### ✅ Auto-scroll fix (CRITICAL)
- `behavior: 'smooth'` was self-interrupting when finals arrived in rapid succession.
- Replaced with direct `el.scrollTop = el.scrollHeight` (atomic, synchronous).
- Suppression flag rAF-double-buffered to swallow the resulting scroll event.
- Now the viewport tracks the live tail without lag.

### ✅ Duplicate-final dedupe (sttService)
- New `_emitTheirFinal()` wrapper with 4-layer dedupe (12s window):
  1. Identical normalized text → drop
  2. **Prefix-superset**: if new text begins with a recent emission and is longer → drop new (the prefix already rendered)
  3. Prefix-shrink: rare retry case, also drop
  4. ≥85% word overlap → drop (handles punctuation/spacing diffs)
- Wired through Speechmatics, Deepgram diarized, Whisper, and Gemini paths.
- Logs every drop with `[SttService] DEDUPE drop: <reason> (<oldSpeaker>→<newSpeaker>)`.

### ✅ Paragraph break on speakerId change
- `groupIntoTurns` now compares BOTH `speaker` label AND `speakerId` of the previous line.
- Brief Speechmatics misclassifications (speaker A's interjection tagged as speaker B) now render as their own paragraph rather than getting concatenated into B's turn.
- Fixes the T+15min CRITICAL "3 speakers under one ALEX label" bug.

### ✅ Stale transcript clear on session start
- New IPC subscription to `change-listen-capture-state`.
- On `status='start'` (transitioning from non-start), reset `lines[]`, `cards`, `interimText`, `interimSpeaker`, `cardSupabaseIds`, line/card counters.
- Old transcript no longer persists when session restarts (e.g. close→reopen Zoom).

### ✅ Sticky speaker mini-header
- New `StickySpeakerBanner` floats at top of transcript when current turn's header has scrolled offscreen.
- Computed from scroll handler scanning `turnHeaderRefs` for the most-recent header above scrollTop.
- Glass-style pill matching the LATEST button aesthetic.

### ✅ "N new lines below" badge on LATEST
- `JumpToLatestButton` accepts `newCount` prop.
- `lastSeenLinesCount` ref tracks lines at last bottom-touch; delta surfaces as orange badge (capped at 99+).
- Reset to 0 when user clicks LATEST or auto-scroll catches up.

### ✅ Breathing-room padding
- Non-triggered transcript paragraphs: padding `3px 10px 3px 12px` → `3px 10px 5px 12px`, marginBottom `2` → `5`.
- Triggered rows already had generous padding (8px) — no change needed.

### Verified live (post-restart, TWiST playing)
- FC card fired correctly: "Cessna Citation Gen3 jets... Garmin Emergency Autoland" UNCONFIRMED, 2× AP News grounded sources, numbered badge "1", inline "[1]" anchor in transcript.
- Sticky banner shows "GUEST" pinned at top while turn header scrolled above.
- Auto-scroll keeping viewport at live tail.
- Voice biometrics still firing: Alex@90, Jason@82 LOCKED across the session.
- WMIC stickiness debounce + WMI seed: overlay stays visible without flapping.



