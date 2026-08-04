// Drawn icon set for Annotated.
//
// Replaces the emoji the nav was using (📚📖✦🏛📑📓📕📊⚙️). Emoji were wrong for
// three reasons: they render as full-colour bitmaps that ignore the active tint,
// they sit on a different baseline in every browser/OS, and a bar of nine of
// them reads as a hobby project rather than a book app.
//
// `react-native-svg` is NOT installed (checked node_modules; it is also absent
// from package.json) and this workflow may not add dependencies, so the icons
// are drawn from Views instead. That sounds crude but isn't: a line segment is
// just a rounded 1.75px-tall View rotated about its centre, which is exactly
// what an SVG <line> with stroke-linecap="round" produces. Everything below is
// authored as coordinates on a 24-unit grid — the same mental model as an SVG
// viewBox — and scaled by `size / 24` at render time, so the shapes stay true
// at any size and every stroke inherits `color`.
//
// USAGE
//   import { Icon, icons, LibraryIcon } from '../components/icons';
//   <Icon name="library" size={22} color={focused ? colors.gold : colors.bronze} />
//   const Glyph = icons[name];            // lookup map, for tab bars
//   <LibraryIcon size={20} color={colors.ink} />

import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../theme';

export interface IconProps {
  /** Rendered box in px, square. Artwork is drawn on a 24 grid and scaled to fit. */
  size?: number;
  /** Stroke / fill colour. Every part of every icon inherits this — that is what
   *  makes active vs inactive tab tinting work at all. */
  color?: string;
  /** Stroke weight in grid units (i.e. px when size is 24). 1.5–2 reads best. */
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export type IconComponent = React.FC<IconProps>;

/** The coordinate space every icon is authored in. */
const GRID = 24;
const DEFAULT_SIZE = 24;
const DEFAULT_STROKE = 1.75;
const DEFAULT_COLOR = colors.ink;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

type Shape =
  /** Straight segment, round caps: [x1, y1, x2, y2]. */
  | { k: 'line'; p: [number, number, number, number] }
  /** Polyline through flat x,y pairs. `close` joins the last point to the first. */
  | { k: 'poly'; p: number[]; close?: boolean }
  /** Rectangle: [x, y, w, h]. Outlined unless `fill`. `r` = corner radius, `rot` = degrees. */
  | { k: 'box'; p: [number, number, number, number]; r?: number; fill?: boolean; rot?: number }
  /** Outlined circle: [cx, cy, r]. */
  | { k: 'ring'; p: [number, number, number] }
  /** Filled circle: [cx, cy, r]. */
  | { k: 'dot'; p: [number, number, number] }
  /** Filled right-pointing triangle: [xLeft, cy, w, h]. */
  | { k: 'tri'; p: [number, number, number, number] };

/**
 * One segment = a rounded bar positioned at the segment's midpoint and rotated
 * to its angle. Because the bar's height is the stroke weight and its corner
 * radius is half that, the ends are true round caps — so polyline corners join
 * cleanly without any mitre maths.
 */
function seg(
  key: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  u: number,
  t: number,
  color: string,
) {
  const dx = (x2 - x1) * u;
  const dy = (y2 - y1) * u;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: ((x1 + x2) / 2) * u - len / 2,
        top: ((y1 + y2) / 2) * u - t / 2,
        width: len,
        height: t,
        borderRadius: t / 2,
        backgroundColor: color,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

/**
 * A round line-join. A segment's stadium tip only reaches its endpoint along the
 * centreline, so two segments meeting at a vertex leave a notch on the outside
 * of the corner. Dropping a disc of the stroke's diameter on the vertex fills it
 * exactly, which is what SVG's stroke-linejoin="round" does.
 */
function joint(key: string, x: number, y: number, u: number, t: number, color: string) {
  return (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: x * u - t / 2,
        top: y * u - t / 2,
        width: t,
        height: t,
        borderRadius: t / 2,
        backgroundColor: color,
      }}
    />
  );
}

