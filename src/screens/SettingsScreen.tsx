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
      <View style={[styles.settingRow, { borderBottomColor: '#8b7355' }]}>
        <Text style={[styles.settingLabel, { color: '#c9a961' }]}>{label}</Text>
        {type === 'toggle' && (
          <Switch
            value={value}
            onValueChange={onValueChange}
            trackColor={{ false: '#3d3730', true: '#8b7355' }}
            thumbColor="#c9a961"
          />
        )}
        {type === 'text' && (
          <Text style={[styles.settingValue, { color: '#8b7355' }]}>{value}</Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: '#0f0a1a' }]}
      contentContainerStyle={styles.content}
    >
      {/* Reader Settings */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: '#c9a961' }]}>✦ Reader Settings</Text>

        <View style={styles.settingGroup}>
          <Text style={[styles.groupLabel, { color: '#c9a961' }]}>Theme</Text>
          <View style={styles.themeButtons}>
            {Object.keys(READER_THEMES).map(themeName => (
              <TouchableOpacity
                key={themeName}
                style={[
                  styles.themeButton,
                  settings.theme === themeName && { borderColor: '#c9a961', borderWidth: 2 },
                ]}
                onPress={() => updateSettings({ theme: themeName as any })}
              >
                <Text style={[styles.themeButtonText, { color: '#c9a961' }]}>
                  {themeName.charAt(0).toUpperCase() + themeName.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingGroup}>
          <Text style={[styles.groupLabel, { color: '#c9a961' }]}>Font Size: {settings.fontSize}px</Text>
          <View style={styles.buttonRow}>
            {[14, 16, 18, 20, 22, 24].map(size => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.sizeButton,
                  settings.fontSize === size && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' },
                ]}
                onPress={() => updateSettings({ fontSize: size })}
              >
                <Text style={[styles.buttonText, { color: '#c9a961' }]}>{size}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingGroup}>
          <Text style={[styles.groupLabel, { color: '#c9a961' }]}>Line Height: {settings.lineHeight.toFixed(1)}</Text>
          <View style={styles.buttonRow}>
            {[1.3, 1.5, 1.7, 1.9, 2.1].map(height => (
              <TouchableOpacity
                key={height}
                style={[
                  styles.sizeButton,
                  Math.abs(settings.lineHeight - height) < 0.05 && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' },
                ]}
                onPress={() => updateSettings({ lineHeight: height })}
              >
                <Text style={[styles.buttonText, { color: '#c9a961' }]}>{height.toFixed(1)}</Text>
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
          <Text style={[styles.groupLabel, { color: '#c9a961' }]}>Margin Size</Text>
          <View style={styles.buttonRow}>
            {['small', 'medium', 'large'].map(size => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.sizeButton,
                  settings.marginSize === size && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' },
                ]}
                onPress={() => updateSettings({ marginSize: size as any })}
              >
                <Text style={[styles.buttonText, { color: '#c9a961' }]}>{size.charAt(0).toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Display Settings */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: '#c9a961' }]}>✦ Display</Text>

        <SettingRow
          label="Auto Brightness"
          value={settings.autoBrightnessEnabled}
          onValueChange={v => updateSettings({ autoBrightnessEnabled: v })}
          type="toggle"
        />

        {!settings.autoBrightnessEnabled && (
          <View style={styles.settingGroup}>
            <Text style={[styles.groupLabel, { color: '#c9a961' }]}>
              Brightness: {Math.round(settings.brightness * 100)}%
            </Text>
            <View style={styles.brightnessButtons}>
              {[0.3, 0.5, 0.7, 1].map(brightness => (
                <TouchableOpacity
                  key={brightness}
                  style={[
                    styles.brightnessButton,
                    Math.abs(settings.brightness - brightness) < 0.05 && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' },
                  ]}
                  onPress={() => updateSettings({ brightness })}
                >
                  <Text style={[styles.buttonText, { color: '#c9a961' }]}>{Math.round(brightness * 100)}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.settingGroup}>
          <Text style={[styles.groupLabel, { color: '#c9a961' }]}>Page Mode</Text>
          <View style={styles.buttonRow}>
            {['scroll', 'paginated'].map(mode => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.modeButton,
                  settings.pageMode === mode && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' },
                ]}
                onPress={() => updateSettings({ pageMode: mode as any })}
              >
                <Text style={[styles.buttonText, { color: '#c9a961' }]}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* TTS Settings */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: '#c9a961' }]}>✦ Voice Synthesis</Text>

        <Text style={[styles.helpText, { color: '#8b7355' }]}>
          Configure your Google Cloud TTS API key for high-quality voice synthesis
        </Text>

        <View style={styles.settingGroup}>
          <TextInput
            style={[
              styles.apiKeyInput,
              {
                backgroundColor: '#2d1b4e',
                color: '#c9a961',
                borderColor: '#8b7355',
              },
            ]}
            placeholder="Paste Google Cloud API key"
            placeholderTextColor="#8b7355"
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry={!showApiKey}
            multiline
          />
          <TouchableOpacity onPress={() => setShowApiKey(!showApiKey)} style={styles.toggleButton}>
            <Text style={styles.toggleIcon}>{showApiKey ? '✦' : '◯'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#2d1b4e', borderColor: '#c9a961' }]} onPress={handleSaveApiKey}>
          <Text style={[styles.saveButtonText, { color: '#c9a961' }]}>Save API Key</Text>
        </TouchableOpacity>

        <View style={styles.settingGroup}>
          <Text style={[styles.groupLabel, { color: '#c9a961' }]}>Voice Pitch: {settings.ttsVoicePitch.toFixed(1)}</Text>
          <View style={styles.buttonRow}>
            {[0.8, 0.9, 1.0, 1.1, 1.2].map(pitch => (
              <TouchableOpacity
                key={pitch}
                style={[
                  styles.sizeButton,
                  Math.abs(settings.ttsVoicePitch - pitch) < 0.05 && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' },
                ]}
                onPress={() => updateSettings({ ttsVoicePitch: pitch })}
              >
                <Text style={[styles.buttonText, { color: '#c9a961' }]}>{pitch.toFixed(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingGroup}>
          <Text style={[styles.groupLabel, { color: '#c9a961' }]}>Speaking Rate: {settings.ttsVoiceRate.toFixed(1)}x</Text>
          <View style={styles.buttonRow}>
            {[0.8, 0.9, 1.0, 1.1, 1.2, 1.3].map(rate => (
              <TouchableOpacity
                key={rate}
                style={[
                  styles.sizeButton,
                  Math.abs(settings.ttsVoiceRate - rate) < 0.05 && { backgroundColor: '#2d1b4e', borderColor: '#c9a961' },
                ]}
                onPress={() => updateSettings({ ttsVoiceRate: rate })}
              >
                <Text style={[styles.buttonText, { color: '#c9a961' }]}>{rate.toFixed(1)}x</Text>
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

        <Text style={[styles.helpText, { color: '#8b7355', marginTop: 12 }]}>
          ✦ Get your free API key:{'\n'}1. Go to console.cloud.google.com{'\n'}2. Create a project{'\n'}3. Enable "Cloud Text-to-Speech API"{'\n'}4. Create an API key
        </Text>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: '#c9a961' }]}>✦ About</Text>
        <Text style={[styles.aboutText, { color: '#8b7355' }]}>
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
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#3d3730' },
  sectionTitle: { fontSize: 16, fontWeight: '400', marginBottom: 12, letterSpacing: 2, fontFamily: 'Georgia' },
  settingGroup: { marginBottom: 16 },
  groupLabel: { fontSize: 12, fontWeight: '400', marginBottom: 8, letterSpacing: 1, fontFamily: 'Georgia' },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingLabel: { fontSize: 13, fontFamily: 'Georgia' },
  settingValue: { fontSize: 11, fontWeight: '400', letterSpacing: 1 },
  themeButtons: { flexDirection: 'row', gap: 8 },
  themeButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#1a1328',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#8b7355',
    alignItems: 'center',
  },
  themeButtonText: { fontSize: 11, fontWeight: '400', letterSpacing: 1 },
  buttonRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  sizeButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 8,
    backgroundColor: '#1a1328',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#8b7355',
    alignItems: 'center',
  },
  buttonText: { fontWeight: '400', fontSize: 11, letterSpacing: 1 },
  brightnessButtons: { flexDirection: 'row', gap: 8 },
  brightnessButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#1a1328',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#8b7355',
    alignItems: 'center',
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#1a1328',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#8b7355',
    alignItems: 'center',
  },
  apiKeyInput: {
    borderWidth: 1,
    borderRadius: 2,
    padding: 10,
    minHeight: 80,
    marginBottom: 8,
    fontFamily: 'Georgia',
  },
  toggleButton: { position: 'absolute', right: 10, top: 10 },
  toggleIcon: { fontSize: 18, fontWeight: '300' },
  saveButton: {
    paddingVertical: 12,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonText: { fontWeight: '400', letterSpacing: 1, fontSize: 12 },
  helpText: { fontSize: 11, lineHeight: 18, marginBottom: 8, fontFamily: 'Georgia' },
  aboutText: { fontSize: 12, lineHeight: 20, fontFamily: 'Georgia' },
});
