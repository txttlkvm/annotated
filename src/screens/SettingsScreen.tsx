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
import * as SecureStore from 'expo-secure-store';
import { useBooks } from '../context/BookContext';
import { TTSService } from '../services/TTSService';

export default function SettingsScreen() {
  const { settings, updateSettings } = useBooks();
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter a valid API key');
      return;
    }

    try {
      await SecureStore.setItemAsync('google_tts_api_key', apiKey);
      TTSService.setConfig({
        apiKey,
        language: settings.voiceLanguage,
        pitch: settings.voicePitch,
        speakingRate: settings.voiceRate,
      });
      Alert.alert('Success', 'API key saved securely');
      setApiKey('');
    } catch (error) {
      Alert.alert('Error', 'Failed to save API key');
      console.error(error);
    }
  };

  const handleFontSizeChange = (size: number) => {
    updateSettings({ fontSize: size });
  };

  const handleVoicePitchChange = (pitch: number) => {
    updateSettings({ voicePitch: pitch });
  };

  const handleSpeakingRateChange = (rate: number) => {
    updateSettings({ voiceRate: rate });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Google Cloud Setup */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔑 Google Cloud TTS Setup</Text>
        <Text style={styles.sectionDescription}>
          Get your free API key from Google Cloud Console to enable high-quality text-to-speech
        </Text>

        <View style={styles.apiKeyContainer}>
          <TextInput
            style={styles.apiKeyInput}
            placeholder="Paste your Google Cloud API key here"
            placeholderTextColor="#666"
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry={!showApiKey}
            multiline
          />
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowApiKey(!showApiKey)}
          >
            <Text style={styles.toggleButtonText}>
              {showApiKey ? '🙈' : '👁'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveApiKey}
        >
          <Text style={styles.saveButtonText}>Save API Key</Text>
        </TouchableOpacity>

        <Text style={styles.helpText}>
          📚 How to get an API key:
          {'\n'}1. Go to console.cloud.google.com
          {'\n'}2. Create a new project
          {'\n'}3. Enable "Cloud Text-to-Speech API"
          {'\n'}4. Create an API key credential
          {'\n'}5. Paste it here
        </Text>
      </View>

      {/* Voice Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎤 Voice Settings</Text>

        {/* Font Size */}
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Font Size: {settings.fontSize}px</Text>
          <View style={styles.sliderContainer}>
            {[14, 16, 18, 20, 22, 24].map(size => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.sizeButton,
                  settings.fontSize === size && styles.sizeButtonActive,
                ]}
                onPress={() => handleFontSizeChange(size)}
              >
                <Text style={styles.sizeButtonText}>{size}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Voice Pitch */}
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>
            Voice Pitch: {settings.voicePitch.toFixed(1)}
          </Text>
          <View style={styles.sliderContainer}>
            {[0.8, 0.9, 1.0, 1.1, 1.2].map(pitch => (
              <TouchableOpacity
                key={pitch}
                style={[
                  styles.pitchButton,
                  Math.abs(settings.voicePitch - pitch) < 0.05 && styles.pitchButtonActive,
                ]}
                onPress={() => handleVoicePitchChange(pitch)}
              >
                <Text style={styles.pitchButtonText}>{pitch.toFixed(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Speaking Rate */}
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>
            Speaking Rate: {settings.voiceRate.toFixed(1)}x
          </Text>
          <View style={styles.sliderContainer}>
            {[0.8, 0.9, 1.0, 1.1, 1.2, 1.3].map(rate => (
              <TouchableOpacity
                key={rate}
                style={[
                  styles.rateButton,
                  Math.abs(settings.voiceRate - rate) < 0.05 && styles.rateButtonActive,
                ]}
                onPress={() => handleSpeakingRateChange(rate)}
              >
                <Text style={styles.rateButtonText}>{rate.toFixed(1)}x</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Neural Voices Toggle */}
        <View style={styles.settingItem}>
          <View style={styles.toggleRow}>
            <Text style={styles.settingLabel}>Use Neural Voices</Text>
            <Switch
              value={settings.useNeuralVoices}
              onValueChange={(value) =>
                updateSettings({ useNeuralVoices: value })
              }
              trackColor={{ false: '#3e3e3e', true: '#4A90E2' }}
              thumbColor="#fff"
            />
          </View>
          <Text style={styles.helperText}>
            Neural voices sound more natural but use more API quota
          </Text>
        </View>
      </View>

      {/* Display Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎨 Display Settings</Text>

        {/* Line Height */}
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>
            Line Height: {settings.lineHeight.toFixed(1)}
          </Text>
          <View style={styles.sliderContainer}>
            {[1.3, 1.5, 1.7, 1.9, 2.1].map(height => (
              <TouchableOpacity
                key={height}
                style={[
                  styles.heightButton,
                  Math.abs(settings.lineHeight - height) < 0.05 && styles.heightButtonActive,
                ]}
                onPress={() => updateSettings({ lineHeight: height })}
              >
                <Text style={styles.heightButtonText}>{height.toFixed(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ℹ️ About</Text>
        <Text style={styles.aboutText}>
          Book Voice Reader v1.0{'\n'}
          High-quality ebook reading with Google Cloud TTS
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    paddingBottom: 32,
  },
  section: {
    borderBottomColor: '#333',
    borderBottomWidth: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 16,
  },
  apiKeyContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  apiKeyInput: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    marginRight: 8,
    minHeight: 80,
  },
  toggleButton: {
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButtonText: {
    fontSize: 20,
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  helpText: {
    fontSize: 12,
    color: '#888',
    lineHeight: 18,
  },
  settingItem: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  sliderContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  sizeButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sizeButtonActive: {
    backgroundColor: '#4A90E2',
  },
  sizeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  pitchButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pitchButtonActive: {
    backgroundColor: '#4A90E2',
  },
  pitchButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  rateButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rateButtonActive: {
    backgroundColor: '#4A90E2',
  },
  rateButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  heightButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heightButtonActive: {
    backgroundColor: '#4A90E2',
  },
  heightButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#888',
  },
  aboutText: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
  },
});
