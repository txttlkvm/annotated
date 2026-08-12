"""Same per-<p> extraction as extract_book_text.py (mirrors it exactly so
paragraph units match what the karaoke alignment was computed against) but
JOINS PARAGRAPHS WITH BLANK LINES instead of collapsing them to one flowing
line -- the original script discards paragraph boundaries entirely, which is
fine for feeding a forced-aligner but useless for an actual reader UI, which
needs real paragraph breaks (GutenbergService.parse() splits chapters back
into paragraphs on blank lines).
"""
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
import re
import sys
import os

LINE_NUM_RE = re.compile(r'^\s*\d{1,4}\s*[\u2010-\u2015\-]*\s*')


def clean_line(text, strip_line_numbers):
    if strip_line_numbers:
        text = LINE_NUM_RE.sub('', text, count=1)
    return text.strip()


def extract_paragraphs(epub_path, item_index, strip_line_numbers=True):
    book = epub.read_epub(epub_path, options={"ignore_ncx": True})
    items = list(book.get_items_of_type(ebooklib.ITEM_DOCUMENT))
    item = items[item_index]
    soup = BeautifulSoup(item.get_content(), "html.parser")

    paras = soup.find_all("p")
    if not paras:
        paras = [soup]

    out = []
    for p in paras:
        t = p.get_text(" ", strip=True)
        t = clean_line(t, strip_line_numbers)
        t = re.sub(r'\s+', ' ', t).strip()
        if t:
            out.append(t)
    return out


EPUB_PATH = (
    r"C:\Users\Rep\Downloads\The Iliad - Homer Homer, Richmond Lattimore "
    r"[1603690263]\The Iliad (University of Chicago) -- Lattimore, Richmond -- "
    r"Chicago, London, Illinois, 2011 -- University of Chicago Press -- "
    r"isbn13 9780226470481 -- 2fd3.epub"
)
OUT_DIR = r"C:\Users\Rep\annotated\build\iliad-text"

if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for n in range(1, 25):
        epub_idx = 7 + n
        paras = extract_paragraphs(EPUB_PATH, epub_idx)
        out_path = os.path.join(OUT_DIR, f"book{n:02d}.txt")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write("\n\n".join(paras))
        print(f"[book{n:02d}] {len(paras)} paragraphs -> {out_path}")
