// Shell — the max-width container. THE fix for the worst layout defect.
//
// Every screen previously laid itself out against `Dimensions.get('window')`,
// so on a 1365px desktop viewport the whole app went full-bleed: two sort
// buttons rendered ~640px wide each, cards became letterboxes, and a "grid" of
// covers turned into a single row of postage stamps floating in dead space.
// Every one of the owner's five reference apps is a single phone-width column
// that simply CENTRES itself on a wide screen. That is all this file does, but
// it has to be done in one place or it will drift back apart.
//
// Two components and two hooks:
//
//   <Shell>            screen root. flex:1, page background, optional ScrollView.
//   <Column>           a centred capped block that does NOT grow — headers,
//                      toolbars, footers, anything that sits outside the scroller.
//   useColumnWidth()   the effective CONTENT width in px.
//   useColumn()        the same plus { maxWidth, gutter, isWide }.
//
// The hooks are the important half. Grids must compute cover sizes from the
// COLUMN, not from the window:
//
//   const col = useColumnWidth();
//   const gap = space.md;
//   const coverW = Math.floor((col - gap * 2) / 3);     // 3-up grid
//
// Reading the window instead is how you get 4 covers on a phone and 4 covers
// stretched across 1365px on a desktop.
//
// Shell publishes its own metrics on context, so a `useColumnWidth()` call
// anywhere beneath it gets that Shell's real width even when the Shell was
// given a non-default cap (the reader, for instance, runs at
// layout.readerMaxWidth). Outside a Shell the hooks still work — they fall back
// to measuring the window against the theme defaults.

import React, { createContext, useContext, useMemo } from 'react';
import {
  View,
  Image,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  StyleProp,
  ViewStyle,
  ScrollViewProps,
} from 'react-native';
import { colors, layout, space } from '../theme';

// Read through the theme, but never explode if `layout` lands after this file
// does — these are the same numbers declared in src/theme/index.ts.
const MAX_WIDTH: number = layout?.maxWidth ?? 480;
const GUTTER: number = layout?.gutter ?? 20;

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export interface ColumnMetrics {
  /**
   * Usable content width in px, INSIDE the gutter. This is the number to size
   * grid cells, covers and carousel items against.
   */
  width: number;
  /** The cap in force for this column. */
  maxWidth: number;
  /** Horizontal gutter applied on each side. */
  gutter: number;
  /** Window is wider than the cap — i.e. the column is genuinely centred. */
  isWide: boolean;
}

function measure(windowWidth: number, maxWidth: number, gutter: number): ColumnMetrics {
  // `windowWidth` can be 0 for a frame during hydration; fall back to the cap
  // so a grid never divides by a zero-ish width and renders 0px covers.
  const w = windowWidth > 0 ? windowWidth : maxWidth;
  const outer = Math.min(w, maxWidth);
  return {
    width: Math.max(0, Math.round(outer - gutter * 2)),
    maxWidth,
    gutter,
    isWide: w > maxWidth,
  };
}

const ColumnContext = createContext<ColumnMetrics | null>(null);

/**
 * Full metrics for the nearest enclosing <Shell> / <Column>, or — outside one —
 * for a hypothetical default column measured against the current window.
 *
 * Passing either argument opts out of the inherited value and measures a
 * bespoke column instead (e.g. `useColumn(layout.readerMaxWidth)`).
 */
export function useColumn(maxWidthOverride?: number, gutterOverride?: number): ColumnMetrics {
  const { width: windowWidth } = useWindowDimensions();
  const inherited = useContext(ColumnContext);

  return useMemo(() => {
    const overridden = maxWidthOverride !== undefined || gutterOverride !== undefined;
    if (!overridden && inherited) return inherited;
    return measure(
      windowWidth,
      maxWidthOverride ?? inherited?.maxWidth ?? MAX_WIDTH,
      gutterOverride ?? inherited?.gutter ?? GUTTER
    );
  }, [windowWidth, inherited, maxWidthOverride, gutterOverride]);
}

/**
 * The effective content width in px. Size grids and carousel items from this,
 * never from `Dimensions.get('window')`.
 */
export function useColumnWidth(maxWidthOverride?: number, gutterOverride?: number): number {
  return useColumn(maxWidthOverride, gutterOverride).width;
}

// ---------------------------------------------------------------------------
// Column — centred, capped, does not grow
// ---------------------------------------------------------------------------

