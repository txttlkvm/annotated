import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { useApp } from '../context/AppContext';

import { Alert } from '../components/Alert';
interface ArtState {
  isLoading: boolean;
  error: string | null;
  dimensions: { width: number; height: number };
  scale: number;
}

export default function ArtViewerScreen({ route, navigation }: any) {
  const { sourceUrl, imagePath, title, artist } = route.params;
  const { settings } = useApp();
  // A remote https:// image loads directly — nothing to download, nothing
  // that needs a native file-system. imagePath (file://) is the legacy path,
  // kept only for whatever still passes it.
  const imageUri = sourceUrl || (imagePath ? `file://${imagePath}` : null);

  const [state, setState] = useState<ArtState>({
    isLoading: true,
    error: null,
    dimensions: { width: 0, height: 0 },
    scale: 1,
  });

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    loadImage();
  }, []);

  const loadImage = () => {
    if (!imageUri) {
      setState((prev) => ({
        ...prev,
        error: 'No image source is available for this piece yet.',
        isLoading: false,
      }));
      return;
    }
    Image.getSize(
      imageUri,
      (width, height) => {
        setState((prev) => ({
          ...prev,
          dimensions: { width, height },
          isLoading: false,
        }));
      },
      () => {
        setState((prev) => ({
          ...prev,
          error: 'Could not load this image.',
          isLoading: false,
        }));
      }
    );
  };

  const handleZoomIn = () => {
    setState((prev) => ({
      ...prev,
      scale: Math.min(prev.scale + 0.5, 3),
    }));
  };

  const handleZoomOut = () => {
    setState((prev) => ({
      ...prev,
      scale: Math.max(prev.scale - 0.5, 1),
    }));
  };

  const handleReset = () => {
    setState((prev) => ({
      ...prev,
      scale: 1,
    }));
  };

  const bgColor = settings.theme === 'light' ? '#f5f5f5' : '#0f0a1a';
  const textColor = settings.theme === 'light' ? '#333' : '#c9a961';
  const secondaryColor = settings.theme === 'light' ? '#666' : '#8b7355';
  const accentColor = settings.theme === 'light' ? '#e0e0e0' : '#2d1b4e';
  const borderColor = settings.theme === 'light' ? '#ddd' : '#c9a961';

  // Calculate scaled dimensions
  const scaledWidth = state.dimensions.width * state.scale;
  const scaledHeight = state.dimensions.height * state.scale;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: textColor }]}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.viewerContainer}
        scrollEnabled={state.scale > 1}
        maximumZoomScale={3}
        minimumZoomScale={1}
      >
        {state.error ? (
          <View style={[styles.errorContainer, { justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={[styles.errorText, { color: '#c67c7c' }]}>{state.error}</Text>
          </View>
        ) : state.isLoading ? (
          <View style={[styles.loadingContainer, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={textColor} />
          </View>
        ) : (
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: imageUri as string }}
              style={{
                width: Math.min(scaledWidth, screenWidth - 32),
                height: Math.min(
                  scaledHeight,
                  screenHeight - 200
                ),
                resizeMode: 'contain',
              }}
            />
          </View>
        )}
      </ScrollView>

      {/* Info and Controls */}
      {!state.isLoading && !state.error && (
        <>
          {/* Metadata */}
          <View style={[styles.metadataSection, { backgroundColor: accentColor, borderTopColor: borderColor }]}>
            <Text style={[styles.title, { color: textColor }]}>{title}</Text>
            <Text style={[styles.artist, { color: secondaryColor }]}>{artist}</Text>
          </View>

          {/* Study Guide */}
          <View style={[styles.studyGuide, { backgroundColor: accentColor, borderColor: borderColor }]}>
            <Text style={[styles.studyTitle, { color: textColor }]}>— Study Guide —</Text>
            <Text style={[styles.studyText, { color: secondaryColor }]}>
              Examine this artwork in depth. Notice the composition, use of color and light, symbolic elements, and historical significance. Take time to reflect on its beauty and meaning.
            </Text>
          </View>

          {/* Controls */}
          <View style={[styles.controlsSection, { borderTopColor: borderColor }]}>
            <TouchableOpacity
              style={[styles.controlButton, { borderColor: secondaryColor }]}
              onPress={handleZoomOut}
              disabled={state.scale <= 1}
            >
              <Text style={[styles.controlLabel, { color: state.scale <= 1 ? secondaryColor : textColor }]}>
                −
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, { borderColor: secondaryColor }]}
              onPress={handleReset}
            >
              <Text style={[styles.controlLabel, { color: textColor }]}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, { borderColor: secondaryColor }]}
              onPress={handleZoomIn}
              disabled={state.scale >= 3}
            >
              <Text style={[styles.controlLabel, { color: state.scale >= 3 ? secondaryColor : textColor }]}>
                +
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  backButton: { fontSize: 15, fontWeight: '400', letterSpacing: 1 },
  viewerContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  imageWrapper: { justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { flex: 1 },
  errorContainer: { flex: 1 },
  errorText: { fontSize: 12, letterSpacing: 0.5 },
  metadataSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '400', fontFamily: 'Georgia', letterSpacing: 1, marginBottom: 2 },
  artist: { fontSize: 12, letterSpacing: 0.5 },
  studyGuide: {
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 12,
    borderRadius: 2,
    borderLeftWidth: 2,
    borderWidth: 1,
  },
  studyTitle: { fontSize: 11, fontWeight: '400', fontFamily: 'Georgia', letterSpacing: 2, marginBottom: 6 },
  studyText: { fontSize: 10, lineHeight: 14, letterSpacing: 0.5 },
  controlsSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  controlButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 2,
    borderWidth: 1,
  },
  controlLabel: { fontSize: 16, fontWeight: '400', letterSpacing: 1 },
});
