// The titling banner.
//
// Every one of the reference frontispieces titles itself the same way: gold
// letters on a deep lapis field, held between gold rules, with a mark at each
// end. It is the single most recognisable device in the whole visual tradition
// — the inscription band under the Lateran apse, the frieze on a Della Robbia
// altarpiece, the header of an illuminated title page — and the app had
// nothing in its place but a small bronze overline over a gold word, which is
// how every mobile screen ever built announces itself.
//
// Two pieces:
//
//   <Banner>         the screen's own title. Lapis field, gold rule above and
//                    below, a fleuron at each end.
//   <BannerHeading>  a section division inside the page. Same language at a
//                    smaller size, so a screen reads as one document rather
//                    than a title followed by unrelated headings.

import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, space, type as t, ornament, radius } from '../theme';

export interface BannerProps {
  /** The title itself. Set in caps by the component — do not pre-uppercase. */
  title: string;
  /** Optional line above the title, inside the field. */
  eyebrow?: string;
  /** Rendered to the right of the field, outside it — screen actions. */
  actions?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Banner({ title, eyebrow, actions, style }: BannerProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.field}>
        {/* Gold rules, inlaid rather than bordered — a border would box the
            field; these read as the metal strip a banner is fixed under. */}
        <View style={styles.ruleTop} />
        <View style={styles.ruleBottom} />

        <View style={styles.fieldRow}>
          <Text style={styles.endMark}>{ornament.lozenge}</Text>
          <View style={styles.titleBlock}>
            {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>}
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
              {title.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.endMark}>{ornament.lozenge}</Text>
        </View>
      </View>

      {!!actions && <View style={styles.actions}>{actions}</View>}
    </View>
  );
}

/**
 * A section division. Gold on lapis like the banner but quieter, so the
 * hierarchy between "this screen" and "this part of the screen" survives.
 */
export function BannerHeading({
  label,
  style,
}: {
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.headingField, style]}>
      <View style={styles.headingRuleTop} />
      <Text style={styles.headingLabel} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      <View style={styles.headingRuleBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space.md },

  /* --- screen banner ------------------------------------------------------ */
  field: {
    flex: 1,
    backgroundColor: colors.lapis,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  ruleTop: { position: 'absolute', top: 3, left: 0, right: 0, height: 1, backgroundColor: colors.lapisRule },
  ruleBottom: { position: 'absolute', bottom: 3, left: 0, right: 0, height: 1, backgroundColor: colors.lapisRule },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  titleBlock: { flex: 1, alignItems: 'center' },
  eyebrow: { ...t.overline, fontSize: 8, letterSpacing: 2.4, color: colors.bronze, marginBottom: 3 },
  /** Widely tracked: an inscription is never set tight. */
  title: { ...t.display, fontSize: 22, letterSpacing: 3, color: colors.goldBright, textAlign: 'center' },
  endMark: { color: colors.gold, fontSize: 11 },
  actions: { flexDirection: 'row', gap: space.sm },

  /* --- section heading ---------------------------------------------------- */
  headingField: {
    alignSelf: 'stretch',
    backgroundColor: colors.lapis,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: space.heading,
  },
  headingRuleTop: { position: 'absolute', top: 2, left: 0, right: 0, height: 1, backgroundColor: colors.lapisRule },
  headingRuleBottom: { position: 'absolute', bottom: 2, left: 0, right: 0, height: 1, backgroundColor: colors.lapisRule },
  headingLabel: { ...t.overline, fontSize: 11, letterSpacing: 2.6, color: colors.goldBright, textAlign: 'center' },
});

export default Banner;