export interface ColumnProps {
  children?: React.ReactNode;
  /** Cap. Defaults to `layout.maxWidth`. */
  maxWidth?: number;
  /**
   * Horizontal page gutter. `true` (default) uses `layout.gutter`, `false` uses
   * none — pass `false` when the block must reach the column's own edges.
   */
  gutter?: boolean | number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A centred, width-capped block that takes its natural height. Use for headers,
 * search bars, sticky footers and anything living outside a <Shell>'s scroller.
 * Publishes its metrics so nested `useColumnWidth()` calls are correct.
 */
export function Column({ children, maxWidth, gutter = true, style, testID }: ColumnProps) {
  const cap = maxWidth ?? MAX_WIDTH;
  const pad = gutter === true ? GUTTER : gutter === false ? 0 : gutter;
  const metrics = useColumn(cap, pad);

  return (
    <ColumnContext.Provider value={metrics}>
      <View
        testID={testID}
        style={[styles.column, { maxWidth: cap, paddingHorizontal: pad }, style]}
      >
        {children}
      </View>
    </ColumnContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Shell — screen root
// ---------------------------------------------------------------------------

export interface ShellProps {
  children?: React.ReactNode;

  /** Render the column inside a vertical ScrollView. */
  scroll?: boolean;

  /** Cap for the centred column. Defaults to `layout.maxWidth` (480). */
  maxWidth?: number;

  /**
   * Horizontal page gutter. `true` (default) → `layout.gutter`; `false` → none;
   * a number → that many px. Note the gutter sits INSIDE the cap, so
   * `useColumnWidth()` already has it subtracted.
   */
  gutter?: boolean | number;

  /**
   * Page background. Defaults to the app background; pass `'transparent'` to
   * let a parent's colour or gradient show through.
   */
  background?: string;

  /**
   * Bottom padding on the scroll content so the last row clears the tab bar.
   * Scroll mode only. Defaults to `space.xxxl`; pass 0 to remove.
   */
  tailSpace?: number;

  /** Fill the parent. True by default — Shell is a screen root. */
  grow?: boolean;

  /** Style for the full-bleed outer surface (background, safe-area padding…). */
  style?: StyleProp<ViewStyle>;

  /** Style for the centred column itself. */
  contentContainerStyle?: StyleProp<ViewStyle>;

  // --- ScrollView pass-through (ignored unless `scroll`) -------------------
  scrollRef?: React.Ref<ScrollView>;
  onScroll?: ScrollViewProps['onScroll'];
  scrollEventThrottle?: number;
  refreshControl?: ScrollViewProps['refreshControl'];
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  keyboardDismissMode?: ScrollViewProps['keyboardDismissMode'];
  showsVerticalScrollIndicator?: boolean;
  scrollEnabled?: boolean;

  testID?: string;
}

/**
 * Screen root. Full-bleed background, phone-width centred content.
 *
 *   <Shell scroll>
 *     <Section title="Continue Reading"> … </Section>
 *   </Shell>
 *
 * Deliberately sets no `overflow` anywhere: clipping here is what silently
 * shears the drop shadows off covers and hero cards.
 */
export default function Shell({
  children,
  scroll = false,
  maxWidth,
  gutter = true,
  background = colors.bg,
  tailSpace = space.xxxl,
  grow = true,
  style,
  contentContainerStyle,
  scrollRef,
  onScroll,
  scrollEventThrottle = 16,
  refreshControl,
  keyboardShouldPersistTaps = 'handled',
  keyboardDismissMode,
  showsVerticalScrollIndicator = false,
  scrollEnabled,
  testID,
}: ShellProps) {
  const cap = maxWidth ?? MAX_WIDTH;
  const pad = gutter === true ? GUTTER : gutter === false ? 0 : gutter;
  const metrics = useColumn(cap, pad);

  const columnStyle: StyleProp<ViewStyle> = [
    styles.column,
    { maxWidth: cap, paddingHorizontal: pad },
    contentContainerStyle,
  ];

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.scroller}
      // The scroller stays full-bleed so its scrollbar and any background sit
      // at the window edge; the CONTENT is what gets centred and capped.
      contentContainerStyle={styles.scrollContent}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={keyboardDismissMode}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      scrollEnabled={scrollEnabled}
      testID={testID ? `${testID}-scroll` : undefined}
    >
      <View style={[columnStyle, styles.scrollColumn, !!tailSpace && { paddingBottom: tailSpace }]}>
        {children}
      </View>
    </ScrollView>
  ) : (
    <View style={columnStyle}>{children}</View>
  );

  return (
    <ColumnContext.Provider value={metrics}>
      <View
        testID={testID}
        style={[
          styles.surface,
          grow && styles.grow,
          !!background && { backgroundColor: background },
          style,
        ]}
      >
        {/* The ground. See SACRED_GROUND below. Behind everything, ignores
            touches, and only drawn when this Shell paints a background at all
            — the reader passes `transparent` because its own page IS the
            surface and a mosaic under running text would be unreadable. */}
        {!!background && background !== 'transparent' && <SacredGround />}
        {body}
      </View>
    </ColumnContext.Provider>
  );
}

/**
 * A Byzantine ground.
 *
 * The app was a flat near-black rectangle behind every screen, which is what
 * a utility looks like. A sacred interior is never flat — it is gold tesserae
 * catching light unevenly, and the eye reads that texture long before it reads
 * any single element on top of it.
 *
 * Held at a very low opacity on purpose: this has to sit under body text and
 * meet contrast, so it is a FELT texture rather than a picture you look at.
 * The vignette over it keeps the centre of the column quiet and lets the
 * corners fall away, the way a dome does.
 */
function SacredGround() {
  return (
    <View style={styles.ground} pointerEvents="none">
      <Image
        source={{ uri: SACRED_GROUND_URI }}
        style={styles.groundImage}
        resizeMode="cover"
        // Decorative: never announced, never focusable.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      {/* Descending wash. A dome is bright at the vault and falls to dark at
          the floor, so the mosaic is allowed to show at the top of the screen
          — where the masthead sits and no body copy runs — and is fully
          extinguished by the time it reaches the content. This also happens to
          put the contrast budget exactly where it is needed: text lives in the
          lower bands, and the lower bands are opaque.

          Six stacked flex:1 Views rather than a gradient because
          expo-linear-gradient is not installed (see icons.tsx on the same
          constraint); at six steps over a screen height the banding is not
          detectable against a photographic source. */}
      {GROUND_WASH_STOPS.map((alpha, i) => (
        <View key={i} style={[styles.groundBand, { backgroundColor: `rgba(15, 10, 26, ${alpha})` }]} />
      ))}
    </View>
  );
}

