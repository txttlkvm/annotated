// Design system for Annotated.
//
// The palette was already established across the screens as hardcoded hex —
// deep aubergine with manuscript gold. This centralises it and adds the
// typography, spacing, and elevation scales the screens were missing, which
// is most of why the app read as "basic" despite decent colours.
//
// Retuned against the owner's five reference apps. The references win on
// STRUCTURE, not palette: bigger radii, one saturated accent per screen, far
// more vertical breathing room, and — the big one — a phone-width column that
// stays a phone-width column on a 1365px desktop. Aubergine + gold stays.

import type { ViewStyle } from 'react-native';

export const colors = {
  /** Page background — near-black with a violet cast, easy on the eye at night. */
  bg: '#0f0a1a',
  /** Raised surfaces: cards, headers, bars. */
  surface: '#1a1328',
  /** Surface one step brighter — hover, pressed, selected. */
  surfaceRaised: '#241a36',
  /** Book board colour behind a cover when no image exists. */
  board: '#2d1b4e',

  /** Manuscript gold. Primary text and accents. */
  gold: '#c9a961',
  /** Brighter gold for emphasis and active state. */
  goldBright: '#e3c887',
  /** Muted bronze. Secondary text, borders, metadata.
   *  Lifted from #8b7355, which measured 4.34/4.01/3.67:1 against the page,
   *  surface and raised grounds — under the 4.5:1 AA floor on all three, and
   *  it carries real content (author names, the inactive tab labels, sort
   *  pills). This clears AA everywhere: 5.48 / 5.06 / 4.63. */
  bronze: '#9d8463',

  // ---------------------------------------------------------------------
  // THE action accent. Exactly one saturated colour per screen, reserved for
  // the single next action (Continue Reading, Add to Library, Start Lesson).
  //
  // This was ember orange (#e57c33) — a modern consumer-app CTA colour, and
  // the single loudest reason the app read as a SaaS product rather than a
  // book of hours. In the illuminated tradition the precious material IS the
  // action: a manuscript spends its gold on the initial that opens the text.
  // So the CTA is now burnished gold leaf carrying dark ink, exactly as a
  // Byzantine ground carries its figures, and `leafHi`/`leafLo` give it the
  // bright top edge and shadowed foot that make metal read as metal rather
  // than as a flat yellow rectangle.
  // ---------------------------------------------------------------------
  /** Primary CTA fill — burnished gold. */
  action: '#c9a961',
  /** Struck highlight along a leafed edge. */
  leafHi: '#e8d19a',
  /** Shadowed foot of a leafed edge. */
  leafLo: '#9c7c3f',
  /** Label/icon colour to sit ON an `action` fill (9.4:1 — never gold or white). */
  actionInk: '#1a1206',
  /** Tinted wash for the CTA's halo, selected pills, progress fills. */
  actionSoft: 'rgba(201, 169, 97, 0.16)',
  /** Hairline for an outlined variant of the CTA. */
  actionBorder: 'rgba(201, 169, 97, 0.45)',

  // ---------------------------------------------------------------------
  // RUBRICATION. "Rubric" is literally "in red" — the ink a scribe switched
  // to for the parts that were not the text itself: the initial, the chapter
  // number, the liturgical instruction. It is an ORNAMENT ink, never a CTA,
  // and it never competes with `action` because it never sits on anything
  // you are meant to press.
  // ---------------------------------------------------------------------
  /** Vermilion, as ground cinnabar. Drop caps, chapter numerals, fleurons. */
  rubric: '#c2453a',
  /** The same red at label weight, for small text on a raised ground. */
  rubricInk: '#d4695e',
  /** Lapis — the costliest pigment on the medieval palette, so it is spent
   *  as sparingly here: secondary ornament only. */
  lapis: '#3f5a94',

  /** Body copy in the reader — warm off-white, never pure #fff. */
  ink: '#ece4d8',
  /** Secondary body copy. */
  inkMuted: '#a99e8f',

  /** Hairline dividers. */
  rule: 'rgba(201, 169, 97, 0.18)',
  /** Card borders — softer than the old solid bronze. */
  border: 'rgba(201, 169, 97, 0.28)',

  success: '#7fa96b',
  danger: '#b4574d',
};

