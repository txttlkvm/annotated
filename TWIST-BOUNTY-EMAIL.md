**To:** bounty@thisweekin.com
**Subject:** Real-time fact-checker overlay built specifically for TWiST — quick demo + free for the show

Jason —

I built **Annotated** — a desktop overlay that fact-checks live podcasts, names speakers automatically, and posts cynic counterpoints in real time. It already has Jason, Lon, Alex, Oliver, Chamath, Sacks, Friedberg, Naval, and Garry pre-enrolled as voiceprints, so the moment a TWiST or All-In clip plays, the overlay names every speaker and fact-checks live claims with primary-source citations (AP, Reuters, SEC, gov, .edu only — no random blogs).

**60-second demo:** [attach `dist/demo.mp4` from the install]

**What you'll see:**
- Open Zoom, Brave, or YouTube → overlay pops in 1–2s
- Live transcript labeled "JASON" / "ALEX" via voice biometrics
- Fact-check cards fire on verifiable claims (numbers, named entities, attribution) with grounded primary sources
- Cynic cards flag rhetorical fallacies the same way
- "Calacanis" never gets misspelled — name-corrector fixes every common ASR mishearing

**Vision: auto-integrates with anotated.com**
Each fact-check / cynic card is one click away from being posted to a public profile at `anotated.com/@you`. So the moment a host or guest's claim gets fact-checked, that card becomes a permanent, citable, shareable artifact — building a creator's "annotation graph" over time. Think Genius for podcasts but live, automatic, and grounded.

**Install (Windows):**
1. Download `Annotated Setup 1.0.0.exe` (107 MB) — link below
2. Double-click. Windows SmartScreen will warn (not yet code-signed) → click "More info" → "Run anyway" once
3. NSIS one-click installer creates a desktop shortcut and tray icon
4. Open Zoom, YouTube, Twitch, or any podcast app → overlay auto-pops
5. Voice biometrics for the All-In + TWiST crew are bundled — no setup, just play any clip

**Tech stack:** Speechmatics + Deepgram failover for STT, Pyannote for voice biometrics, Gemini 2.5 Flash for fact-checking with Google Search grounding, Anthropic Claude for the Cynic, Electron + Next.js for the overlay.

**Cost to TWiST:** zero. I'm shipping you a build with my own bundled API keys and per-recipient billing caps. If you and Lon want to use this on every episode, it's yours. If you want to invest, partner, license — let's talk.

**Bounty hook:** if there's a feature gap (live captions for the YouTube live chat? per-segment chapter exports? built-in Riverside hook?) I'll build it this week.

— Matt
[twoshares.app](https://twoshares.app)

---

*Annotated is built on the Pickle Glass overlay engine, heavily modified. Source available privately on request.*
