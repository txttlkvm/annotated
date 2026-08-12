"""Convert each book{N}.vtt (phrase-level karaoke alignment) into a compact
JSON cue array [{s, e, t, p}, ...] (start/end seconds, text, paragraph
index) for the app to consume as static assets.

`p` is the WITHIN-CHAPTER paragraph index (0-based) the cue falls in, in
build/iliad-text/book{N}.txt (paragraph-preserving extraction) -- computed
by sequentially locating each cue's text in the paragraph-joined flat text,
since both were derived from the same underlying <p> extraction and should
line up as exact substrings. Cues that can't be located keep the previous
cue's `p` (best-effort: a transcription/alignment quirk on one phrase
shouldn't break the whole book's sync, just that one highlight's paragraph
placement).
"""
import json
import os
import re

VTT_DIR = (
    r"C:\Users\Rep\Downloads\The Iliad - Homer Homer, Richmond Lattimore "
    r"[1603690263]\karaoke_build"
)
TEXT_DIR = r"C:\Users\Rep\annotated\build\iliad-text"
OUT_DIR = r"C:\Users\Rep\annotated\build\iliad-cues"

TS_RE = re.compile(r"(\d+):(\d+):(\d+)\.(\d+)")


def ts_to_seconds(ts, book_offset):
    h, m, s, ms = TS_RE.match(ts).groups()
    total = int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0
    return round(total - book_offset, 3)


def parse_vtt(path):
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()

    cues = []
    i = 0
    book_offset = None
    while i < len(lines):
        line = lines[i]
        if "-->" in line:
            start_ts, end_ts = [p.strip() for p in line.split("-->")]
            if book_offset is None:
                h, m, s, ms = TS_RE.match(start_ts).groups()
                book_offset = int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0
            text_lines = []
            i += 1
            while i < len(lines) and lines[i].strip():
                text_lines.append(lines[i].strip())
                i += 1
            cues.append(
                {
                    "s": ts_to_seconds(start_ts, book_offset),
                    "e": ts_to_seconds(end_ts, book_offset),
                    "t": " ".join(text_lines),
                }
            )
        i += 1
    return cues


def normalize(s):
    # Mirror GutenbergService.parse()'s block normalization closely enough
    # for substring matching: collapse whitespace, drop characters that
    # routinely differ between the ASR/alignment text and the epub source
    # (curly vs straight quotes, em-dashes) rather than trying to keep them
    # in lockstep.
    s = re.sub(r"\s+", " ", s)
    s = s.replace("\u2019", "'").replace("\u2018", "'")
    s = s.replace("\u201c", '"').replace("\u201d", '"')
    s = s.replace("\u2014", "-").replace("\u2013", "-")
    return s.strip()


def assign_paragraphs(cues, paragraphs):
    flat_parts = [normalize(p) for p in paragraphs]
    starts = []
    pos = 0
    for part in flat_parts:
        starts.append(pos)
        pos += len(part) + 1  # +1 for the joining space
    flat = " ".join(flat_parts)

    search_from = 0
    last_p = 0
    matched = 0
    for cue in cues:
        needle = normalize(cue["t"])
        idx = flat.find(needle, search_from)
        if idx == -1:
            # Retry from the start of the last matched paragraph -- a cue
            # occasionally starts a little before/after search_from due to
            # phrase-boundary trimming differences.
            idx = flat.find(needle, max(0, search_from - 200))
        if idx == -1:
            cue["p"] = last_p
            continue
        matched += 1
        # Binary-search-free: walk paragraph starts (few hundred, cheap).
        p_idx = last_p
        for j in range(len(starts)):
            if starts[j] <= idx:
                p_idx = j
            else:
                break
        cue["p"] = p_idx
        last_p = p_idx
        search_from = idx + len(needle)
    return matched, len(cues)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for n in range(1, 25):
        vtt_path = os.path.join(VTT_DIR, f"book{n:02d}.vtt")
        text_path = os.path.join(TEXT_DIR, f"book{n:02d}.txt")
        if not os.path.exists(vtt_path) or not os.path.exists(text_path):
            print(f"[book{n:02d}] MISSING input")
            continue

        cues = parse_vtt(vtt_path)
        with open(text_path, encoding="utf-8") as f:
            paragraphs = [p for p in f.read().split("\n\n") if p.strip()]

        matched, total = assign_paragraphs(cues, paragraphs)

        out_path = os.path.join(OUT_DIR, f"book{n:02d}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(cues, f, ensure_ascii=False, separators=(",", ":"))
        pct = 100 * matched / total if total else 0
        print(f"[book{n:02d}] {total} cues, {matched} matched ({pct:.1f}%), {len(paragraphs)} paragraphs -> {out_path}")


if __name__ == "__main__":
    main()
