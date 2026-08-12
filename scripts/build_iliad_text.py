"""Concatenate the 24 paragraph-preserving book{N}.txt files into one plain-
text file with "BOOK <roman>." chapter headings GutenbergService.parse()'s
chapterPattern already recognizes -- so the existing chapter/pagination
pipeline works on this text with zero changes.
"""
import os

TEXT_DIR = r"C:\Users\Rep\annotated\build\iliad-text"
OUT_PATH = r"C:\Users\Rep\annotated\build\iliad-lattimore.txt"

ROMAN = [
    "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
    "XXI", "XXII", "XXIII", "XXIV",
]

if __name__ == "__main__":
    parts = []
    for n in range(1, 25):
        path = os.path.join(TEXT_DIR, f"book{n:02d}.txt")
        with open(path, encoding="utf-8") as f:
            body = f.read().strip()
        parts.append(f"BOOK {ROMAN[n - 1]}.\n\n{body}")

    full = "\n\n\n".join(parts)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(full)
    print(f"{len(full)} chars -> {OUT_PATH}")
