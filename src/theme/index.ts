// Design system for Annotated.
//
// The palette was already established across the screens as hardcoded hex —
// deep aubergine with manuscript gold. This centralises it and adds the
// typography, spacing, and elevation scales the screens were missing, which
// is most of why the app read as "basic" despite decent colours.

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
  /** Muted bronze. Secondary text, borders, metadata. */
  bronze: '#8b7355',

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

/** 4pt base scale. Consistent rhythm is most of what reads as "designed". */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 14,
  pill: 999,
};

export const type = {
  /** Screen titles. */
  display: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 0.4 },
  /** Section headings. */
  heading: { fontFamily: fonts.display, fontSize: 19, letterSpacing: 0.3 },
  /** Card titles. */
  title: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 0.2 },
  /** Body / descriptions. */
  body: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 21 },
  /** Metadata, tags, captions. */
  caption: { fontFamily: fonts.ui, fontSize: 12, letterSpacing: 0.3 },
  /** Smallest label, usually uppercased. */
  overline: { fontFamily: fonts.ui, fontSize: 10, letterSpacing: 1.2 },
};

/**
 * Elevation. React Native Web maps these to box-shadow; the soft gold-tinted
 * shadow is what stops cards looking like flat rectangles.
 */
export const elevation = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cover: {
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
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
};

/**
 * The four reader themes, re-cut against the design system. The old palette
 * put #e0e0e0 on #1a1a1a (grey on grey) and #000 on #fff (glaring); these are
 * all warm-neutral pairings with the same contrast in every mode.
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
  },
  night: {
    bg: '#080510',
    surface: '#120d1d',
    raised: '#1a1329',
    text: '#c9c0b2',
    muted: '#867c6f',
    accent: '#ab9057',
    accentSoft: '#736149',
    rule: 'rgba(171, 144, 87, 0.14)',
    border: 'rgba(171, 144, 87, 0.22)',
  },
  sepia: {
    bg: '#f3ead6',
    surface: '#e9dec4',
    raised: '#ded1b3',
    text: '#463427',
    muted: '#7c6950',
    accent: '#8b6914',
    accentSoft: '#9a8256',
    rule: 'rgba(70, 52, 39, 0.16)',
    border: 'rgba(70, 52, 39, 0.26)',
  },
  light: {
    bg: '#fbf7f0',
    surface: '#f1eae0',
    raised: '#e6ddd0',
    text: '#292118',
    muted: '#6d6154',
    accent: '#8a6a30',
    accentSoft: '#9c8a6e',
    rule: 'rgba(41, 33, 24, 0.14)',
    border: 'rgba(41, 33, 24, 0.22)',
  },
};

export default { colors, fonts, space, radius, type, elevation, COVER_RATIO };
