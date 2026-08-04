// MoreScreen — the fifth tab, and the reason the tab bar could drop from nine
// tabs to five.
//
// Nothing was removed in that consolidation: Bookshelf, Collections, Dictionary,
// Highlights, Stats and Settings all used to be top-level tabs, sharing a bar so
// crowded that every label had to be shrunk to 11px and half of them still
// truncated. Each of the owner's five reference apps has FOUR OR FIVE tabs and a
// "More" page exactly like this one — a grouped menu that is a destination in its
// own right rather than an apology for running out of room.
//
// The screen is deliberately the plainest in the app:
//
//   * NO action accent. `colors.action` is the one saturated colour on a screen
//     and it marks the single next action. A menu has six equally-weighted
//     destinations and no next action, so using it anywhere here would be a lie.
//     Everything is neutral, with gold reserved for the icons and headings.
//   * Grouped cards at `radius.lg`, hairline separators inset to the text
//     column, chevrons on every row so the affordance is unambiguous.
//   * `space.section` between groups, which is the app-wide rhythm.
//
// It is wrapped in <Shell> like every other screen, so at 1365px it stays a
// centred phone-width column instead of stretching six 1300px-wide rows across
// the desktop.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Shell from '../components/Shell';
import Section from '../components/Section';
import { Icon, ChevronRightIcon, type IconName } from '../components/icons';
import { colors, space, radius, type as typeScale, elevation } from '../theme';
import { useApp } from '../context/AppContext';

/**
 * The More stack, declared here rather than in App.tsx so this screen can type
 * its own `navigate` calls. App.tsx imports it to build the navigator and the
 * linking config from the same source — a stale copy in either place is how a
 * deep link silently lands on the wrong screen.
 *
 * `MoreHome` is the menu itself; every other entry is a destination pushed on
 * top of it, which is what gives each one a real back gesture instead of the
 * dead-end a tab press produces.
 */
export type MoreStackParamList = {
  MoreHome: undefined;
  Bookshelf: undefined;
  Collections: undefined;
  Dictionary: undefined;
  Highlights: undefined;
  Stats: undefined;
  Settings: undefined;
};

type MoreNavigation = NativeStackNavigationProp<MoreStackParamList, 'MoreHome'>;

/** A destination in the menu. */
interface MenuRowSpec {
  route: Exclude<keyof MoreStackParamList, 'MoreHome'>;
  icon: IconName;
  label: string;
  /** One line saying what is actually behind the row. */
  detail: string;
  /**
   * Right-hand count. Rendered only when it is a positive number — a row that
   * reads "0" looks broken, whereas a row with no count simply looks quiet.
   */
  count?: number;
}

