#!/usr/bin/env bash
# Slices "The Iliad.m4b" into 24 per-book, compressed (48kbps mono AAC) audio
# files using the same cue-sheet chapter boundaries the karaoke VTT alignment
# already used, so book N's audio here lines up exactly with book{N}.vtt.
set -euo pipefail

SRC_DIR="/c/Users/Rep/Downloads/The Iliad - Homer Homer, Richmond Lattimore [1603690263]"
M4B="The Iliad.m4b"
CUE="The Iliad.cue"
OUT_DIR="/c/Users/Rep/annotated/build/iliad-audio"
mkdir -p "$OUT_DIR"

# The native (WinGet) ffmpeg/ffprobe binaries fail to resolve the source
# path when it's passed as a full POSIX path -- confirmed live, the "[...]"
# in the folder name breaks MSYS's argv path translation for that case
# specifically (cd + a relative filename works fine). cd in rather than
# pass the absolute path to ffmpeg/ffprobe.
cd "$SRC_DIR"

# Parse cue chapter start times (MM:SS:FF, FF = 1/75s frames) into seconds.
mapfile -t STARTS < <(grep -oE 'INDEX 01 [0-9]+:[0-9]+:[0-9]+' "$CUE" | sed 's/INDEX 01 //' | awk -F: '{print $1*60 + $2 + $3/75}')

TOTAL_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$M4B")

for n in $(seq 1 24); do
  out="$OUT_DIR/book$(printf '%02d' "$n").m4a"
  if [ -f "$out" ]; then
    echo "[book$n] already encoded, skipping"
    continue
  fi
  # cue index 0 = front matter, book 1 = cue index 1, ... book 24 = cue index 24
  cue_idx=$n
  start="${STARTS[$cue_idx]}"
  if [ $((cue_idx + 1)) -lt ${#STARTS[@]} ]; then
    end="${STARTS[$((cue_idx + 1))]}"
  else
    end="$TOTAL_DUR"
  fi
  mins=$(awk -v s="$start" -v e="$end" 'BEGIN { printf "%.1f", (e-s)/60 }')
  echo "[book$n] $start -> $end (${mins}min)"
  ffmpeg -y -v error -i "$M4B" -ss "$start" -to "$end" -vn -ac 1 -ar 22050 -c:a aac -b:a 48k "$out"
  echo "[book$n] done: $(du -h "$out" | cut -f1)"
done

echo "ALL DONE"
