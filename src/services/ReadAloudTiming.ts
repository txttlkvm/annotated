/**
 * Estimates per-word start/end times within a Read-Aloud chunk from its
 * final audio duration, since Kokoro's synthesize() returns only audio, no
 * timing metadata (evaluated @met4citizen/headtts, which wraps a timestamped
 * Kokoro variant for exactly this -- its browser Worker init hung
 * indefinitely with zero network activity in testing, so pinning to that
 * dependency wasn't worth the unresolved risk for a first version).
 *
 * This is a proportional estimate, not a measured alignment -- unlike a
 * human narrator, however, a fixed-voice/fixed-speed TTS engine paces
 * characters fairly uniformly, so weighting by character count (with extra
 * weight after clause/sentence punctuation, where Kokoro actually pauses)
 * lands close enough for karaoke-style highlighting. Revisit with real
 * per-word timestamps if this proves too imprecise in practice.
 */

export interface WordTiming {
  word: string;
  /** Character offset of this word's first character within the source text. */
  charStart: number;
  /** Character offset one past this word's last character. */
  charEnd: number;
  /** Estimated start time in ms, relative to the start of the audio. */
  timeStart: number;
  /** Estimated end time in ms, relative to the start of the audio. */
  timeEnd: number;
}

const PAUSE_WEIGHT: Record<string, number> = {
  ',': 1.5,
  ';': 2,
  ':': 2,
  '—': 2, // em dash
  '.': 3,
  '!': 3,
  '?': 3,
};

function pauseWeightAfter(word: string): number {
  const lastChar = word.charAt(word.length - 1);
  return PAUSE_WEIGHT[lastChar] ?? 0;
}

export function estimateWordTimings(text: string, durationMs: number): WordTiming[] {
  const matches = [...text.matchAll(/\S+/g)];
  if (!matches.length || durationMs <= 0) return [];

  const weights = matches.map((m) => m[0].length + 1 + pauseWeightAfter(m[0]));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const timings: WordTiming[] = [];
  let cumulativeWeight = 0;
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const timeStart = (cumulativeWeight / totalWeight) * durationMs;
    cumulativeWeight += weights[i];
    const timeEnd = (cumulativeWeight / totalWeight) * durationMs;
    timings.push({
      word: match[0],
      charStart: match.index ?? 0,
      charEnd: (match.index ?? 0) + match[0].length,
      timeStart,
      timeEnd,
    });
  }
  return timings;
}

/** Binary search for the timing entry active at a given playback position. */
export function findActiveWordIndex(timings: WordTiming[], positionMs: number): number {
  if (!timings.length) return -1;
  let lo = 0;
  let hi = timings.length - 1;
  if (positionMs < timings[0].timeStart) return -1;
  if (positionMs >= timings[hi].timeEnd) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (timings[mid].timeStart <= positionMs) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