interface MenuGroup {
  title: string;
  rows: MenuRowSpec[];
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function MenuRow({ spec, onPress }: { spec: MenuRowSpec; onPress: () => void }) {
  const showCount = typeof spec.count === 'number' && spec.count > 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel={spec.label}
      accessibilityHint={spec.detail}
      testID={`more-row-${spec.route}`}
    >
      <View style={styles.row}>
        <View style={styles.tile}>
          <Icon name={spec.icon} size={21} color={colors.gold} strokeWidth={1.7} />
        </View>

        <View style={styles.rowText}>
          <Text style={styles.rowLabel} numberOfLines={1}>
            {spec.label}
          </Text>
          <Text style={styles.rowDetail} numberOfLines={1}>
            {spec.detail}
          </Text>
        </View>

        {showCount && (
          <Text style={styles.rowCount} numberOfLines={1}>
            {spec.count}
          </Text>
        )}
        <ChevronRightIcon size={15} color={colors.bronze} strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MoreScreen() {
  const navigation = useNavigation<MoreNavigation>();
  const { books, collections, highlights, wordLookups } = useApp();

  // Counts are read live rather than baked into a module constant: a menu that
  // quotes the wrong number of volumes is worse than one that quotes none.
  const groups: MenuGroup[] = [
    {
      title: 'Your Books',
      rows: [
        {
          route: 'Bookshelf',
          icon: 'shelf',
          label: 'Bookshelf',
          detail: 'Reading, to read, and finished',
          count: books.length,
        },
        {
          route: 'Collections',
          icon: 'collections',
          label: 'Collections',
          detail: 'Group volumes into your own sets',
          count: collections.length,
        },
      ],
    },
    {
      title: 'Study',
      rows: [
        {
          route: 'Highlights',
          icon: 'highlights',
          label: 'Highlights',
          detail: 'Passages you have marked',
          count: highlights.length,
        },
        {
          route: 'Dictionary',
          icon: 'dictionary',
          label: 'Dictionary',
          detail: 'Words looked up while reading',
          count: wordLookups.length,
        },
      ],
    },
    {
      title: 'Your Reading',
      rows: [
        {
          route: 'Stats',
          icon: 'stats',
          label: 'Statistics',
          detail: 'Time read, streaks, and pace',
        },
        {
          route: 'Settings',
          icon: 'settings',
          label: 'Settings',
          detail: 'Typography, theme, and voice',
        },
      ],
    },
  ];

  return (
    <Shell scroll testID="more-screen">
      <View style={styles.masthead}>
        <Text style={styles.overline}>ANNOTATED</Text>
        <Text style={styles.title}>More</Text>
        <Text style={styles.blurb}>Your shelves, your marginalia, and how the page reads.</Text>
      </View>

      {groups.map((group, groupIndex) => (
        <Section
          key={group.title}
          title={group.title}
          last={groupIndex === groups.length - 1}
          testID={`more-group-${groupIndex}`}
        >
          {/* Shadow lives on the outer view; the inner one clips the rows to the
              card's corners so a pressed row never paints past the radius. */}
          <View style={styles.card}>
            <View style={styles.cardClip}>
              {group.rows.map((spec, rowIndex) => (
                // The separator is its own element rather than a border on the
                // row. A `borderTopWidth` + `marginLeft` on the row itself would
                // inset the hairline AND shove that row's icon 68px to the
                // right, which is exactly the kind of drift a list like this
                // shows up immediately.
                <React.Fragment key={spec.route}>
                  {rowIndex > 0 && <View style={styles.separator} />}
                  <MenuRow spec={spec} onPress={() => navigation.navigate(spec.route)} />
                </React.Fragment>
              ))}
            </View>
          </View>
        </Section>
      ))}

      <Text style={styles.footer}>A reader for the classical Christian canon.</Text>
    </Shell>
  );
}

export { MoreScreen };

// Gutter inside a card, plus the icon tile and the gap after it. The separator
// is inset by exactly this so it starts at the text column rather than cutting
// the icons in half.
const CARD_PAD = space.lg;
const TILE = 40;
const TILE_GAP = space.md;

const styles = StyleSheet.create({
  masthead: {
    paddingTop: space.xl,
    marginBottom: space.xl,
  },
  overline: {
    ...typeScale.overline,
    color: colors.bronze,
    textTransform: 'uppercase',
    marginBottom: space.sm,
  },
  title: {
    ...typeScale.display,
    color: colors.gold,
  },
  blurb: {
    ...typeScale.body,
    color: colors.inkMuted,
    marginTop: space.sm,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...elevation.card,
  },
  cardClip: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.rule,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CARD_PAD,
    paddingVertical: space.md + 2,
    gap: TILE_GAP,
  },
  /** Hairline pulled in to the text column, iOS-style, so the icon tiles read
   *  as a continuous rail down the card. */
  separator: {
    height: 1,
    backgroundColor: colors.rule,
    marginLeft: CARD_PAD + TILE + TILE_GAP,
  },

  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 169, 97, 0.09)',
    borderWidth: 1,
    borderColor: colors.rule,
  },

  /** Shrinks so a long detail line truncates instead of shoving the chevron out. */
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    ...typeScale.title,
    color: colors.ink,
  },
  rowDetail: {
    ...typeScale.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },
  rowCount: {
    ...typeScale.caption,
    color: colors.bronze,
    fontVariant: ['tabular-nums'],
  },

  footer: {
    ...typeScale.caption,
    color: colors.bronze,
    textAlign: 'center',
    marginTop: space.xl,
    opacity: 0.8,
  },
});