function renderShape(s: Shape, i: number, u: number, t: number, color: string): React.ReactNode {
  switch (s.k) {
    case 'line':
      return seg(`l${i}`, s.p[0], s.p[1], s.p[2], s.p[3], u, t, color);

    case 'poly': {
      const out: React.ReactNode[] = [];
      const n = s.p.length / 2;
      for (let j = 0; j < n - 1; j++) {
        out.push(
          seg(`p${i}-${j}`, s.p[j * 2], s.p[j * 2 + 1], s.p[j * 2 + 2], s.p[j * 2 + 3], u, t, color),
        );
      }
      if (s.close && n > 2) {
        out.push(
          seg(`p${i}-c`, s.p[(n - 1) * 2], s.p[(n - 1) * 2 + 1], s.p[0], s.p[1], u, t, color),
        );
      }
      // Round the corners. A closed shape joins at every vertex; an open one
      // joins everywhere except its two free ends, which stay capped.
      const firstJoin = s.close ? 0 : 1;
      const lastJoin = s.close ? n : n - 1;
      for (let j = firstJoin; j < lastJoin; j++) {
        out.push(joint(`p${i}-j${j}`, s.p[j * 2], s.p[j * 2 + 1], u, t, color));
      }
      return out;
    }

    case 'box': {
      const [x, y, w, h] = s.p;
      // An outline's stroke STRADDLES the path, exactly like an SVG <rect>. RN
      // borders are drawn inside the box, so the View is inflated by the stroke
      // weight and offset by half of it. Without this a `box` renders a full
      // stroke smaller than a `poly` drawn on the same coordinates — which is
      // why `dictionary` and `note` used to disagree despite sharing a bounds.
      const out = s.fill ? 0 : t / 2;
      return (
        <View
          key={`b${i}`}
          style={{
            position: 'absolute',
            left: x * u - out,
            top: y * u - out,
            width: w * u + out * 2,
            height: h * u + out * 2,
            borderRadius: (s.r ?? 0) * u + out,
            ...(s.fill
              ? { backgroundColor: color }
              : { borderWidth: t, borderColor: color, borderStyle: 'solid' as const }),
            ...(s.rot ? { transform: [{ rotate: `${s.rot}deg` }] } : null),
          }}
        />
      );
    }

    case 'ring': {
      const [cx, cy, r] = s.p;
      // Same straddling rule as `box`.
      const d = r * 2 * u + t;
      return (
        <View
          key={`r${i}`}
          style={{
            position: 'absolute',
            left: (cx - r) * u - t / 2,
            top: (cy - r) * u - t / 2,
            width: d,
            height: d,
            borderRadius: d / 2,
            borderWidth: t,
            borderColor: color,
            borderStyle: 'solid',
          }}
        />
      );
    }

    case 'dot': {
      const [cx, cy, r] = s.p;
      return (
        <View
          key={`d${i}`}
          style={{
            position: 'absolute',
            left: (cx - r) * u,
            top: (cy - r) * u,
            width: r * 2 * u,
            height: r * 2 * u,
            borderRadius: r * u,
            backgroundColor: color,
          }}
        />
      );
    }

    case 'tri': {
      // Filled triangle via the zero-size / asymmetric-border trick. Works on
      // both RN and RN Web, and is the one place a solid shape beats an outline:
      // a hollow play arrow reads as a "next" chevron at tab-bar sizes.
      const [x, cy, w, h] = s.p;
      return (
        <View
          key={`t${i}`}
          style={{
            position: 'absolute',
            left: x * u,
            top: cy * u - (h * u) / 2,
            width: 0,
            height: 0,
            backgroundColor: 'transparent',
            borderStyle: 'solid',
            borderTopWidth: (h * u) / 2,
            borderBottomWidth: (h * u) / 2,
            borderLeftWidth: w * u,
            borderRightWidth: 0,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderRightColor: 'transparent',
            borderLeftColor: color,
          }}
        />
      );
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Artwork
//
// All coordinates are on the 0–24 grid. Because every primitive now straddles
// its path, "the 24 grid" means one thing for all of them and the coordinates
// below can be read as an SVG viewBox.
//
// OPTICAL BOX: full-bleed icons run 3.6–20.4 on their dominant axis, so they
// paint 2.7–21.3 once the stroke is counted. Holding all of them to that band
// is what makes a row of them look like a set — before this was enforced,
// `stats` painted 12.6 tall next to an 18.0 `catalog` in the same tab bar.
// Icons that are inherently short (menu, sort, check, more) or that read
// optically large because they are solid or diagonal (play, close, chevrons)
// are deliberately drawn under the band rather than stretched to fill it.
// ---------------------------------------------------------------------------

const PATHS = {
  /** Library — two upright books plus one leaning, sharing a baseline. The
   *  lean is what separates this from `collections` at 22px. */
  library: [
    { k: 'box', p: [3.4, 3.9, 4.3, 16.5], r: 1.2 },
    { k: 'box', p: [8.7, 3.9, 4.3, 16.5], r: 1.2 },
    { k: 'box', p: [15.2, 6.6, 3.8, 13.2], r: 1.1, rot: 12 },
  ],

  /** Reading — an open book: two pages hinged on a centre spine. */
  read: [
    { k: 'poly', p: [12, 6.6, 3.6, 4.2, 3.6, 17.8, 12, 20.4] },
    { k: 'poly', p: [12, 6.6, 20.4, 4.2, 20.4, 17.8, 12, 20.4] },
    { k: 'line', p: [12, 6.6, 12, 20.4] },
  ],

  /** Curriculum — a classical fluted column: capital, three flutes, base.
   *  The base is drawn wider than the capital, as a real order is. Capital and
   *  base are FILLED: outlined, a slab only ~2.6 units deep is thinner inside
   *  than the stroke around it, so it rendered as a hollow double-line rather
   *  than as entablature. */
  curriculum: [
    { k: 'box', p: [4.2, 3.9, 15.6, 2.6], r: 0.9, fill: true },
    { k: 'line', p: [8.7, 8.0, 8.7, 16.4] },
    { k: 'line', p: [12.0, 8.0, 12.0, 16.4] },
    { k: 'line', p: [15.3, 8.0, 15.3, 16.4] },
    { k: 'box', p: [3.4, 17.9, 17.2, 2.6], r: 0.9, fill: true },
  ],

  /** Catalog — a compass rose: browse/discover. */
  catalog: [
    { k: 'ring', p: [12, 12, 8.4] },
    { k: 'poly', p: [15.92, 8.08, 13.96, 13.96, 8.08, 15.92, 10.04, 10.04], close: true },
  ],

  /** More — horizontal ellipsis, for an overflow tab or row menu. */
  more: [
    { k: 'dot', p: [5.3, 12, 1.75] },
    { k: 'dot', p: [12, 12, 1.75] },
    { k: 'dot', p: [18.7, 12, 1.75] },
  ],

  /** Shelf — books of differing widths standing ON a plank with turned-down
   *  ends. The plank matters twice: without it this is `stats`, and the books
   *  must actually meet it or they read as floating. */
  shelf: [
    { k: 'box', p: [4.6, 6.4, 3.4, 11.2], r: 0.8 },
    { k: 'box', p: [9.2, 4.0, 3.8, 13.6], r: 0.8 },
    { k: 'box', p: [15.0, 5.9, 3.5, 11.6], r: 0.8, rot: 13 },
    { k: 'poly', p: [3.4, 20.4, 3.4, 17.6, 20.6, 17.6, 20.6, 20.4] },
  ],

  /** Collections — a grid of tiles. The gutter has to exceed the stroke or the
   *  four tiles fuse into one lattice at tab-bar size. */
  collections: [
    { k: 'box', p: [3.5, 3.5, 6.9, 6.9], r: 1.9 },
    { k: 'box', p: [13.6, 3.5, 6.9, 6.9], r: 1.9 },
    { k: 'box', p: [3.5, 13.6, 6.9, 6.9], r: 1.9 },
    { k: 'box', p: [13.6, 13.6, 6.9, 6.9], r: 1.9 },
  ],

  /** Dictionary — a bound reference volume: spine band plus entry lines. The
   *  spine runs the full height so it meets both covers. */
  dictionary: [
    { k: 'box', p: [4.2, 3.7, 15.6, 16.6], r: 2.2 },
    { k: 'line', p: [7.9, 3.7, 7.9, 20.3] },
    { k: 'line', p: [11.0, 8.6, 17.4, 8.6] },
    { k: 'line', p: [11.0, 12.0, 17.4, 12.0] },
    { k: 'line', p: [11.0, 15.4, 15.0, 15.4] },
  ],

  /** Highlights — a marker held on the diagonal, with the swipe it just laid
   *  down. Drawn as text-lines-with-a-bold-line this collided with `menu`. */
  highlights: [
    { k: 'poly', p: [14.3, 3.9, 18.1, 7.7, 8.6, 17.2, 4.2, 18.0, 5.0, 13.6], close: true },
    { k: 'line', p: [7.33, 11.18, 10.98, 14.83] },
    { k: 'box', p: [10.6, 18.2, 10.0, 2.6], r: 1.3, fill: true },
  ],

  /** Note — a page with a folded corner, for annotations. */
  note: [
    { k: 'poly', p: [5.0, 3.7, 13.8, 3.7, 19.0, 8.9, 19.0, 20.3, 5.0, 20.3], close: true },
    { k: 'poly', p: [13.8, 3.7, 13.8, 8.9, 19.0, 8.9] },
  ],

  /** Stats — three bars on a shared baseline. A segment is not extended past
   *  its endpoints, so these must be authored a stroke taller than a boxed
   *  icon to occupy the same optical band. */
  stats: [
    { k: 'line', p: [4.8, 20.4, 4.8, 12.4] },
    { k: 'line', p: [12.0, 20.4, 12.0, 4.0] },
    { k: 'line', p: [19.2, 20.4, 19.2, 8.8] },
  ],

  /** Settings — sliders. Reads better than a gear at 22px and draws crisply. */
  settings: [
    { k: 'line', p: [3.6, 6.2, 20.4, 6.2] },
    { k: 'line', p: [16.0, 3.6, 16.0, 8.8] },
    { k: 'line', p: [3.6, 12.0, 20.4, 12.0] },
    { k: 'line', p: [8.4, 9.4, 8.4, 14.6] },
    { k: 'line', p: [3.6, 17.8, 20.4, 17.8] },
    { k: 'line', p: [14.2, 15.2, 14.2, 20.4] },
  ],

  search: [
    { k: 'ring', p: [10.6, 10.6, 7.0] },
    { k: 'line', p: [15.9, 15.9, 20.4, 20.4] },
  ],

  plus: [
    { k: 'line', p: [12, 4.0, 12, 20.0] },
    { k: 'line', p: [4.0, 12, 20.0, 12] },
  ],

  minus: [{ k: 'line', p: [4.0, 12, 20.0, 12] }],

  // Chevrons sit just under the optical band — a bare diagonal pair reads
  // larger than it measures, and these are usually beside text.
  chevronLeft: [{ k: 'poly', p: [14.8, 4.8, 8.2, 12.0, 14.8, 19.2] }],
  chevronRight: [{ k: 'poly', p: [9.2, 4.8, 15.8, 12.0, 9.2, 19.2] }],
  chevronUp: [{ k: 'poly', p: [4.8, 14.8, 12.0, 8.2, 19.2, 14.8] }],
  chevronDown: [{ k: 'poly', p: [4.8, 9.2, 12.0, 15.8, 19.2, 9.2] }],

  arrowLeft: [
    { k: 'line', p: [3.6, 12, 20.4, 12] },
    { k: 'poly', p: [10.0, 5.6, 3.6, 12.0, 10.0, 18.4] },
  ],
  arrowRight: [
    { k: 'line', p: [3.6, 12, 20.4, 12] },
    { k: 'poly', p: [14.0, 5.6, 20.4, 12.0, 14.0, 18.4] },
  ],

  /** Solid, so its bounding box is centred rather than its centroid — the same
   *  convention every media player uses. */
  play: [{ k: 'tri', p: [5.8, 12, 12.4, 15.6] }],

  pause: [
    { k: 'box', p: [7.6, 4.4, 3.4, 15.2], r: 1.5, fill: true },
    { k: 'box', p: [13.0, 4.4, 3.4, 15.2], r: 1.5, fill: true },
  ],

  bookmark: [
    { k: 'poly', p: [6.0, 3.6, 18.0, 3.6, 18.0, 20.4, 12.0, 15.2, 6.0, 20.4], close: true },
  ],

  check: [{ k: 'poly', p: [4.4, 12.4, 9.7, 18.3, 19.6, 5.9] }],

  close: [
    { k: 'line', p: [5.0, 5.0, 19.0, 19.0] },
    { k: 'line', p: [19.0, 5.0, 5.0, 19.0] },
  ],

  menu: [
    { k: 'line', p: [3.6, 6.4, 20.4, 6.4] },
    { k: 'line', p: [3.6, 12.0, 20.4, 12.0] },
    { k: 'line', p: [3.6, 17.6, 20.4, 17.6] },
  ],

  home: [
    { k: 'poly', p: [3.6, 10.6, 12, 3.8, 20.4, 10.6] },
    { k: 'poly', p: [5.4, 9.4, 5.4, 20.4, 18.6, 20.4, 18.6, 9.4] },
  ],

  trash: [
    { k: 'poly', p: [9.0, 6.4, 9.0, 4.0, 15.0, 4.0, 15.0, 6.4] },
    { k: 'line', p: [3.6, 6.4, 20.4, 6.4] },
    { k: 'poly', p: [5.8, 6.4, 6.8, 20.4, 17.2, 20.4, 18.2, 6.4] },
  ],

  download: [
    { k: 'line', p: [12, 3.6, 12, 14.8] },
    { k: 'poly', p: [7.0, 9.8, 12, 14.8, 17.0, 9.8] },
    { k: 'poly', p: [3.6, 17.0, 3.6, 20.4, 20.4, 20.4, 20.4, 17.0] },
  ],

  sort: [
    { k: 'line', p: [3.6, 6.4, 20.4, 6.4] },
    { k: 'line', p: [3.6, 12.0, 14.8, 12.0] },
    { k: 'line', p: [3.6, 17.6, 10.0, 17.6] },
  ],

  filter: [
    {
      k: 'poly',
      p: [20.4, 4.4, 3.6, 4.4, 10.3, 12.4, 10.3, 18.2, 13.7, 19.9, 13.7, 12.4],
      close: true,
    },
  ],
} satisfies Record<string, Shape[]>;

/** Every icon name this module can render. */
export type IconName = keyof typeof PATHS;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function makeIcon(name: IconName): IconComponent {
  const shapes = PATHS[name] as readonly Shape[];

  const Component: IconComponent = ({
    size = DEFAULT_SIZE,
    color = DEFAULT_COLOR,
    strokeWidth = DEFAULT_STROKE,
    style,
  }) => {
    const u = size / GRID;
    // Never let a stroke fall below a physical pixel or it turns to grey mush
    // at small sizes; otherwise the weight scales with the icon like an SVG.
    const t = Math.max(strokeWidth * u, 1);

    return (
      // pointerEvents="none" so an icon inside a Pressable can never eat the tap.
      <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
        {shapes.map((s, i) => renderShape(s, i, u, t, color))}
      </View>
    );
  };

  Component.displayName = `Icon(${name})`;
  return Component;
}

export const LibraryIcon = makeIcon('library');
export const ReadIcon = makeIcon('read');
export const CurriculumIcon = makeIcon('curriculum');
export const CatalogIcon = makeIcon('catalog');
export const MoreIcon = makeIcon('more');
export const ShelfIcon = makeIcon('shelf');
export const CollectionsIcon = makeIcon('collections');
export const DictionaryIcon = makeIcon('dictionary');
export const HighlightsIcon = makeIcon('highlights');
export const NoteIcon = makeIcon('note');
export const StatsIcon = makeIcon('stats');
export const SettingsIcon = makeIcon('settings');
export const SearchIcon = makeIcon('search');
export const PlusIcon = makeIcon('plus');
export const MinusIcon = makeIcon('minus');
export const ChevronLeftIcon = makeIcon('chevronLeft');
export const ChevronRightIcon = makeIcon('chevronRight');
export const ChevronUpIcon = makeIcon('chevronUp');
export const ChevronDownIcon = makeIcon('chevronDown');
export const ArrowLeftIcon = makeIcon('arrowLeft');
export const ArrowRightIcon = makeIcon('arrowRight');
export const PlayIcon = makeIcon('play');
export const PauseIcon = makeIcon('pause');
export const BookmarkIcon = makeIcon('bookmark');
export const CheckIcon = makeIcon('check');
export const CloseIcon = makeIcon('close');
export const MenuIcon = makeIcon('menu');
export const HomeIcon = makeIcon('home');
export const TrashIcon = makeIcon('trash');
export const DownloadIcon = makeIcon('download');
export const SortIcon = makeIcon('sort');
export const FilterIcon = makeIcon('filter');

/** Lookup map — `icons[name]` for tab bars and anything data-driven. */
export const icons: Record<IconName, IconComponent> = {
  library: LibraryIcon,
  read: ReadIcon,
  curriculum: CurriculumIcon,
  catalog: CatalogIcon,
  more: MoreIcon,
  shelf: ShelfIcon,
  collections: CollectionsIcon,
  dictionary: DictionaryIcon,
  highlights: HighlightsIcon,
  note: NoteIcon,
  stats: StatsIcon,
  settings: SettingsIcon,
  search: SearchIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  chevronLeft: ChevronLeftIcon,
  chevronRight: ChevronRightIcon,
  chevronUp: ChevronUpIcon,
  chevronDown: ChevronDownIcon,
  arrowLeft: ArrowLeftIcon,
  arrowRight: ArrowRightIcon,
  play: PlayIcon,
  pause: PauseIcon,
  bookmark: BookmarkIcon,
  check: CheckIcon,
  close: CloseIcon,
  menu: MenuIcon,
  home: HomeIcon,
  trash: TrashIcon,
  download: DownloadIcon,
  sort: SortIcon,
  filter: FilterIcon,
};

export interface NamedIconProps extends IconProps {
  name: IconName;
}

/**
 * Render by name. Convenient inside navigator options:
 *   tabBarIcon: ({ color, focused }) => (
 *     <Icon name="library" color={color} size={22} strokeWidth={focused ? 2 : 1.6} />
 *   )
 */
export const Icon: React.FC<NamedIconProps> = ({ name, ...rest }) => {
  const Glyph = icons[name];
  return Glyph ? <Glyph {...rest} /> : null;
};

export default icons;
