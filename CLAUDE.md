# Annotated — Claude Code Instructions

## Aesthetic Brief

Make this a flagship commercial classical-literature ereader. Reference: Hagia Sophia, Della Robbia altarpieces, the Lateran apse, Giotto, illuminated manuscripts. It should feel *sacred*, not premium.

**Five materials. Each has one job. Do not reach outside it.**
- **Lapis** (`colors.lapis`): titling only. The banner at the head of every screen, the tab bar at the foot. Never a card. Never more than the frame.
- **Gold leaf** (`colors.action` + `LeafButton`): the single next action per screen. Burnished metal with struck highlight and shadowed foot. Never two actions. Never body text.
- **Rubric** (`colors.rubric`): illuminated initials, chapter headings, ornament. Never a button. Never pressable.
- **Vellum** (`readerPalettes.light`): the reading surface only. Never app chrome.
- **Aubergine stone** (`colors.bg`): the quiet field. Never competing for attention.

**The frame rule:** Lapis at the head, lapis at the foot, aubergine and content between. Lateran in cross-section — gold and lapis at vault and inscription course, plainer stone in the middle. This is why the blue reads as architecture, not decoration.

**Form language:**
- Arches, not pills. (`arch.round` for buttons/chips/fields; `arch.panel` for panels; `arch.niche` for covers)
- Divisions are ruled, not spaced.
- Ornament is not optional. Rules terminate, sections are marked, openings are announced.

**Type:**
- Chrome is serif (`fonts.display`). Body prose is sans (legibility over register).
- Labels are caps, widely tracked. An inscription is never set tight.
- Chapter openings have a raised versal in rubric.

**Hard floors:**
- 44px minimum on every touch target. (`minHeight`/`minWidth`, not hitSlop alone)
- 4.5:1 minimum contrast on text under 18.66px.
- Every ground gets its own ink. (Bronze fails on lapis; use `lapisInk`.)

**The working agreement:** Do not ask for art direction. Do not report back with questions about visual choices. Execute with taste, deploy, verify on production, screenshot the result, and report what is still wrong. Consistency beats correctness of any single element — a new material must appear in its full structural role in the same change that introduces it, or not at all.

**Source of truth:** `DESIGN.md` in the repo root — read it for the full reasoning, the two measurement traps that produce false audit findings, the react-native-web layout gotchas, and the known gaps in priority order.

---

## Verify Against Production

Every deploy must be verified on the live site (`https://annotated-five.vercel.app`), not just locally. The deployment stack (Vercel + React Native Web) can hide issues that only surface when the full pipeline runs.

- **Read-Aloud:** test with real book content in production (the local `/api/text` Gutenberg proxy is Vercel-serverless-only)
- **Text measurement:** measure contrast and touch targets in the browser dev tools against the deployed build, not against local screenshots
- **Measure text nodes, not wrappers.** react-native-web renders a `Pressable` as a wrapper div with browser defaults and puts real styling on a child. Auditing the wrapper produces false findings.
- **Composite the full ancestor alpha stack.** A 14%-opacity wash scored as solid gold produces bogus contrast calculations.

---

## Deploy & Ship

Deploy is authorised — do not stop to ask. Use `npx vercel --prod --yes` from the repo root (a plain `git push` does not reliably trigger a build). Screenshot the result after deploy, report what is still wrong.

---

## Known Technical Constraints

- **No true pointed arch.** Everything is round-headed (`arch.round`) because a real ogive needs SVG and `react-native-svg` is not installed. This is the largest remaining distance from the reference imagery — it is a dependency decision, not a workaround to keep iterating.
- **Covers are plain thumbnails**, not illuminated frames with ornament.
- **Absolutely-positioned boxes cannot centre with `alignSelf`.** They need a full-bleed wrapper with `alignItems: 'center'` around a normally-laid-out child. This bit `Shell` and `App` twice each.
- **Caller styles silently override component layouts.** `Banner` merges as `[styles.wrap, style]`, so a stale `flexDirection: 'row'` on the caller collapses it. Check caller styles when a component's layout appears ignored.
- **Never edit source with PowerShell `Get-Content -Raw | Set-Content`.** It reads as ANSI and writes UTF-8, double-encoding em-dashes into mojibake. Use the Edit tool, always.
