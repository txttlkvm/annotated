// Carousel — the horizontally scrolling cover row that appears in every one of
// the owner's reference apps ("Trending", "Featured", "Continue the series").
//
//   <Carousel
//     data={books}
//     itemWidth={coverW}
//     renderItem={(b) => <BookCard book={b} width={coverW} />}
//   />
//
// THE BUG THIS FILE EXISTS TO AVOID
// ---------------------------------
// A horizontal ScrollView on react-native-web compiles to `overflow-x: auto;
// overflow-y: hidden`. That `overflow-y: hidden` silently shears the drop
// shadow off the top and bottom of every cover in the row — the covers stop
// sitting ON the page and go flat, which is the exact opposite of "covers are
// the HERO". It is invisible in code review and obvious on screen.
//
// You cannot fix it with `overflow: visible` — that switches scrolling off
// entirely on web. The fix is to give the shadow room INSIDE the scroll box:
// pad the content container vertically by more than the shadow's reach, then
// cancel that padding with a matching negative margin on the wrapper so the
// row still occupies exactly the space it looks like it occupies. Same trick
// horizontally, where `contentInset` keeps the first and last covers' shadows
// off the clip edge and aligns them to the page gutter.
//
// Also handled: hidden scrollbars on web (RNW's own flag plus a webkit rule,
// because the RNW flag alone leaves a scrollbar in some Chrome builds), and
// scroll snapping that lands each item on the gutter rather than at an
// arbitrary offset.

import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { layout, space, colors, type as typeScale } from '../theme';

const GUTTER: number = layout?.gutter ?? 20;

/**
 * Vertical room reserved inside the scroll box for cover shadows.
 * `elevation.cover` is radius 14 offset +6, so it reaches ~8px above and ~20px
 * below the box. 24 clears both with margin to spare.
 */
const DEFAULT_SHADOW_PAD = 24;

// ---------------------------------------------------------------------------
// Web: kill the scrollbar for real.
// RNW maps showsHorizontalScrollIndicator={false} to `scrollbar-width: none`,
// which Firefox honours; WebKit/Blink need a pseudo-element rule, and RNW has
// no API for pseudo-elements. One injected rule, keyed off a data attribute we
// set via RNW's `dataSet` prop, covers it. No-ops on native and under SSR.
// ---------------------------------------------------------------------------
const SCROLLBAR_FLAG = 'annotatedCarousel'; // -> data-annotated-carousel

