import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radius, type, elevation, COVER_RATIO } from '../theme';

interface Props {
  /** Remote cover image. Gutenberg cover JPEGs need no proxy — they load as <img>. */
  uri?: string;
  title: string;
  author?: string;
  itemType?: 'book' | 'music' | 'art' | 'resource';
  /** Rendered width; height derives from the trade-paperback ratio. */
  width: number;
}

const GLYPH: Record<string, string> = {
  music: '♪',
  art: '✎',
  resource: '◆',
  book: '✦',
};

/**
 * Book cover with a designed fallback.
 *
 * Every screen previously rendered a bare sparkle glyph for every item, which
 * is the single biggest reason the library looked unfinished. When a real
 * cover exists we show it; when it doesn't, we draw a typographic book board
 * rather than an icon — a spine rule, the title set in the display serif, and
 * the author beneath.
 */
export default function BookCover({ uri, title, author, itemType = 'book', width }: Props) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(!!uri);

  const height = Math.round(width * COVER_RATIO);
  const showImage = uri && !failed;

  return (
    <View style={[styles.frame, { width, height }, elevation.cover]}>
      {showImage ? (
        <>
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="cover"
            onError={() => {
              setFailed(true);
              setLoading(false);
            }}
            onLoad={() => setLoading(false)}
          />
          {loading && (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={colors.bronze} />
            </View>
          )}
        </>
      ) : (
        <View style={styles.fallback}>
          {/* Spine rule — reads as a book board rather than an empty tile. */}
          <View style={styles.spine} />
          <View style={styles.fallbackBody}>
            <Text
              style={[type.title, styles.fallbackTitle, { fontSize: width < 90 ? 11 : 13 }]}
              numberOfLines={4}
            >
              {title}
            </Text>
            {!!author && (
              <>
                <View style={styles.fallbackRule} />
                <Text style={[type.caption, styles.fallbackAuthor]} numberOfLines={2}>
                  {author}
                </Text>
              </>
            )}
          </View>
          <Text style={styles.glyph}>{GLYPH[itemType] || GLYPH.book}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.board,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: '100%', height: '100%' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.board,
  },
  fallback: { flex: 1, backgroundColor: colors.board, paddingLeft: 10 },
  spine: {
    position: 'absolute',
    left: 4,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.rule,
  },
  fallbackBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  fallbackTitle: { color: colors.gold, textAlign: 'center' },
  fallbackRule: {
    height: 1,
    backgroundColor: colors.rule,
    marginVertical: 6,
    alignSelf: 'center',
    width: '55%',
  },
  fallbackAuthor: { color: colors.bronze, textAlign: 'center' },
  glyph: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    fontSize: 11,
    color: colors.bronze,
    opacity: 0.7,
  },
});
