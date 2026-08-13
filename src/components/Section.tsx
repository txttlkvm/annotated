// Section — a titled block with the app's vertical rhythm baked in.
//
//   <Section title="Continue Reading">        …content…        </Section>
//   <Section title="Trending" actionLabel="See all" onAction={…}>  …  </Section>
//
// Two things this centralises, both of which the screens were getting wrong in
// slightly different ways each time:
//
// 1. RHYTHM. The references breathe — 28–32px between sections, and a tighter
//    ~14px between a heading and the content it heads. When every screen
//    hand-rolls `marginBottom: 20` the page reads as an undifferentiated list
//    instead of a set of blocks. `space.section` / `space.heading` are the
//    canonical values; this component is where they get applied.
//
// 2. THE HEADING FACE. Section headings are display serif (`type.heading`) in
//    gold. They are the app's connective tissue and the single cheapest signal
//    that this is a book app rather than a generic dashboard.
//
// Deliberately applies NO horizontal padding: the enclosing <Shell>/<Column>
// owns the page gutter, so a <Carousel bleed> child can still run off the edge.
//
// "See all" is intentionally NOT the action accent. `colors.action` is reserved
// for the one next action on a screen (Continue Reading, Add to Library); the
// moment a row of "See all" links is also action-coloured, none of them is the
// action. Gold — the chrome colour — is correct here.

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, space, type as typeScale, HIT_SLOP_MIN } from '../theme';
import { ChevronRightIcon } from './icons';

export interface SectionProps {
  /** Section heading, set in the display serif. */
  title?: string;

  /** Optional line under the title — a count, a scope, a short gloss. */
  subtitle?: string;

  /** Right-aligned affordance, e.g. "See all". Needs `onAction` to render. */
  actionLabel?: string;

  /** Tap handler for `actionLabel`. */
  onAction?: () => void;

  /** Arbitrary right-hand header content. Wins over `actionLabel` if both given. */
  headerRight?: React.ReactNode;

  /** Hide the chevron beside `actionLabel`. */
  hideActionChevron?: boolean;

  /** Gap between the header and the body. Defaults to `space.heading` (14). */
  gap?: number;

  /** Space below the whole section. Defaults to `space.section` (32). */
  spacing?: number;

  /** Last section on a screen — drops the bottom spacing. */
  last?: boolean;

  style?: StyleProp<ViewStyle>;
  headerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  bodyStyle?: StyleProp<ViewStyle>;

  children?: React.ReactNode;
  testID?: string;
}

export default function Section({
  title,
  subtitle,
  actionLabel,
  onAction,
  headerRight,
  hideActionChevron = false,
  gap = space.heading,
  spacing = space.section,
  last = false,
  style,
  headerStyle,
  titleStyle,
  bodyStyle,
  children,
  testID,
}: SectionProps) {
  const right =
    headerRight ??
    (actionLabel && onAction ? (
      <TouchableOpacity
        onPress={onAction}
        activeOpacity={0.7}
        // The label is small; give it a real touch target without letting it
        // push the header taller. hitSlop alone is honoured unreliably by
        // react-native-web, so the box is set explicitly and the label inside
        // stays the size it was.
        style={styles.actionHit}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={title ? `${actionLabel} ${title}` : actionLabel}
        testID={testID ? `${testID}-action` : undefined}
      >
        <View style={styles.action}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
          {!hideActionChevron && (
            <ChevronRightIcon size={13} color={colors.gold} strokeWidth={2} />
          )}
        </View>
      </TouchableOpacity>
    ) : null);

  const hasHeader = !!title || !!subtitle || !!right;

  return (
    <View testID={testID} style={[!last && { marginBottom: spacing }, style]}>
      {hasHeader && (
        <View style={[styles.header, !!children && { marginBottom: gap }, headerStyle]}>
          <View style={styles.headings}>
            {!!title && (
              <Text style={[styles.title, titleStyle]} numberOfLines={1}>
                {title}
              </Text>
            )}
            {!!subtitle && (
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            )}
          </View>
          {!!right && <View style={styles.right}>{right}</View>}
        </View>
      )}
      {!!children && <View style={bodyStyle}>{children}</View>}
    </View>
  );
}

export { Section };

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  /** Shrinks so a long title truncates rather than shoving "See all" off-screen. */
  headings: {
    flexShrink: 1,
    minWidth: 0,
  },
  title: {
    ...typeScale.heading,
    color: colors.gold,
  },
  subtitle: {
    ...typeScale.caption,
    color: colors.inkMuted,
    marginTop: 3,
  },
  right: {
    flexShrink: 0,
    marginLeft: space.md,
  },
  actionHit: {
    minHeight: HIT_SLOP_MIN,
    justifyContent: 'center',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  actionLabel: {
    ...typeScale.caption,
    color: colors.gold,
  },
});
