// Scribal ornament.
//
// The app had exactly one ornamental gesture in it — a rule/diamond/rule
// stack hand-rolled inside ReaderScreen's empty state — and nothing else on
// any screen. That absence is most of why a gold-on-aubergine palette still
// read as a dark-mode utility: a sacred book is not distinguished from a
// settings screen by its hue, it is distinguished by the fact that someone
// bothered to DECORATE it. Rules terminate. Sections are marked. Openings are
// announced.
//
// These are typographic marks rather than drawn shapes on purpose: a fleuron
// is a real sort a compositor would reach for, it inherits colour and optical
// weight from the type around it, and it costs no dependency (react-native-svg
// is not installed — see icons.tsx).

import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, space, ornament, type as t } from '../theme';

export interface RuleProps {
  /** Ink for both the rules and the centre mark. Defaults to the hairline gold. */
  color?: string;
  /** Colour of the centre mark alone, when it should differ from the rules —
   *  a rubricated mark on gold rules is the manuscript convention. */
  markColor?: string;
  /** Which mark sits at the centre. `none` gives a plain terminated rule. */
  mark?: keyof typeof ornament | 'none';
  /** Optical size of the centre mark. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A centred rule with a mark in it — the standard section break.
 *
 * The rules stop short of the mark rather than running under it, which is what
 * separates a typeset ornament from a horizontal line with an emoji dropped on
 * top of it.
 */
export function OrnamentRule({
  color = colors.rule,
  markColor,
  mark = 'fleuron',
  size = 13,
  style,
}: RuleProps) {
  return (
    <View style={[styles.ruleRow, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.rule, { backgroundColor: color }]} />
      {mark !== 'none' && (
        <Text style={[styles.mark, { color: markColor || color, fontSize: size }]}>
          {ornament[mark]}
        </Text>
      )}
      <View style={[styles.rule, { backgroundColor: color }]} />
    </View>
  );
}

/**
 * A section heading with rules running out to both margins — the way a
 * manuscript announces a division rather than just setting text larger.
 */
export function OrnamentHeading({
  label,
  color = colors.gold,
  ruleColor = colors.rule,
  style,
}: {
  label: string;
  color?: string;
  ruleColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.headingRow, style]}>
      <View style={[styles.rule, { backgroundColor: ruleColor }]} />
      <Text style={[styles.headingLabel, { color }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      <View style={[styles.rule, { backgroundColor: ruleColor }]} />
    </View>
  );
}

/**
 * A terminal mark — the single fleuron that closes an empty state or the foot
 * of a list. Centred, quiet, and never given a rule.
 */
export function OrnamentMark({
  mark = 'fleuron',
  color = colors.bronze,
  size = 20,
  style,
}: {
  mark?: keyof typeof ornament;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Text
      style={[styles.terminal, { color, fontSize: size, lineHeight: Math.round(size * 1.3) }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {ornament[mark]}
    </Text>
  );
}

const styles = StyleSheet.create({
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    alignSelf: 'stretch',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    alignSelf: 'stretch',
  },
  /** flex:1 on both sides is what centres the mark regardless of its width. */
  rule: { flex: 1, height: 1 },
  mark: { textAlign: 'center' },
  headingLabel: { ...t.overline, letterSpacing: 2.2, flexShrink: 1 },
  terminal: { textAlign: 'center' },
});

export default OrnamentRule;
