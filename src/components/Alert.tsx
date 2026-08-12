import React, { useEffect, useState } from 'react';
import { Alert as RNAlert, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, space, type as t, elevation } from '../theme';

const isWeb = Platform.OS === 'web';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

type Queued = { title: string; message?: string; buttons: AlertButton[] };

/**
 * react-native-web has no native alert()/confirm() dialog — RN's own Alert
 * module is a silent no-op there. Every button wired to it (delete, save,
 * "are you sure?") calls the function, nothing throws, and nothing visibly
 * happens: the exact "I tap it and nothing happens" symptom. Thirteen screens
 * called RN's Alert directly.
 *
 * This is a drop-in replacement with the same call shape — `Alert.alert(title,
 * message, buttons)` — so every call site only needs its import swapped, not
 * rewritten. Native keeps using the real, working RN Alert unchanged.
 */
let emit: ((q: Queued | null) => void) | null = null;

function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (!isWeb) {
    RNAlert.alert(title, message, buttons as any);
    return;
  }
  const resolved = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  emit?.({ title, message, buttons: resolved });
}

export const Alert = { alert };

/** Mount once near the app root. Renders whatever Alert.alert() last queued. */
export function AlertHost() {
  const [queued, setQueued] = useState<Queued | null>(null);

  useEffect(() => {
    emit = setQueued;
    return () => {
      emit = null;
    };
  }, []);

  if (!isWeb || !queued) return null;

  const dismiss = (button: AlertButton) => {
    setQueued(null);
    button.onPress?.();
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => dismiss(queued.buttons[0])}>
      <View style={styles.backdrop}>
        <View style={[styles.card, elevation.card]}>
          <Text style={styles.title}>{queued.title}</Text>
          {!!queued.message && <Text style={styles.message}>{queued.message}</Text>}
          <View style={styles.buttonRow}>
            {queued.buttons.map((b, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.button,
                  b.style === 'destructive' && styles.buttonDestructive,
                  b.style === 'cancel' && styles.buttonCancel,
                ]}
                onPress={() => dismiss(b)}
                accessibilityRole="button"
                accessibilityLabel={b.text}
              >
                <Text
                  style={[
                    styles.buttonText,
                    b.style === 'destructive' && styles.buttonTextDestructive,
                    b.style === 'cancel' && styles.buttonTextCancel,
                  ]}
                >
                  {b.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.xl,
  },
  title: { ...t.title, color: colors.gold, marginBottom: space.sm },
  message: { ...t.body, color: colors.inkMuted, marginBottom: space.lg },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  button: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  buttonDestructive: { backgroundColor: colors.danger },
  buttonCancel: { backgroundColor: 'transparent' },
  buttonText: { ...t.caption, color: colors.gold, fontWeight: '600' },
  buttonTextDestructive: { color: '#fff' },
  buttonTextCancel: { color: colors.bronze },
});
