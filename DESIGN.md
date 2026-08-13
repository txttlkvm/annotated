# Annotated — the house style

**This is the brief.** Point at it and say "make this screen match" and there is
enough here to do it without asking. It is written to be executed from, not
admired: every rule below is a decision that has already been made, and the
reasoning is included so the rule can be applied to a case it does not name.

The target in one line: **a sacred book, not a reading app.** Byzantine and
Gothic — Hagia Sophia, the Lateran apse, a Della Robbia altarpiece, Giotto at
the Scrovegni, an illuminated frontispiece. If a screen would look at home in a
settings menu, it is wrong no matter how good its contrast is.

---

## 1. The five materials

The palette is not a list of colours, it is a list of **materials**, each with
one job. Reaching for a colour outside its job is the fastest way to break the
whole thing — this is exactly how the app ended up with an orphan blue band in
an otherwise aubergine screen.

| Material | Token | Job | Never |
|---|---|---|---|
| **Lapis** | `colors.lapis` | Titling and architecture: the banner at the head of a screen, the tab bar at its foot. | A card. A content surface. More than the frame. |
| **Gold leaf** | `colors.action` + `LeafButton` | The single next action on a screen. | Two things on one screen. Body text. |
| **Rubric** | `colors.rubric` / `palette.rubric` | Ornament ink: illuminated initials, chapter headings, section kickers. | A button. Anything pressable. |
| **Vellum** | `readerPalettes.light` | The reading surface only. | App chrome. |
| **Aubergine stone** | `colors.bg` / `surface` | The quiet field everything else sits on. | Competing for attention. |

**The section rule.** Lapis at the head, lapis at the foot, aubergine and its
content between them. That is the Lateran in cross-section — gold and lapis at
the vault and the inscription course, plainer stone in the middle — and it is
why the blue reads as architecture rather than decoration. A lapis element that
is not part of that frame is a mistake.

**Ultramarine cost more than gold.** It was ground from stone hauled out of
Afghanistan, which is exactly why it was reserved for what mattered most. Spend
it like that: titling only, never a whole screen.

---

## 2. Form

**Arch, not pill.** The stadium is the silhouette of a toggle, and the eye reads
silhouette before it reads colour — this is why a gold-on-aubergine app still
read as a SaaS product. Use `arch.round` for buttons, chips and fields;
`arch.panel` for a hero panel; `arch.niche` to frame a cover.

`radius.pill` survives on purpose, for things that genuinely are incidental
tags. If it is pressable or it frames content, it gets an arch.

**Divisions are ruled.** A section is separated by a line, not by whitespace.
Whitespace alone is what makes a screen read as a stack of cards with labels on
top of them. `Section` does this; ornamental breaks use `OrnamentRule`.

**Ornament is not optional.** A sacred book is not distinguished from a settings
screen by hue — it is distinguished by the fact that someone bothered to
decorate it. Rules terminate, sections are marked, openings are announced. Use
`Ornament.tsx`; a rule stops short of its centre mark rather than running under
it, which is what separates typeset ornament from a line with a glyph on top.

---

## 3. Type

Everything in the chrome is set in the **book serif** (`fonts.display`). The UI
sans survives in exactly one place — `type.body`, for running descriptive
prose, where legibility beats register.

Labels are **caps, widely tracked**. An inscription is never set tight, and a
section title is an inscription rather than a sentence. `type.overline` and
`type.caption` already carry this.

The reader opens a chapter with a **raised versal** in rubric. Raised rather
than dropped: React Native cannot wrap text around a floated initial, and a
raised initial is its own manuscript convention (Insular, Carolingian) rather
than a compromise.

---

## 4. Hard floors — non-negotiable, and cheap to check

1. **44px minimum on every touch target.** `HIT_SLOP_MIN`. Apply as
   `minHeight`/`minWidth`, never by inflating padding, so the control keeps its
   visual weight and only its hit box grows. `hitSlop` alone is not sufficient:
   react-native-web honours it unreliably and `getBoundingClientRect` cannot
   see it.
2. **4.5:1 minimum contrast** on text under 18.66px (3:1 above it, or above
   14px when bold). Decorative marks set below 0.9 opacity or under ~0.2 alpha
   are exempt — and should stay exempt rather than being "fixed" louder.
3. **Every ground needs its own ink.** A neutral cut for aubergine will fail on
   lapis — `colors.bronze` measures 3.66:1 there, hence `lapisInk`. When
   introducing a ground, introduce its ink in the same commit.

---

## 5. Verify like this, not by eye

Contrast and hit targets are measured against **the deployed build**, in the
browser, before claiming anything. Two traps that have already produced wrong
conclusions here:

- **Measure text nodes, not wrappers.** react-native-web renders a `Pressable`
  as a wrapper `<div>` with browser-default styles and puts the real styling on
  a child. Auditing the wrapper produced a confident, entirely false report of
  black-on-dark text at 2.04:1.
- **Composite the full ancestor alpha stack.** Taking the first non-transparent
  `backgroundColor` and ignoring its alpha scored a 14%-opacity gold wash as
  solid gold, and invented a 1.38:1 failure that did not exist.

Press feedback is a JS-driven `Animated` transform (`ScaleTouchable`). No CSS
`transition` property will ever show it; do not conclude it is missing.

---

## 6. Two layout traps in react-native-web

Both of these have cost real time in this repo, twice each.

**An absolutely-positioned box cannot centre itself with `alignSelf`.** It will
either pin to one edge or collapse to zero size. Wrap it: a full-bleed absolute
wrapper with `alignItems: 'center'` around a normally-laid-out child. This bit
the page scrim in `Shell` and the arcade in `App`.

**A caller's leftover style silently overrides a component's own layout.**
Components merge as `[ownStyle, props.style]`, so a stale `flexDirection: 'row'`
on the caller collapsed `Banner` to a vertical sliver. When a component's
layout appears to be ignored, read the caller's style before debugging the
component.

---

## 7. Working agreement

Deploy is authorised — do not stop to ask. Verify against production, screenshot
the result, and report what is still wrong rather than waiting to be asked.

**Consistency beats correctness of any single element.** A new material,
silhouette or ornament must appear in its full structural role in the same
change that introduces it, or not at all. One lapis banner in an aubergine app
is worse than no lapis banner — which is precisely the note this document was
written in response to.

Known gaps, in priority order:

1. **No true pointed arch.** Everything is round-headed, because a real ogive
   needs SVG and `react-native-svg` is not installed. This is the largest
   remaining distance from the reference imagery, and it is a dependency
   decision rather than something to keep working around.
2. **Covers are plain thumbnails**, not illuminated objects with their own
   ornament and frame.
3. **Catalog and Curriculum** have the arch and the 44px floor but not the
   banner, ornament or rubrication that Library and the reader carry.
