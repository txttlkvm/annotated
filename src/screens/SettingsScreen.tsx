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
  Dimensions,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { TTSService } from '../services/TTSService';
import { READER_THEMES } from '../types';

const { width } = Dimensions.get('window');

export default function SettingsScreen() {
  const { settings, updateSettings } = useApp();
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const theme = READER_THEMES[settings.theme];

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

  const SettingRow = ({
    label,
    value,
    onValueChange,
    type = 'text',
  }: {
    label: string;
    value: any;
    onValueChange: (val: any) => void;
    type?: 'text' | 'toggle' | 'slider';
  }) => {
    return (
      <View style={[styles.settingRow, { borderBottomColor: theme.selectionColor }]}>
        <Text style={[styles.settingLabel, { color: theme.textColor }]}>{label}</Text>
        {type === 'toggle' && (
          <Switch
            value={value}
            onValueChange={onValueChange}
            trackColor={{ false: '#3e3e3e', true: '#4A90E2' }}
            thumbColor="#fff"
          />
        )}
        {type === 'text' && (
          <Text style={[styles.settingValue, { color: theme.accentColor }]}>{value}</Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.content}
    >
      {/* Reader Settings */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>📖 Reader Settings</Text>

        <View style={styles.settingGroup}>
          <Text style={[styles.groupLabel, { color: theme.textColor }]}>Theme</Text>
          <View style={styles.themeButtons}>
            {Object.keys(READER_THEMES).map(themeName => (
              <TouchableOpacity
                key={themeName}
                style={[
                  styles.themeButton,
                  settings.theme === themeName && { borderColor: '#4A90E2', borderWidth: 2 },
                ]}
                onPress={() => updateSettings({ theme: themeName as any })}
              >
                <Text style={[styles.themeButtonText, { color: theme.textColor }]}>
                  {themeName.charAt(0).toUpperCase() + themeName.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingGroup}>
          <Text style={[styles.groupLabel, { color: theme.textColor }]}>Font Size: {settings.fontSize}px</Text>
          <View style={styles.buttonRow}>
            {[14, 16, 18, 20, 22, 24].map(size => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.sizeButton,
                  settings.fontSize === size && { backgroundColor: '#4A90E2' },
                ]}
                onPress={() => updateSettings({ fontSize: size })}
              >
                <Text style={styles.buttonText}>{size}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingGroup}>
          <Text style={[styles.groupLabel, { color: theme.textColor }]}>Line Height: {settings.lineHeight.toFixed(1)}</Text>
          <View style={styles.buttonRow}>
            {[1.3, 1.5, 1.7, 1.9, 2.1].map(height => (
              <TouchableOpacity
                key={height}
                style={[
                  styles.sizeButton,
                  Math.abs(settings.lineHeight - height) < 0.05 && { backgroundColor: '#4A90E2' },
                ]}
                onPress={() => updateSettings({ lineHeight: height })}
              >
                <Text style={styles.buttonText}>{height.toFixed(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <SettingRow
          label="Justify Text"
          value={settings.textAlignment === 'justify'}
          onValueChange={v => updateSettings({ textAlignment: v ? 'justify' : 'left' })}
          type="toggle"
        />

        <View style={styles.settingGroup}>
          <Text style={[styles.groupLabel, { color: theme.textColor }]}>Margin Size</Text>
          <View style={styles.buttonRow}>
            {['small', 'medium', 'large'].map(size => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.sizeButton,
                  settings.marginSize === size && { backgroundColor: '#4A90E2' },
                ]}
                onPress={() => updateSettings({ marginSize: size as any })}
              >
                <Text style={styles.buttonText}>{size.charAt(0).toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Display Settings */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>🌟 Display</Text>

        <SettingRow
          label="Auto Brightness"
          value={settings.autoBrightnessEnabled}
          onValueChange={v => updateSettings({ autoBrightnessEnabled: v })}
          type="toggle"
        />

        {!settings.autoBrightnessEnabled && (
          <View style={styles.settingGroup}>
            <Text style={[styles.groupLabel, { color: theme.textColor }]}>
              Brightness: {Math.round(settings.brightness * 100)}%
            </Text>
            <View style={styles.brightnessButtons}>
              {[0.3, 0.5, 0.7, 1].map(brightness => (
                <TouchableOpacity
                  key={brightness}
                  style={[
                    styles.brightnessButton,
                    Math.abs(settings.brightness - brightness) < 0.05 && { backgroundColor: '#4A90E2' },
                  ]}
                  onPress={() => updateSettings({ brightness })}
                >
                  <Text style={styles.buttonText}>{Math.round(brightness * 100)}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.settingGroup}>
          <Text style={[styles.groupLabel, { color: theme.textColor }]}>Page Mode</Text>
          <View style={styles.buttonRow}>
            {['scroll', 'paginated'].map(mode => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.modeButton,
                  settings.pageMode === mode && { backgroundColor: '#4A90E2' },
                ]}
                onPress={() => updateSettings({ pageMode: mode as any })}
              >
                <Text style={styles.buttonText}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* TTS Settings */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>🎤 Text-to-Speech</Text>

        <Text style={[styles.helpText, { color: theme.textColor }]}>
          Configure your Google Cloud TTS API key for high-quality voice synthesis
        </Text>

        <View style={styles.settingGroup}>
          <TextInput
            style={[
              styles.apiKeyInput,
              {
                backgroundColor: theme.selectionColor,
                color: theme.textColor,
                borderColor: theme.accentColor,
              },
            ]}
            placeholder="Paste Google Cloud API key"
            placeholderTextColor={theme.accentColor}
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry={!showApiKey}
            multiline
          />
          <TouchableOpacity onPress={() => setShowApiKey(!showApiKey)} style={styles.toggleButton}>
            <Text style={styles.toggleIcon}>{showApiKey ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#4A90E2' }]} onPress={handleSaveApiKey}>
          <Text style={styles.saveButtonText}>Save API Key</Text>
        </TouchableOpacity>

        <View style={styles.settingGroup}>
          <Text style={[styles.groupLabel, { color: theme.textColor }]}>Voice Pitch: {settings.ttsVoicePitch.toFixed(1)}</Text>
          <View style={styles.buttonRow}>
            {[0.8, 0.9, 1.0, 1.1, 1.2].map(pitch => (
              <TouchableOpacity
                key={pitch}
                style={[
                  styles.sizeButton,
                  Math.abs(settings.ttsVoicePitch - pitch) < 0.05 && { backgroundColor: '#4A90E2' },
                ]}
                onPress={() => updateSettings({ ttsVoicePitch: pitch })}
              >
                <Text style={styles.buttonText}>{pitch.toFixed(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingGroup}>
          <Text style={[styles.groupLabel, { color: theme.textColor }]}>Speaking Rate: {settings.ttsVoiceRate.toFixed(1)}x</Text>
          <View style={styles.buttonRow}>
            {[0.8, 0.9, 1.0, 1.1, 1.2, 1.3].map(rate => (
              <TouchableOpacity
                key={rate}
                style={[
                  styles.sizeButton,
                  Math.abs(settings.ttsVoiceRate - rate) < 0.05 && { backgroundColor: '#4A90E2' },
                ]}
                onPress={() => updateSettings({ ttsVoiceRate: rate })}
              >
                <Text style={styles.buttonText}>{rate.toFixed(1)}x</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <SettingRow
          label="Use Neural Voices"
          value={settings.enableTTS}
          onValueChange={v => updateSettings({ enableTTS: v })}
          type="toggle"
        />

        <Text style={[styles.helpText, { color: theme.textColor, marginTop: 12 }]}>
          💡 Get your free API key:{'\n'}1. Go to console.cloud.google.com{'\n'}2. Create a project{'\n'}3. Enable "Cloud Text-to-Speech API"{'\n'}4. Create an API key
        </Text>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>ℹ️ About</Text>
        <Text style={[styles.aboutText, { color: theme.textColor }]}>
          Book Voice Reader Pro v2.0{'\n'}
          Premium ebook reader with TTS, annotations, and advanced features{'\n\n'}
          © 2024. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  settingGroup: { marginBottom: 16 },
  groupLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingLabel: { fontSize: 14 },
  settingValue: { fontSize: 12, fontWeight: '600' },
  themeButtons: { flexDirection: 'row', gap: 8 },
  themeButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  themeButtonText: { fontSize: 12, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  sizeButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  brightnessButtons: { flexDirection: 'row', gap: 8 },
  brightnessButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    alignItems: 'center',
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    alignItems: 'center',
  },
  apiKeyInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    marginBottom: 8,
  },
  toggleButton: { position: 'absolute', right: 10, top: 10 },
  toggleIcon: { fontSize: 20 },
  saveButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonText: { color: '#fff', fontWeight: '600' },
  helpText: { fontSize: 12, lineHeight: 18, marginBottom: 8 },
  aboutText: { fontSize: 13, lineHeight: 20 },
});