function injectScrollbarRule() {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined' || !document.head) return;
  const id = 'annotated-carousel-scrollbar';
  if (document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent =
    '[data-annotated-carousel]::-webkit-scrollbar{display:none;width:0;height:0}' +
    '[data-annotated-carousel]{-ms-overflow-style:none;scrollbar-width:none}';
  document.head.appendChild(el);
}
injectScrollbarRule();

// ---------------------------------------------------------------------------

export interface CarouselProps<T> {
  /** Items to lay out in the row. */
  data: readonly T[];

  /** Renders one item. Must render at `itemWidth` — the wrapper only reserves it. */
  renderItem: (item: T, index: number) => React.ReactNode;

  /** Width of a single item in px. Drives snapping and the item wrapper. */
  itemWidth: number;

  /** Space between items. Defaults to `space.lg` (16). */
  gap?: number;

  /**
   * Horizontal padding inside the scroller, so the first item starts on the
   * page gutter and the last one can scroll clear of the edge. Defaults to
   * `layout.gutter`.
   */
  contentInset?: number;

  /**
   * Pull the scroller out sideways by `contentInset` so a Carousel dropped
   * inside an already-guttered column still bleeds off both edges of the
   * column — the way every reference does it. Set this when the Carousel sits
   * inside a `<Shell>`/`<Section>` that already applies the page gutter.
   */
  bleed?: boolean;

  /**
   * Vertical room for drop shadows. Defaults to 24 and is cancelled by an
   * equal negative margin, so it costs no layout space. Set 0 only if the
   * items genuinely have no shadow.
   */
  shadowPad?: number;

  /** Snap each item to the gutter as you flick. Default true. */
  snap?: boolean;

  /** Stable key per item. Defaults to the index. */
  keyExtractor?: (item: T, index: number) => string;

  /** Rendered in place of the row when `data` is empty. */
  empty?: React.ReactNode;

  /** Optional short line shown when `data` is empty and no `empty` node given. */
  emptyText?: string;

  /** Style for the outer wrapper. */
  style?: StyleProp<ViewStyle>;

  /** Extra style for the scrolling content container. */
  contentContainerStyle?: StyleProp<ViewStyle>;

  /** Align items along the cross axis. 'flex-start' (default) keeps ragged
   *  captions from stretching; 'stretch' equalises card heights. */
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';

  testID?: string;
}

export default function Carousel<T>({
  data,
  renderItem,
  itemWidth,
  gap = space.lg,
  contentInset = GUTTER,
  bleed = false,
  shadowPad = DEFAULT_SHADOW_PAD,
  snap = true,
  keyExtractor,
  empty,
  emptyText,
  style,
  contentContainerStyle,
  align = 'flex-start',
  testID,
}: CarouselProps<T>) {
  // The shadow reaches further below than above (offset is +6), so weight the
  // padding that way instead of wasting symmetric space.
  const padTop = Math.round(shadowPad * 0.42);
  const padBottom = shadowPad;

  // Item i's left edge sits at `contentInset + i * stride`, so scrolling to
  // `i * stride` parks that item exactly on the gutter.
  const stride = itemWidth + gap;
  const snapOffsets = useMemo(
    () => (snap ? data.map((_, i) => i * stride) : undefined),
    [snap, data.length, stride]
  );

  if (!data || data.length === 0) {
    if (empty) return <View style={style}>{empty}</View>;
    if (emptyText) {
      return (
        <View style={[styles.empty, style]}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      );
    }
    return null;
  }

  return (
    <View
      testID={testID}
      style={[
        // Cancel the shadow padding so the row occupies its visual height only.
        { marginTop: -padTop, marginBottom: -padBottom },
        // Escape the parent's gutter so the row can run off both edges.
        bleed && { marginHorizontal: -contentInset },
        style,
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        decelerationRate={snap ? 'fast' : 'normal'}
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        disableIntervalMomentum={snap}
        // NOTE: no `overflow` override here. `overflow:'visible'` would stop
        // the row scrolling on web; the padding below is what protects shadows.
        style={[styles.scroller, WEB_SCROLLER]}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: contentInset,
            paddingTop: padTop,
            paddingBottom: padBottom,
            alignItems: align,
          },
          contentContainerStyle,
        ]}
        {...WEB_DATASET}
      >
        {data.map((item, i) => (
          <View
            key={keyExtractor ? keyExtractor(item, i) : String(i)}
            style={[
              { width: itemWidth },
              i > 0 && { marginLeft: gap },
              snap && WEB_SNAP_ITEM,
            ]}
          >
            {renderItem(item, i)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export { Carousel };

/**
 * Web-only style passthroughs. RNW forwards unrecognised style keys straight to
 * CSS, which is how we get scroll-snap; on native these keys are meaningless,
 * so they are gated rather than shipped and ignored.
 */
const WEB_SCROLLER: any =
  Platform.OS === 'web'
    ? { scrollSnapType: 'x proximity', scrollbarWidth: 'none' }
    : null;

const WEB_SNAP_ITEM: any = Platform.OS === 'web' ? { scrollSnapAlign: 'start' } : null;

/** RNW turns `dataSet` into data-* attributes; not in the RN typings. */
const WEB_DATASET: any =
  Platform.OS === 'web' ? { dataSet: { [SCROLLBAR_FLAG]: 'true' } } : {};

const styles = StyleSheet.create({
  scroller: {
    // Full-bleed by design: a carousel that stops at the gutter looks like a
    // clipped list. `contentInset` does the aligning instead.
    width: '100%',
    // RNW gives every ScrollView `flexGrow:1, flexShrink:1`. In a column parent
    // that is VERTICAL growth, so a Carousel dropped straight into a growing
    // column (Shell's scroll column, a flex:1 screen body) would stretch to
    // absorb the slack and float its covers in the middle of the gap. Pin the
    // row to its content height. This style is applied after RNW's base style,
    // so it wins.
    flexGrow: 0,
    flexShrink: 0,
  },
  content: {
    flexDirection: 'row',
  },
  empty: {
    paddingVertical: space.lg,
  },
  emptyText: {
    ...typeScale.caption,
    color: colors.inkMuted,
  },
});