/**
 * Rubrication for the three stages of the trivium — the coloured dot and label
 * on a Catalog or Curriculum card.
 *
 * Declared here rather than in each screen because it was duplicated verbatim
 * in both, and because the semantic `colors.danger` it used to borrow for
 * rhetoric is tuned for a destructive BUTTON, not for 11px label text: it
 * measured 3.46:1 on the raised surface these labels sit on, under the 4.5:1
 * that size owes. These are the same three hues, cut to read at label size.
 */
export const stageInk = {
  /** colors.success, which already clears AA on every ground it lands on. */
  grammar: '#7fa96b',
  logic: '#c9a961',
  /** colors.danger lifted from #b4574d (3.46:1) to 5.16:1 on surfaceRaised. */
  rhetoric: '#cc7a6f',
} as const;

/**
 * Serif stacks chosen to need no font downloads. Palatino and Iowan Old Style
 * are genuinely beautiful book faces and ship on macOS/iOS/Windows; Georgia is
 * the universal fallback.
 */
export const fonts = {
  /** Display: titles, headings, anything decorative. */
  display: "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
  /** Reading: long-form body text in the reader. */
  reading: "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
  /** UI: labels, metadata, buttons — sans for contrast against the serif. */
  ui: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
};

/**
 * 4pt base scale. Consistent rhythm is most of what reads as "designed".
 *
 * The small end (xs..lg) is UNCHANGED — it is the inner padding of every card
 * and chip in the app, and loosening it would just make everything puffy. What
 * the references actually have more of is the space BETWEEN blocks, so the
 * large end grew and a named `section` step was added.
 */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  /** Was 24. Bumped to the bottom of the reference's 28–32 section band. */
  xl: 28,
  /** Was 32. The gap between a section and the next section's heading. */
  xxl: 36,
  /** Was 48. Scroll-tail padding and empty-state breathing room. */
  xxxl: 56,
  /** Canonical between-sections rhythm. Use this for `section { marginBottom }`. */
  section: 32,
  /** Gap between a section heading and the content it heads. */
  heading: 14,
};

export const radius = {
  /** Was 4. Badges, swatches, tiny inline chips. */
  sm: 8,
  /** Was 8. Buttons, inputs, list tiles — and the cover corner in BookCover. */
  md: 12,
  /** Was 14. THE card radius from the references. */
  lg: 22,
  /** Hero panels — the Continue Reading card, featured banners, sheets. */
  hero: 28,
  /** Book covers. Deliberately tighter than a card so the cover reads as an
   *  object sitting on the card, not as part of it. */
  cover: 12,
  /** Chips, tabs and filter pills are fully round in every reference. */
  pill: 999,
};

/**
 * ARCHES.
 *
 * The stadium pill is the most modern shape there is — it is the shape of a
 * toggle, a tag input, a consumer CTA — and the app was built out of them:
 * pill search field, pill filter chips, pill buttons. No amount of gold on a
 * row of pills will read as sacred, because the SILHOUETTE is doing the
 * talking and the silhouette says "app".
 *
 * Sacred architecture has one governing form instead: the arch. So the
 * shapes that carry weight get an arched head and a square foot — round
 * (Romanesque) for buttons and small controls, a taller sprung arch for
 * panels. Applied as corner radii rather than a mask so it costs nothing and
 * degrades safely on native.
 *
 * `radius.pill` is deliberately left in place: things that genuinely are
 * incidental tags still want to be tags. The arch is for what you press and
 * what frames content.
 */
export const arch = {
  /** Round-headed arch on a squared foot. Buttons, chips, the search field. */
  round: {
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
  } as ViewStyle,
  /** Sprung arch for panels and cards — taller shoulder, squarer foot. */
  panel: {
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
  } as ViewStyle,
  /** A niche: the frame around a cover or an illuminated block. */
  niche: {
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  } as ViewStyle,
};

/**
 * Ornament glyphs. Unicode rather than drawn shapes because these are
 * genuinely typographic marks — a scribe's marks — and they inherit colour
 * and optical weight from the type around them.
 */
export const ornament = {
  /** Aldus leaf. Section breaks, the mark on an empty state. */
  fleuron: '❦',
  /** Rotated fleuron, for a paired terminal. */
  leaf: '❧',
  /** Four-pointed star. The quieter mark, for dense rows. */
  star: '✦',
  /** Lozenge, for the centre of a rule. */
  lozenge: '◆',
  /** Greek cross — high-church, used only at a true terminal. */
  cross: '✠',
};

