// GENERATED — do not edit by hand.
// Maps classicalLibrary entry id -> Project Gutenberg edition.
//
// Only high-confidence matches are included: the title must overlap >=60% by
// significant word, the author must share a surname, and non-English editions
// are excluded. Entries absent from this map render the designed fallback
// cover instead of a wrong book.
//
// 51 of 113 catalog entries resolved.

import { classicalLibrary } from './classicalLibrary';
import { wikimediaArtwork, wikimediaComposerPortraits } from './publicDomainSources';

export interface GutenbergRef {
  gutenbergId: number;
  coverUrl: string;
  textUrl: string | null;
}

export const gutenbergIds: Record<string, GutenbergRef> = {
  'scripture-bible': { gutenbergId: 10, coverUrl: 'https://www.gutenberg.org/cache/epub/10/pg10.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/10.txt.utf-8' },
  'lit-homer-iliad': { gutenbergId: 6130, coverUrl: 'https://www.gutenberg.org/cache/epub/6130/pg6130.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/6130.txt.utf-8' },
  'lit-homer-odyssey': { gutenbergId: 1727, coverUrl: 'https://www.gutenberg.org/cache/epub/1727/pg1727.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/1727.txt.utf-8' },
  'lit-dante-divine-comedy': { gutenbergId: 8800, coverUrl: 'https://www.gutenberg.org/cache/epub/8800/pg8800.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/8800.txt.utf-8' },
  'lit-foxe-book-of-martyrs': { gutenbergId: 22400, coverUrl: 'https://www.gutenberg.org/cache/epub/22400/pg22400.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/22400.txt.utf-8' },
  'lit-bunyan-pilgrims-progress': { gutenbergId: 131, coverUrl: 'https://www.gutenberg.org/cache/epub/131/pg131.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/131.txt.utf-8' },
  'lit-shakespeare-hamlet': { gutenbergId: 27761, coverUrl: 'https://www.gutenberg.org/cache/epub/27761/pg27761.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/27761.txt.utf-8' },
  'lit-chesterton-man-thursday': { gutenbergId: 1695, coverUrl: 'https://www.gutenberg.org/cache/epub/1695/pg1695.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/1695.txt.utf-8' },
  'phil-plato-republic': { gutenbergId: 55201, coverUrl: 'https://www.gutenberg.org/cache/epub/55201/pg55201.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/55201.txt.utf-8' },
  'phil-aristotle-ethics': { gutenbergId: 8438, coverUrl: 'https://www.gutenberg.org/cache/epub/8438/pg8438.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/8438.txt.utf-8' },
  'phil-aristotle-politics': { gutenbergId: 6762, coverUrl: 'https://www.gutenberg.org/cache/epub/6762/pg6762.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/6762.txt.utf-8' },
  'phil-augustine-confessions': { gutenbergId: 3296, coverUrl: 'https://www.gutenberg.org/cache/epub/3296/pg3296.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/3296.txt.utf-8' },
  'phil-augustine-city-of-god': { gutenbergId: 45304, coverUrl: 'https://www.gutenberg.org/cache/epub/45304/pg45304.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/45304.txt.utf-8' },
  'phil-descartes-meditations': { gutenbergId: 70091, coverUrl: 'https://www.gutenberg.org/cache/epub/70091/pg70091.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/70091.txt.utf-8' },
  'phil-kant-critique': { gutenbergId: 4280, coverUrl: 'https://www.gutenberg.org/cache/epub/4280/pg4280.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/4280.txt.utf-8' },
  'hist-thucydides-war': { gutenbergId: 7142, coverUrl: 'https://www.gutenberg.org/cache/epub/7142/pg7142.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/7142.txt.utf-8' },
  'hist-locke-second-treatise': { gutenbergId: 7370, coverUrl: 'https://www.gutenberg.org/cache/epub/7370/pg7370.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/7370.txt.utf-8' },
  'hist-federalist-papers': { gutenbergId: 22788, coverUrl: 'https://www.gutenberg.org/cache/epub/22788/pg22788.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/files/22788/22788-readme.txt' },
  'bio-washington-george': { gutenbergId: 18592, coverUrl: 'https://www.gutenberg.org/cache/epub/18592/pg18592.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/18592.txt.utf-8' },
  'bio-lincoln-abraham': { gutenbergId: 22925, coverUrl: 'https://www.gutenberg.org/cache/epub/22925/pg22925.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/22925.txt.utf-8' },
  'bio-washington-carver-george': { gutenbergId: 61104, coverUrl: 'https://www.gutenberg.org/cache/epub/61104/pg61104.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/61104.txt.utf-8' },
  'bio-washington-booker-t': { gutenbergId: 24627, coverUrl: 'https://www.gutenberg.org/cache/epub/24627/pg24627.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/24627.txt.utf-8' },
  'bio-edwards-jonathan': { gutenbergId: 34632, coverUrl: 'https://www.gutenberg.org/cache/epub/34632/pg34632.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/34632.txt.utf-8' },
  'lit-beowulf': { gutenbergId: 16328, coverUrl: 'https://www.gutenberg.org/cache/epub/16328/pg16328.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/16328.txt.utf-8' },
  'lit-malory-morte': { gutenbergId: 1251, coverUrl: 'https://www.gutenberg.org/cache/epub/1251/pg1251.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/1251.txt.utf-8' },
  'lit-malory-gawain': { gutenbergId: 66084, coverUrl: 'https://www.gutenberg.org/cache/epub/66084/pg66084.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/66084.txt.utf-8' },
  'lit-grimm-fairy-tales': { gutenbergId: 52521, coverUrl: 'https://www.gutenberg.org/cache/epub/52521/pg52521.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/52521.txt.utf-8' },
  'hist-gibbon-decline-fall': { gutenbergId: 25717, coverUrl: 'https://www.gutenberg.org/cache/epub/25717/pg25717.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/25717.txt.utf-8' },
  'hist-machiavelli-prince': { gutenbergId: 1232, coverUrl: 'https://www.gutenberg.org/cache/epub/1232/pg1232.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/1232.txt.utf-8' },
  'hist-hobbes-leviathan': { gutenbergId: 3207, coverUrl: 'https://www.gutenberg.org/cache/epub/3207/pg3207.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/3207.txt.utf-8' },
  'hist-tocqueville-democracy': { gutenbergId: 815, coverUrl: 'https://www.gutenberg.org/cache/epub/815/pg815.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/815.txt.utf-8' },
  'hist-lincoln-gettysburg': { gutenbergId: 4, coverUrl: 'https://www.gutenberg.org/cache/epub/4/pg4.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/4.txt.utf-8' },
  'hist-lincoln-second-inaugural': { gutenbergId: 8, coverUrl: 'https://www.gutenberg.org/cache/epub/8/pg8.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/8.txt.utf-8' },
  'hist-addison-cato': { gutenbergId: 31592, coverUrl: 'https://www.gutenberg.org/cache/epub/31592/pg31592.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/31592.txt.utf-8' },
  'phil-smith-wealth-of-nations': { gutenbergId: 3300, coverUrl: 'https://www.gutenberg.org/cache/epub/3300/pg3300.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/3300.txt.utf-8' },
  'phil-belloc-servile-state': { gutenbergId: 64882, coverUrl: 'https://www.gutenberg.org/cache/epub/64882/pg64882.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/64882.txt.utf-8' },
  'sci-newton-principia': { gutenbergId: 28233, coverUrl: 'https://www.gutenberg.org/cache/epub/28233/pg28233.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/28233.txt.utf-8' },
  'sci-darwin-origin': { gutenbergId: 1228, coverUrl: 'https://www.gutenberg.org/cache/epub/1228/pg1228.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/1228.txt.utf-8' },
  'phil-chesterton-orthodoxy': { gutenbergId: 16769, coverUrl: 'https://www.gutenberg.org/cache/epub/16769/pg16769.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/16769.txt.utf-8' },
  'law-blackstone-commentaries': { gutenbergId: 30802, coverUrl: 'https://www.gutenberg.org/cache/epub/30802/pg30802.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/30802.txt.utf-8' },
  'mil-clausewitz-war': { gutenbergId: 1946, coverUrl: 'https://www.gutenberg.org/cache/epub/1946/pg1946.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/1946.txt.utf-8' },
  'arch-vitruvius': { gutenbergId: 51812, coverUrl: 'https://www.gutenberg.org/cache/epub/51812/pg51812.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/51812.txt.utf-8' },
  'lang-vulgate': { gutenbergId: 10, coverUrl: 'https://www.gutenberg.org/cache/epub/10/pg10.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/10.txt.utf-8' },
  'lang-augustine-confessions-latin': { gutenbergId: 3296, coverUrl: 'https://www.gutenberg.org/cache/epub/3296/pg3296.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/3296.txt.utf-8' },
  'lang-greek-nt': { gutenbergId: 10, coverUrl: 'https://www.gutenberg.org/cache/epub/10/pg10.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/10.txt.utf-8' },
  'lang-hebrew-tanakh': { gutenbergId: 10, coverUrl: 'https://www.gutenberg.org/cache/epub/10/pg10.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/10.txt.utf-8' },
  'supp-proverbs-31': { gutenbergId: 10, coverUrl: 'https://www.gutenberg.org/cache/epub/10/pg10.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/10.txt.utf-8' },
  'supp-genesis-ephesians': { gutenbergId: 10, coverUrl: 'https://www.gutenberg.org/cache/epub/10/pg10.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/10.txt.utf-8' },
  'mem-kipling-if': { gutenbergId: 23967, coverUrl: 'https://www.gutenberg.org/cache/epub/23967/pg23967.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/files/23967/23967-readme.txt' },
  'mem-psalms-family-melodies': { gutenbergId: 10, coverUrl: 'https://www.gutenberg.org/cache/epub/10/pg10.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/10.txt.utf-8' },
  'mem-gospel-structure': { gutenbergId: 10, coverUrl: 'https://www.gutenberg.org/cache/epub/10/pg10.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/10.txt.utf-8' },
};