/**
 * Top-to-bottom opacity of the wash over the ground.
 *
 * Two calibrations, both from looking at it on the deployed build:
 *
 * TOO FAINT at 0.13 image under a flat 0.55 wash — about 6% effective, and
 * invisible. TOO LOUD at [0.18 … 1] over six bands — the mosaic dominated, the
 * masthead was illegible against it, and six steps over a screen height read
 * as visible banding rather than a falloff.
 *
 * So: it starts already mostly extinguished (0.62) and is fully opaque by the
 * top third, which leaves an impression of gold and arches rather than a
 * photograph of a building — atmosphere, not wallpaper. Fourteen bands put the
 * step size below what the eye resolves against a photographic source.
 */
const GROUND_WASH_STOPS = (() => {
  const BANDS = 14;
  const START = 0.62;
  /** Fraction of the screen over which the wash reaches full opacity. */
  const EXTINGUISH_BY = 0.34;
  return Array.from({ length: BANDS }, (_, i) => {
    const t = i / (BANDS - 1);
    if (t >= EXTINGUISH_BY) return 1;
    const eased = t / EXTINGUISH_BY;
    return +(START + (1 - START) * eased).toFixed(3);
  });
})();

/** Hagia Sophia's gold ground — the same interior the empty state already
 *  credits, so the app has one architectural setting rather than a collage. */
const SACRED_GROUND_URI =
  'https://upload.wikimedia.org/wikipedia/commons/b/b9/Interior_of_the_Hagia_Sophia_Grand_Mosque%2C_Istanbul_%2853808370434%29.jpg';

// Named export as well — screens import it either way.
export { Shell };

const styles = StyleSheet.create({
  /** Full-bleed page surface. Only the background lives out here. */
  surface: {
    width: '100%',
    alignItems: 'center',
  },
  grow: { flex: 1 },

  /* --- the sacred ground -------------------------------------------------- */
  ground: { ...StyleSheet.absoluteFillObject },
  /** The image runs at full strength; the descending wash is what governs how
   *  much of it survives, and it is opaque wherever text lands. */
  groundImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  /** One stop of the descending wash. Six of these fill the screen. */
  groundBand: { flex: 1 },

  /** The capped column. `width:'100%'` + `maxWidth` + centring is the whole trick. */
  column: {
    width: '100%',
    alignSelf: 'center',
  },

  scroller: {
    flex: 1,
    width: '100%',
  },
  /**
   * `alignItems:'center'` centres the column; `flexGrow:1` lets a short screen
   * (an empty state) still fill the viewport height.
   */
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'center',
  },
  scrollColumn: { flexGrow: 1 },
});