/**
 * The phone column. THE fix for the worst desktop defect: with no cap, a
 * 1365px viewport stretched two sort buttons to ~640px each. Every reference
 * is a single narrow column that simply centres itself on a wide screen.
 */
const MAX_WIDTH = 480;
const GUTTER = 20;

export const layout = {
  /** Hard cap for app chrome. Nothing in the shell should exceed this. */
  maxWidth: MAX_WIDTH,
  /** The reader gets a wider measure — 480px of justified serif is cramped on
   *  a desktop; ~34em is the classic comfortable line length. */
  readerMaxWidth: 660,
  /** Horizontal page gutter, inside the capped column. */
  gutter: GUTTER,

  /** Centring helper. Drop on any block that must not go full-bleed. */
  centered: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' } as ViewStyle,

  /** Centred column WITH the page gutter — screen roots and
   *  ScrollView/FlatList `contentContainerStyle`. */
  screen: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
  } as ViewStyle,

  /** Same, for the reader's wider measure. */
  readerColumn: { width: '100%', maxWidth: 660, alignSelf: 'center' } as ViewStyle,

  /** Escape hatch for one-off widths: `layout.center(720)`. Horizontal
   *  carousels should stay full-bleed and instead pad their content, so they
   *  bleed off the edge the way the references do. */
  center(max: number = MAX_WIDTH): ViewStyle {
    return { width: '100%', maxWidth: max, alignSelf: 'center' };
  },
};

/**
 * Every token carries an explicit lineHeight. Only `body` did before, so the
 * rest fell back to the browser's `normal` (~1.15–1.2) — which is why a title
 * or caption that wrapped to two lines sat noticeably tighter than the same
 * text in the reader. Display faces are set near 1.25 (large type wants less
 * leading), UI text near 1.4.
 */
export const type = {
  /** Hero titles — the Continue Reading card, a book detail masthead. */
  hero: { fontFamily: fonts.display, fontSize: 32, lineHeight: 39, letterSpacing: 0.2 },
  /** Screen titles. */
  display: { fontFamily: fonts.display, fontSize: 26, lineHeight: 33, letterSpacing: 0.4 },
  /** Section headings. */
  heading: { fontFamily: fonts.display, fontSize: 19, lineHeight: 25, letterSpacing: 0.3 },
  /** Card titles. */
  title: { fontFamily: fonts.display, fontSize: 16, lineHeight: 21, letterSpacing: 0.2 },
  /** Body / descriptions. Stays in the UI sans: a paragraph of running
   *  description is the one place where legibility beats register. */
  body: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 21 },
  /**
   * Metadata, tags, captions — and every label in the chrome.
   *
   * These moved from the UI sans to the book serif, which is the single
   * cheapest change that stops the app reading as an app. "Recent / Title /
   * Author", the tab labels, "Add", "Import" and every card's metadata are
   * all this token, and in a system sans they were indistinguishable from
   * any settings screen ever shipped. Set in the same face as the text they
   * describe, with the letterspacing a scribe gives a small hand, they read
   * as part of the same document.
   */
  caption: { fontFamily: fonts.display, fontSize: 12, lineHeight: 17, letterSpacing: 0.5 },
  /** Smallest label, usually uppercased. Widely tracked, as small caps want. */
  overline: { fontFamily: fonts.display, fontSize: 10, lineHeight: 14, letterSpacing: 1.6 },
  /**
   * The illuminated initial. A manuscript opens its text with a letter two or
   * three lines deep, in the rubricator's red — the reader's eye is meant to
   * land there before it lands on a word. Used by the reader at a chapter
   * opening; see `versalLines` for the drop depth.
   */
  versal: { fontFamily: fonts.display, fontSize: 56, lineHeight: 52 },
};

/** How many body lines the versal drops beside. */
export const versalLines = 3;

/**
 * Minimum hit target. iOS HIG asks for 44pt, Material for 48dp, WCAG 2.5.5 for
 * 44px — the app's pills and icon buttons measured 34–38px, which is the one
 * thing that genuinely reads as cheap under a thumb. Apply as `minHeight` (and
 * `minWidth` on icon-only controls) rather than by inflating padding, so the
 * visual weight of a pill is unchanged and only its touchable box grows.
 */
export const HIT_SLOP_MIN = 44;

/**
 * Elevation. React Native Web maps these to box-shadow; the soft shadow is
 * what stops cards looking like flat rectangles.
 */
