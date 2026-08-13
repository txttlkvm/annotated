// The primary action, as gold leaf under an arch.
//
// Replaces a fully-rounded ember-orange stadium — a shape and a hue that between
// them said "consumer app" louder than any amount of aubergine and gold said
// "book". Two changes carry the whole difference:
//
//   METAL   A flat fill reads as plastic. Real leaf has a struck highlight
//           along its top edge and a shadowed foot, because it is a physical
//           surface catching light. That is two hairline Views, no gradient
//           dependency (expo-linear-gradient is not installed).
//
//   ARCH    A round-headed arch on a squared foot, per `arch.round`. The
//           silhouette is what the eye reads first, and a stadium is the
//           silhouette of a toggle.
//
// Press behaviour is inherited from ScaleTouchable so this still has the same
// spring compression as every other control.

import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import ScaleTouchable from './ScaleTouchable';
import { colors, space, arch, type as t, HIT_SLOP_MIN, elevation } from '../theme';

export interface LeafButtonProps {
  label: string;
  onPress: () => void;
  /** Glyph or icon rendered before the label. */
  children?: React.ReactNode;
  disabled?: boolean;
  /** Outlined variant: no leaf, gold hairline and gold label. For a second
   *  action that must not compete with the leafed one. */
  quiet?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export default function LeafButton({
  label,
  onPress,
  children,
  disabled,
  quiet,
  style,
  labelStyle,
  accessibilityLabel,
  testID,
}: LeafButtonProps) {
  return (
    <ScaleTouchable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.base,
        arch.round,
        quiet ? styles.quiet : [styles.leaf, elevation.card],
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      testID={testID}
    >
      {/* Struck highlight and shadowed foot. Absolutely positioned so they
          cannot affect the button's own layout or its 44px floor. */}
      {!quiet && (
        <>
          <View pointerEvents="none" style={[styles.edge, styles.edgeTop]} />
          <View pointerEvents="none" style={[styles.edge, styles.edgeBottom]} />
        </>
      )}
      {children}
      <Text
        style={[t.caption, styles.label, quiet ? styles.labelQuiet : styles.labelLeaf, labelStyle]}
        numberOfLines={1}
      >
        {label.toUpperCase()}
      </Text>
    </ScaleTouchable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    minHeight: HIT_SLOP_MIN,
    overflow: 'hidden',
  },
  leaf: { backgroundColor: colors.action },
  quiet: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.actionBorder,
  },
  disabled: { opacity: 0.45 },

  edge: { position: 'absolute', left: 0, right: 0, height: 1 },
  edgeTop: { top: 0, backgroundColor: colors.leafHi },
  edgeBottom: { bottom: 0, backgroundColor: colors.leafLo },

  /** Tracked wide: a struck label on metal is never set tight. */
  label: { letterSpacing: 1.4, fontWeight: '600' },
  labelLeaf: { color: colors.actionInk },
  labelQuiet: { color: colors.gold },
});
