# Annotated

**Real-time fact-checking overlay for live podcasts and video.** Transparent, always-on-top, sits above Zoom / YouTube / desktop video. The moment a speaker makes a verifiable claim, a Fact Checker fires — Gemini-grounded search, sourced, cited, archived — right there on screen.

Submission for [Jason Calacanis's $5K annotated.com Sidebar Bounty](https://annotated.lovable.app/).

---

## What it does

- **Transparent overlay** that runs above any app. Toggle `PUBLIC` to make it visible in screen capture / OBS / Zoom share.
- **Fact Checker** — fires on every verifiable claim. Gemini 2.5 Flash + Google Search grounding + redirect resolution → real article URLs, not opaque tokens. Citations get a hover-tooltip with the matched passage from the source page.
- **Speaker identification** — pyannote voiceprints pre-enrolled for the TWiST/All-In cast (Jason, Lon, Oliver, Alex, Chamath, Sacks, Friedberg, Naval, Garry). Tiered confidence gate (HIGH ≥85 + gap≥10, MID 75-84 + gap≥25) tuned against real podcast audio. Click-to-rename with autocomplete for any unidentified speaker.
- **STT** — Speechmatics primary, Deepgram Nova-3 fallback (with `keyterms` for cast names + jargon). Auto-failover on disconnect or rate limit.
- **Auto-collapse** — only the two most-recent cards stay expanded. Older cards collapse to a single-line bar with verdict pill + snippet. Hover to peek, click to pin expanded.
- **Tick rail** — vertical timeline on the right edge. Every card gets a tick; hover for tooltip preview, click to jump-and-pin.
- **Dedupe** — cooldown + claim-entity matching. Won't fire six cards about the same Larry-Summers/Tariff-Debate topic cluster.
- **Trigger-app detection** — overlay auto-appears when Zoom / Chrome / Edge / Discord opens. Auto-hides when they close.
- **Auto-scroll anchored** to whichever is lower: last transcript line OR last card. Disengages on manual scroll; "Latest" button re-engages.

## Try it

**Windows installer** — bundled below. Double-click, runs out of the box. All API keys + voiceprints pre-bundled for the demo.

- Portable EXE (no install): [files.catbox.moe/zlx8hg.zip](https://files.catbox.moe/zlx8hg.zip) (unzip → run `Annotated 1.0.1.exe`)
- Demo video (47 MB): [files.catbox.moe/xk866g.mp4](https://files.catbox.moe/xk866g.mp4)
- Bounty entry: [annotated.lovable.app/entries](https://annotated.lovable.app/entries) — Matt Solomon, May 11

## Stack

| Surface | Tech |
|---|---|
| Shell | Electron 30 (main) + Next.js 14 (renderer) |
| Audio capture | system loopback via Electron desktopCapturer + Web Audio resample → 16k mono PCM |
| STT | Speechmatics realtime (primary) + Deepgram Nova-3 (fallback) |
| Speaker ID | pyannote AI `/v1/identify` against pre-enrolled voiceprints |
| Fact Checker | Gemini 2.5 Flash with `googleSearch` grounding + custom redirect resolver |
| Cynic | (currently disabled while we iterate FC quality) |
| Storage | Supabase + SQLite local mirror |

## Development

```
npm install
cd pickleglass_web && npm install && cd ..
cp .env.example .env  # set GEMINI_API_KEY, DEEPGRAM_API_KEY, SPEECHMATICS_API_KEY, PYANNOTE_API_KEY
npm start             # dev electron + Next.js bundled
```

To build the installer:

```
npm run build:win   # produces dist/Annotated Setup 1.0.1.exe + dist/Annotated 1.0.1.exe
```

## Bounty spec coverage

| Spec requirement | Status |
|---|---|
| Real-time overlay above Zoom / podcasts | ✅ |
| Fact Checker fires on verifiable claims with sources + citations | ✅ |
| Speaker identification + transcript | ✅ |
| Public mode for streamers (overlay visible in capture) | ✅ |
| "File a claim" path | partial — click-to-rename + manual triggers planned |
| Annotated landing page per card | partial — `annotated.com` redirects to LAUNCH; landing-page render scaffolded but not yet live |
| OAuth via X / Google | planned |
| Public social feed with follow / comment | planned |

## Authors

[Matt Solomon](https://twoshares.app) — [@Matt_Solomon110](https://x.com/Matt_Solomon110)

Built on top of [pickle-com/glass](https://github.com/pickle-com/glass) (Apache-2.0). Original README preserved as `UPSTREAM_README.md`.