// Only used for the two cover sources that resolve synchronously with no
// network call (a live Open Library lookup, the third step of
// resolveCatalogCover in AppContext.tsx, needs an actual request and so
// only ever runs once an item is added to the library -- Catalog/Curriculum
// browse cards render many items at once and need an instant answer).
// Built once per module load, not per coverFor() call.
const ART_TITLE_BY_ID: Map<string, string> = (() => {
  const index = new Map<string, string>();
  for (const item of classicalLibrary) {
    if (item.type === 'art') index.set(item.id, item.title);
  }
  return index;
})();

/** Cover image for a catalog entry, or undefined to use the fallback.
 * Mirrors the first three steps of resolveCatalogCover (AppContext.tsx) --
 * everything synchronous, since this powers the Catalog/Curriculum browse
 * cards rendered before an item is ever added to the library, where the
 * fourth step (a live Open Library search) isn't an option. */
export function coverFor(itemId: string): string | undefined {
  const gutenberg = gutenbergIds[itemId]?.coverUrl;
  if (gutenberg) return gutenberg;
  const artTitle = ART_TITLE_BY_ID.get(itemId);
  if (artTitle) {
    const art = wikimediaArtwork[artTitle];
    if (art) return art;
  }
  return wikimediaComposerPortraits[itemId];
}

/** Plain-text URL for a catalog entry, or null if we have no edition. */
export function textUrlFor(itemId: string): string | null {
  return gutenbergIds[itemId]?.textUrl ?? null;
}
