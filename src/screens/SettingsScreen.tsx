import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { TTSService } from '../services/TTSService';
import { READER_THEMES } from '../types';
import { colors, fonts, space, radius, type, elevation, readerPalettes } from '../theme';

import Shell from '../components/Shell';
/* ------------------------------------------------------------------ *
 * Building blocks
 * ------------------------------------------------------------------ */

/** A titled group of settings drawn as a raised card. */
function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!caption && <Text style={styles.sectionCaption}>{caption}</Text>}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

/** Label above a control, with the live value set flush right. */
function Field({
  label,
  value,
  children,
  last,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.field, last && styles.fieldLast]}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {!!value && <Text style={styles.fieldValue}>{value}</Text>}
      </View>
      {children}
    </View>
  );
}

export interface SegmentedOption<T> {
  label: string;
  value: T;
}

/**
 * Segmented control. An inset track holds the options; the selected one is a
 * solid gold pill with dark type, so the active choice is unmistakable —
 * the old version only nudged a 1px border colour.
 */
function Segmented<T extends string | number>({
  options,
  selected,
  onSelect,
}: {
  options: SegmentedOption<T>[];
  selected: (value: T) => boolean;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.track}>
      {options.map(opt => {
        const active = selected(opt.value);
        return (
          <TouchableOpacity
            key={String(opt.value)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onSelect(opt.value)}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Full-width row with a switch — used for the boolean settings. */
function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
  last,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, last && styles.fieldLast]}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {!!hint && <Text style={styles.toggleHint}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.surfaceRaised, true: colors.bronze }}
        thumbColor={value ? colors.goldBright : colors.inkMuted}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Screen
 * ------------------------------------------------------------------ */

export default function SettingsScreen() {
  const { settings, updateSettings } = useApp();
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter a valid API key');
      return;
    }
    try {
      await TTSService.setApiKey(apiKey);
      setApiKey('');
      Alert.alert('Success', 'API key saved securely');
    } catch (error) {
      Alert.alert('Error', 'Failed to save API key');
    }
  };

  const near = (a: number, b: number) => Math.abs(a - b) < 0.05;
  const themeNames = Object.keys(READER_THEMES);

  return (
    <Shell scroll gutter={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Annotated</Text>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerRule} />
      </View>

      {/* ---------------------------------------------------------- Reading */}
      <Section title="Reading" caption="How the page is set beneath your eye.">
        <Field label="Page theme" value={READER_THEMES[settings.theme]?.name}>
          <View style={styles.themeRow}>
            {themeNames.map(name => {
              const t = READER_THEMES[name];
              // Preview the palette the reader actually renders, not READER_THEMES,
              // which still holds the pre-redesign colours.
              const p = readerPalettes[name] || readerPalettes.dark;
              const active = settings.theme === name;
              return (
                <TouchableOpacity
                  key={name}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.themeChip, active && styles.themeChipActive]}
                  onPress={() => updateSettings({ theme: name as any })}
                >
                  <View style={[styles.swatch, { backgroundColor: p.bg }]}>
                    <View style={[styles.swatchLine, { backgroundColor: p.text }]} />
                    <View
                      style={[
                        styles.swatchLine,
                        styles.swatchLineShort,
                        { backgroundColor: p.text },
                      ]}
                    />
                  </View>
                  <Text style={[styles.themeName, active && styles.themeNameActive]}>
                    {t.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>

        <Field label="Type size" value={`${settings.fontSize} pt`}>
          <Segmented
            options={[14, 16, 18, 20, 22, 24].map(s => ({ label: String(s), value: s }))}
            selected={v => settings.fontSize === v}
            onSelect={v => updateSettings({ fontSize: v })}
          />
        </Field>

        <Field label="Line height" value={settings.lineHeight.toFixed(1)}>
          <Segmented
            options={[1.3, 1.5, 1.7, 1.9, 2.1].map(h => ({ label: h.toFixed(1), value: h }))}
            selected={v => near(settings.lineHeight, v)}
            onSelect={v => updateSettings({ lineHeight: v })}
          />
        </Field>

        <Field label="Margins" value={settings.marginSize}>
          <Segmented
            options={[
              { label: 'Narrow', value: 'small' },
              { label: 'Medium', value: 'medium' },
              { label: 'Wide', value: 'large' },
            ]}
            selected={v => settings.marginSize === v}
            onSelect={v => updateSettings({ marginSize: v as any })}
          />
        </Field>

        <Field label="Page turning" value={settings.pageMode}>
          <Segmented
            options={[
              { label: 'Scroll', value: 'scroll' },
              { label: 'Paginated', value: 'paginated' },
            ]}
            selected={v => settings.pageMode === v}
            onSelect={v => updateSettings({ pageMode: v as any })}
          />
        </Field>

        <ToggleRow
          label="Justify text"
          hint="Align both margins, as in a printed book."
          value={settings.textAlignment === 'justify'}
          onValueChange={v => updateSettings({ textAlignment: v ? 'justify' : 'left' })}
          last
        />
      </Section>

      {/* ---------------------------------------------------------- Display */}
      <Section title="Display" caption="Brightness while you read.">
        <ToggleRow
          label="Auto brightness"
          hint="Follow the ambient light of the room."
          value={settings.autoBrightnessEnabled}
          onValueChange={v => updateSettings({ autoBrightnessEnabled: v })}
          last={settings.autoBrightnessEnabled}
        />

        {!settings.autoBrightnessEnabled && (
          <Field
            label="Brightness"
            value={`${Math.round(settings.brightness * 100)}%`}
            last
          >
            <Segmented
              options={[0.3, 0.5, 0.7, 1].map(b => ({
                label: `${Math.round(b * 100)}%`,
                value: b,
              }))}
              selected={v => near(settings.brightness, v)}
              onSelect={v => updateSettings({ brightness: v })}
            />
          </Field>
        )}
      </Section>

      {/* ------------------------------------------------------------ Voice */}
      <Section title="Voice" caption="Google Cloud Text-to-Speech reads aloud to you.">
        <Field label="API key" last={false}>
          <View style={styles.keyWrap}>
            <TextInput
              style={styles.keyInput}
              placeholder="Paste your Google Cloud API key"
              placeholderTextColor={colors.bronze}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={!showApiKey}
              multiline
            />
            <TouchableOpacity
              onPress={() => setShowApiKey(!showApiKey)}
              style={styles.revealButton}
              accessibilityRole="button"
            >
              <Text style={styles.revealText}>{showApiKey ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={handleSaveApiKey}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Save key</Text>
          </TouchableOpacity>

          <Text style={styles.help}>
            Free to obtain: create a project at console.cloud.google.com, enable the
            Cloud Text-to-Speech API, then issue an API key. It is stored on this
            device only.
          </Text>
        </Field>

        <Field label="Voice pitch" value={settings.ttsVoicePitch.toFixed(1)}>
          <Segmented
            options={[0.8, 0.9, 1.0, 1.1, 1.2].map(p => ({ label: p.toFixed(1), value: p }))}
            selected={v => near(settings.ttsVoicePitch, v)}
            onSelect={v => updateSettings({ ttsVoicePitch: v })}
          />
        </Field>

        <Field label="Speaking rate" value={`${settings.ttsVoiceRate.toFixed(1)}×`}>
          <Segmented
            options={[0.8, 0.9, 1.0, 1.1, 1.2, 1.3].map(r => ({
              label: r.toFixed(1),
              value: r,
            }))}
            selected={v => near(settings.ttsVoiceRate, v)}
            onSelect={v => updateSettings({ ttsVoiceRate: v })}
          />
        </Field>

        <ToggleRow
          label="Neural voices"
          hint="Richer, slower to synthesise, and metered."
          value={settings.enableTTS}
          onValueChange={v => updateSettings({ enableTTS: v })}
          last
        />
      </Section>

      {/* ------------------------------------------------------------ About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={[styles.field, styles.fieldLast]}>
            <Text style={styles.aboutName}>Annotated</Text>
            <Text style={styles.aboutVersion}>Version 2.0</Text>
            <View style={styles.aboutRule} />
            <Text style={styles.aboutBody}>
              A reader for the classical Christian tradition — goodness, beauty,
              and truth, with annotations, voice, and a library of public-domain
              texts.
            </Text>
            <Text style={styles.aboutFine}>© 2024. All rights reserved.</Text>
          </View>
        </View>
      </View>
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * Styles
 * ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxxl },

  header: { marginBottom: space.xl, marginTop: space.sm },
  eyebrow: {
    ...type.overline,
    color: colors.bronze,
    textTransform: 'uppercase',
    marginBottom: space.xs,
  },
  title: { ...type.display, color: colors.gold },
  headerRule: {
    height: 1,
    backgroundColor: colors.rule,
    marginTop: space.lg,
  },

  section: { marginBottom: space.xxl },
  sectionTitle: {
    ...type.heading,
    color: colors.goldBright,
    marginBottom: space.xs,
  },
  sectionCaption: {
    ...type.caption,
    color: colors.inkMuted,
    marginBottom: space.md,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    marginTop: space.sm,
    ...elevation.card,
  },

  field: {
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  fieldLast: { borderBottomWidth: 0 },
  fieldHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  fieldLabel: { ...type.title, color: colors.ink },
  fieldValue: {
    ...type.caption,
    color: colors.gold,
    fontFamily: fonts.display,
    fontSize: 13,
    textTransform: 'capitalize',
  },

  /* Segmented control */
  track: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: space.xs,
  },
  segment: {
    flexGrow: 1,
    flexBasis: 44,
    minWidth: 44,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.gold },
  segmentText: {
    ...type.caption,
    fontSize: 13,
    color: colors.inkMuted,
  },
  segmentTextActive: {
    color: colors.bg,
    fontWeight: '600',
  },

  /* Theme chooser */
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  themeChip: {
    flexGrow: 1,
    flexBasis: 68,
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.bg,
  },
  themeChipActive: {
    borderColor: colors.gold,
    backgroundColor: colors.surfaceRaised,
  },
  swatch: {
    width: 40,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.sm,
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 3,
    overflow: 'hidden',
  },
  swatchLine: { height: 2, borderRadius: 1, opacity: 0.75 },
  swatchLineShort: { width: '60%' },
  themeName: { ...type.caption, color: colors.inkMuted },
  themeNameActive: { color: colors.goldBright },

  /* Toggles */
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  toggleCopy: { flex: 1 },
  toggleLabel: { ...type.title, color: colors.ink },
  toggleHint: { ...type.caption, color: colors.inkMuted, marginTop: space.xs },

  /* API key */
  keyWrap: { position: 'relative' },
  keyInput: {
    backgroundColor: colors.bg,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingLeft: space.md,
    paddingRight: 72,
    minHeight: 76,
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 20,
  },
  revealButton: {
    position: 'absolute',
    right: space.sm,
    top: space.sm,
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  revealText: { ...type.overline, color: colors.gold, textTransform: 'uppercase' },

  primaryButton: {
    marginTop: space.md,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
    ...elevation.card,
  },
  primaryButtonText: {
    ...type.title,
    fontSize: 15,
    color: colors.bg,
    fontWeight: '600',
  },
  help: {
    ...type.caption,
    color: colors.inkMuted,
    lineHeight: 19,
    marginTop: space.md,
  },

  /* About */
  aboutName: { ...type.heading, color: colors.gold },
  aboutVersion: { ...type.caption, color: colors.bronze, marginTop: space.xs },
  aboutRule: {
    height: 1,
    backgroundColor: colors.rule,
    marginVertical: space.md,
    width: 56,
  },
  aboutBody: { ...type.body, color: colors.inkMuted },
  aboutFine: { ...type.caption, color: colors.bronze, marginTop: space.md },
});
