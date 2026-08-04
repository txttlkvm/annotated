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
      return out;
    }

    case 'box': {
      const [x, y, w, h] = s.p;
      return (
        <View
          key={`b${i}`}
          style={{
            position: 'absolute',
            left: x * u,
            top: y * u,
            width: w * u,
            height: h * u,
            borderRadius: (s.r ?? 0) * u,
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
      return (
        <View
          key={`r${i}`}
          style={{
            position: 'absolute',
            left: (cx - r) * u,
            top: (cy - r) * u,
            width: r * 2 * u,
            height: r * 2 * u,
            borderRadius: r * u,
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
// All coordinates are on the 0–24 grid, kept inside ~2.5–21.5 so every icon
// carries the same optical padding and they line up in a row.
// ---------------------------------------------------------------------------

const PATHS = {
  /** Library — three books, the last one leaning. */
  library: [
    { k: 'box', p: [3.2, 5.0, 4.6, 14.8], r: 1.2 },
    { k: 'box', p: [9.2, 5.0, 4.6, 14.8], r: 1.2 },
    { k: 'box', p: [15.6, 5.1, 4.4, 14.0], r: 1.2, rot: 15 },
  ],

  /** Reading — an open book: two pages hinged on a centre spine. */
  read: [
    { k: 'poly', p: [12, 7.6, 3.2, 5.4, 3.2, 17.4, 12, 19.6] },
    { k: 'poly', p: [12, 7.6, 20.8, 5.4, 20.8, 17.4, 12, 19.6] },
    { k: 'line', p: [12, 7.6, 12, 19.6] },
  ],

  /** Curriculum — a classical fluted column: capital, three flutes, base. */
  curriculum: [
    { k: 'box', p: [4.0, 4.0, 16.0, 3.0], r: 1.0 },
    { k: 'line', p: [8.6, 8.2, 8.6, 16.2] },
    { k: 'line', p: [12.0, 8.2, 12.0, 16.2] },
    { k: 'line', p: [15.4, 8.2, 15.4, 16.2] },
    { k: 'box', p: [3.2, 17.2, 17.6, 3.0], r: 1.0 },
  ],

  /** Catalog — a compass rose: browse/discover. */
  catalog: [
    { k: 'ring', p: [12, 12, 9] },
    { k: 'poly', p: [16.2, 7.8, 14.1, 14.1, 7.8, 16.2, 9.9, 9.9], close: true },
  ],

  /** More — horizontal ellipsis, for an overflow tab or row menu. */
  more: [
    { k: 'dot', p: [5.4, 12, 1.7] },
    { k: 'dot', p: [12, 12, 1.7] },
    { k: 'dot', p: [18.6, 12, 1.7] },
  ],

  /** Shelf — books of differing widths on a board with turned-down ends.
   *  The bracket matters: with a plain baseline this was indistinguishable
   *  from `stats`, and the two can appear in the same nav. */
  shelf: [
    { k: 'box', p: [4.6, 8.2, 3.0, 9.6], r: 0.8 },
    { k: 'box', p: [9.0, 5.6, 4.2, 12.2], r: 0.8 },
    { k: 'box', p: [15.0, 6.6, 3.6, 11.4], r: 0.8, rot: 13 },
    { k: 'poly', p: [3.2, 17.0, 3.2, 19.4, 20.8, 19.4, 20.8, 17.0] },
  ],

  /** Collections — a grid of tiles. */
  collections: [
    { k: 'box', p: [3.5, 3.5, 7.2, 7.2], r: 2.0 },
    { k: 'box', p: [13.3, 3.5, 7.2, 7.2], r: 2.0 },
    { k: 'box', p: [3.5, 13.3, 7.2, 7.2], r: 2.0 },
    { k: 'box', p: [13.3, 13.3, 7.2, 7.2], r: 2.0 },
  ],

  /** Dictionary — a bound reference volume: spine band plus entry lines. */
  dictionary: [
    { k: 'box', p: [4.0, 3.4, 16.0, 17.2], r: 2.2 },
    { k: 'line', p: [7.8, 4.3, 7.8, 19.7] },
    { k: 'line', p: [11.0, 8.4, 17.0, 8.4] },
    { k: 'line', p: [11.0, 12.0, 17.0, 12.0] },
    { k: 'line', p: [11.0, 15.6, 14.6, 15.6] },
  ],

  /** Highlights — a marker held on the diagonal, with the swipe it just laid
   *  down. Drawn as text-lines-with-a-bold-line this collided with `menu`. */
  highlights: [
    { k: 'poly', p: [13.98, 4.96, 17.24, 8.22, 8.89, 16.57, 5.0, 17.2, 5.63, 13.31], close: true },
    { k: 'line', p: [11.15, 7.79, 14.41, 11.05] },
    { k: 'box', p: [11.0, 17.2, 9.6, 2.6], r: 1.3, fill: true },
  ],

  /** Note — a page with a folded corner, for annotations. */
  note: [
    { k: 'poly', p: [5.6, 3.4, 14.0, 3.4, 18.4, 7.8, 18.4, 20.6, 5.6, 20.6], close: true },
    { k: 'poly', p: [14.0, 3.4, 14.0, 7.8, 18.4, 7.8] },
  ],

  /** Stats — three bars. */
  stats: [
    { k: 'line', p: [5.8, 20.0, 5.8, 13.4] },
    { k: 'line', p: [12.0, 20.0, 12.0, 7.4] },
    { k: 'line', p: [18.2, 20.0, 18.2, 10.4] },
  ],

  /** Settings — sliders. Reads better than a gear at 22px and draws crisply. */
  settings: [
    { k: 'line', p: [3.4, 6.6, 20.6, 6.6] },
    { k: 'line', p: [16.0, 4.2, 16.0, 9.0] },
    { k: 'line', p: [3.4, 12.0, 20.6, 12.0] },
    { k: 'line', p: [8.6, 9.6, 8.6, 14.4] },
    { k: 'line', p: [3.4, 17.4, 20.6, 17.4] },
    { k: 'line', p: [14.4, 15.0, 14.4, 19.8] },
  ],

  search: [
    { k: 'ring', p: [10.6, 10.6, 7.0] },
    { k: 'line', p: [15.9, 15.9, 20.4, 20.4] },
  ],

  plus: [
    { k: 'line', p: [12, 4.6, 12, 19.4] },
    { k: 'line', p: [4.6, 12, 19.4, 12] },
  ],

  minus: [{ k: 'line', p: [4.6, 12, 19.4, 12] }],

  chevronLeft: [{ k: 'poly', p: [15.0, 4.6, 8.0, 12.0, 15.0, 19.4] }],
  chevronRight: [{ k: 'poly', p: [9.0, 4.6, 16.0, 12.0, 9.0, 19.4] }],
  chevronUp: [{ k: 'poly', p: [4.6, 15.0, 12.0, 8.0, 19.4, 15.0] }],
  chevronDown: [{ k: 'poly', p: [4.6, 9.0, 12.0, 16.0, 19.4, 9.0] }],

  arrowLeft: [
    { k: 'line', p: [3.6, 12, 20.4, 12] },
    { k: 'poly', p: [10.4, 5.2, 3.6, 12.0, 10.4, 18.8] },
  ],
  arrowRight: [
    { k: 'line', p: [3.6, 12, 20.4, 12] },
    { k: 'poly', p: [13.6, 5.2, 20.4, 12.0, 13.6, 18.8] },
  ],

  play: [{ k: 'tri', p: [7.6, 12, 12.0, 14.4] }],

  pause: [
    { k: 'box', p: [7.8, 5.0, 3.4, 14.0], r: 1.5, fill: true },
    { k: 'box', p: [12.8, 5.0, 3.4, 14.0], r: 1.5, fill: true },
  ],

  bookmark: [
    { k: 'poly', p: [6.0, 3.6, 18.0, 3.6, 18.0, 20.4, 12.0, 15.2, 6.0, 20.4], close: true },
  ],

  check: [{ k: 'poly', p: [4.6, 12.6, 9.8, 18.2, 19.4, 6.4] }],

  close: [
    { k: 'line', p: [5.6, 5.6, 18.4, 18.4] },
    { k: 'line', p: [18.4, 5.6, 5.6, 18.4] },
  ],

  menu: [
    { k: 'line', p: [3.6, 6.4, 20.4, 6.4] },
    { k: 'line', p: [3.6, 12.0, 20.4, 12.0] },
    { k: 'line', p: [3.6, 17.6, 20.4, 17.6] },
  ],

  home: [
    { k: 'poly', p: [2.8, 10.8, 12, 3.4, 21.2, 10.8] },
    { k: 'poly', p: [5.2, 9.2, 5.2, 20.4, 18.8, 20.4, 18.8, 9.2] },
  ],

  trash: [
    { k: 'poly', p: [9.0, 6.4, 9.0, 4.0, 15.0, 4.0, 15.0, 6.4] },
    { k: 'line', p: [3.6, 6.4, 20.4, 6.4] },
    { k: 'poly', p: [5.8, 6.4, 6.8, 20.4, 17.2, 20.4, 18.2, 6.4] },
  ],

  download: [
    { k: 'line', p: [12, 3.4, 12, 14.6] },
    { k: 'poly', p: [7.0, 9.6, 12, 14.8, 17.0, 9.6] },
    { k: 'poly', p: [3.8, 17.0, 3.8, 20.6, 20.2, 20.6, 20.2, 17.0] },
  ],

  sort: [
    { k: 'line', p: [3.8, 6.6, 20.2, 6.6] },
    { k: 'line', p: [3.8, 12.0, 15.0, 12.0] },
    { k: 'line', p: [3.8, 17.4, 10.0, 17.4] },
  ],

  filter: [
    {
      k: 'poly',
      p: [20.8, 4.2, 3.2, 4.2, 10.2, 12.5, 10.2, 18.3, 13.8, 20.0, 13.8, 12.5],
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