export const elevation = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  /** Covers are the hero object in every reference — they need a real drop
   *  shadow, cast downward, so the book sits ON the surface. */
  cover: {
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  /** The large Continue-Reading panel. Wider, softer and dropped further than
   *  a card so one element clearly owns the top of the screen. */
  hero: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
};

/** Standard trade paperback proportion — covers should never be square. */
export const COVER_RATIO = 1.5;

export type ReaderPalette = {
  bg: string;
  surface: string;
  raised: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  rule: string;
  border: string;
  /**
   * The rubricator's ink — the illuminated initial that opens a chapter, and
   * the chapter heading itself. Per-palette rather than one global red because
   * a vermilion that sings on cream is muddy on black and vice versa, and this
   * is the one colour on the reading surface that is allowed to be loud.
   */
  rubric: string;
};

/**
 * The four reader themes. The references all read on PAPER, not on black — so
 * `light` and `sepia` were re-cut as genuinely warm grounds (no blue-white, no
 * grey) carrying near-black serif text, which is what an actual printed page
 * looks like. `dark`/`night` remain as the option, not the default.
 *
 * Convention preserved from before: `surface` is chrome (header, control bar)
 * and is a step DEEPER than the page, `raised` is a button fill deeper still.
 * On paper that reads as the page recessing away from its furniture.
 *
 * Lives here rather than in ReaderScreen because Settings previews these
 * swatches — when they were declared locally in the reader, Settings drew from
 * the stale READER_THEMES palette and showed colours the reader never rendered.
 */
export const readerPalettes: Record<string, ReaderPalette> = {
  dark: {
    bg: colors.bg,
    surface: colors.surface,
    raised: colors.surfaceRaised,
    text: colors.ink,
    muted: colors.inkMuted,
    accent: colors.gold,
    accentSoft: colors.bronze,
    rule: colors.rule,
    border: colors.border,
    /** Lifted off the base vermilion so it carries on a near-black ground. */
    rubric: '#d4695e',
  },
  night: {
    bg: '#080510',
    surface: '#120d1d',
    raised: '#1a1329',
    text: '#c9c0b2',
    muted: '#867c6f',
    accent: '#ab9057',
    // accentSoft carries the reader's chapter label, which is real 10px text,
    // so it has to clear 4.5:1 and not just the 3:1 an icon would need. Was
    // #736149 at 3.40/3.21/3.02 against bg/surface/raised; now 5.56/5.24/4.94.
    accentSoft: '#97836b',
    rule: 'rgba(171, 144, 87, 0.14)',
    border: 'rgba(171, 144, 87, 0.22)',
    /** Night is the dimmest ground, so its red is damped to match. */
    rubric: '#b0574e',
  },
  /** Aged paper — tea-stained, the warmest ground. Text at 13:1. */
  sepia: {
    bg: '#f1e3c4',
    surface: '#e9d9b5',
    raised: '#dfcda3',
    text: '#231a10',
    muted: '#6d5c40',
    accent: '#7a4f18',
    /** See the note on night.accentSoft. Was #96794b at 3.22/2.93; now 5.45/4.97. */
    accentSoft: '#6d5634',
    rule: 'rgba(35, 26, 16, 0.13)',
    border: 'rgba(35, 26, 16, 0.22)',
    /** True cinnabar on aged paper — the manuscript case. */
    rubric: '#9e2b20',
  },
  /** Cream book paper — the default reading ground. Warm ivory, never #fff;
   *  near-black warm ink rather than the old grey-on-grey. */
  light: {
    bg: '#f8f2e4',
    surface: '#f1e9d6',
    raised: '#e7dcc3',
    text: '#17120c',
    muted: '#6a5c48',
    accent: '#7c5a1f',
    /** See the note on night.accentSoft. Was #9b8558 at 3.19/2.95 — the worst
     *  in the app, and on the default reading ground. Now 5.47/5.05. */
    accentSoft: '#71603b',
    rule: 'rgba(23, 18, 12, 0.11)',
    border: 'rgba(23, 18, 12, 0.19)',
    /** The default reading ground, so this is the rubric most readers see. */
    rubric: '#a32e21',
  },
};

export default {
  colors,
  fonts,
  space,
  radius,
  layout,
  type,
  elevation,
  readerPalettes,
  COVER_RATIO,
};
