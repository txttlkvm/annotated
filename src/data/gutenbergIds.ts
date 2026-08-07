// GENERATED — do not edit by hand.
// Maps classicalLibrary entry id -> Project Gutenberg edition.
//
// Only high-confidence matches are included: the title must overlap >=60% by
// significant word, the author must share a surname, and non-English editions
// are excluded. Entries absent from this map render the designed fallback
// cover instead of a wrong book.
//
// 62 of 113 catalog entries resolved (51 by the original generator, 11 more
// added by hand afterward -- see the comment above those entries).

import { classicalLibrary } from './classicalLibrary';
import { wikimediaArtwork, wikimediaComposerPortraits, openLibraryCoverIds } from './publicDomainSources';

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

  // Added by hand, same discipline as the generator: title overlap + author
  // surname match, and every URL below curl-verified (HTTP 200, both the
  // text and cover) before being added, not guessed.
  'lit-chesterton-father-brown': { gutenbergId: 204, coverUrl: 'https://www.gutenberg.org/cache/epub/204/pg204.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/204.txt.utf-8' },
  'bio-plutarch-parallel-lives': { gutenbergId: 674, coverUrl: 'https://www.gutenberg.org/cache/epub/674/pg674.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/674.txt.utf-8' },
  'bio-einhard-charlemagne': { gutenbergId: 48870, coverUrl: 'https://www.gutenberg.org/cache/epub/48870/pg48870.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/48870.txt.utf-8' },
  'lit-sophocles-oedipus': { gutenbergId: 27673, coverUrl: 'https://www.gutenberg.org/cache/epub/27673/pg27673.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/27673.txt.utf-8' },
  // "Key Questions" -- Prima Pars (Part I) is the most commonly excerpted
  // part (includes the Five Ways) and the one usually meant by that phrase.
  'phil-aquinas-summa': { gutenbergId: 17611, coverUrl: 'https://www.gutenberg.org/cache/epub/17611/pg17611.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/17611.txt.utf-8' },
  'lang-cicero-speeches': { gutenbergId: 226, coverUrl: 'https://www.gutenberg.org/cache/epub/226/pg226.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/226.txt.utf-8' },
  'supp-washington-rules-civility': { gutenbergId: 12029, coverUrl: 'https://www.gutenberg.org/cache/epub/12029/pg12029.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/12029.txt.utf-8' },
  'lit-norse-eddas': { gutenbergId: 73533, coverUrl: 'https://www.gutenberg.org/cache/epub/73533/pg73533.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/73533.txt.utf-8' },
  'geo-strabo-geographica': { gutenbergId: 44884, coverUrl: 'https://www.gutenberg.org/cache/epub/44884/pg44884.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/44884.txt.utf-8' },
  // Catalog item covers three sources (Desert Fathers / Bede / Legenda
  // Aurea); Bede's is the one with a real Gutenberg edition.
  'lit-hagiography': { gutenbergId: 38326, coverUrl: 'https://www.gutenberg.org/cache/epub/38326/pg38326.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/38326.txt.utf-8' },
  'supp-baxter-household': { gutenbergId: 41633, coverUrl: 'https://www.gutenberg.org/cache/epub/41633/pg41633.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/41633.txt.utf-8' },
  'supp-quran': { gutenbergId: 2800, coverUrl: 'https://www.gutenberg.org/cache/epub/2800/pg2800.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/2800.txt.utf-8' },

  // These five are short-passage memorization items drawn FROM a work
  // that's already matched above -- pointing them at that same edition (the
  // reader can navigate to the relevant chapter/scene) rather than leaving
  // them sourceless, matching the existing convention just above
  // (mem-psalms-family-melodies etc. already do this against the Bible).
  'mem-ten-commandments': { gutenbergId: 10, coverUrl: 'https://www.gutenberg.org/cache/epub/10/pg10.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/10.txt.utf-8' },
  'mem-beatitudes': { gutenbergId: 10, coverUrl: 'https://www.gutenberg.org/cache/epub/10/pg10.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/10.txt.utf-8' },
  'mem-lords-prayer': { gutenbergId: 10, coverUrl: 'https://www.gutenberg.org/cache/epub/10/pg10.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/10.txt.utf-8' },
  'mem-hamlet-soliloquy': { gutenbergId: 27761, coverUrl: 'https://www.gutenberg.org/cache/epub/27761/pg27761.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/27761.txt.utf-8' },
  'mem-homer-invocation': { gutenbergId: 6130, coverUrl: 'https://www.gutenberg.org/cache/epub/6130/pg6130.cover.medium.jpg', textUrl: 'https://www.gutenberg.org/ebooks/6130.txt.utf-8' },
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

// Hand-curated replacements for covers that are technically "matched" but
// ugly or wrong -- Gutenberg's auto-generated covers are either a blank
// scanned title page or a photo of a plain library binding, not artwork.
// Checked BEFORE the Gutenberg coverUrl in coverFor() below, so these win
// even though a (bad) gutenbergIds cover also exists for the same id.
// Every URL below was downloaded and visually inspected (not just
// HTTP-200-checked) before being added here. Wikimedia thumbnail URLs are
// used exactly as returned by the API's imageinfo/thumburl -- never
// hand-reconstructed with a guessed width, which 404s.
export const curatedCovers: Record<string, string> = {
  // Hamlet -- Millais' "Ophelia" (Google Art Project scan).
  'lit-shakespeare-hamlet': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/John_Everett_Millais_-_Ophelia_-_Google_Art_Project.jpg/960px-John_Everett_Millais_-_Ophelia_-_Google_Art_Project.jpg',
  // Aristotle's Metaphysics -- Louvre marble bust (replaces a "back of a
  // library book" Open Library cover).
  'phil-aristotle-metaphysics': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Aristoteles_Louvre.jpg/960px-Aristoteles_Louvre.jpg',
  // Summa Theologica -- Gozzoli's "Triumph of St Thomas Aquinas".
  'phil-aquinas-summa': 'https://upload.wikimedia.org/wikipedia/commons/2/2d/Benozzo_Gozzoli_-_Triumph_of_St_Thomas_Aquinas_-_WGA10334.jpg',
  // Second Treatise of Government -- Kneller's portrait of Locke.
  'hist-locke-second-treatise': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Godfrey_Kneller_-_Portrait_of_John_Locke_%28Hermitage%29.jpg/960px-Godfrey_Kneller_-_Portrait_of_John_Locke_%28Hermitage%29.jpg',
  // Federalist Papers -- "Scene at the Signing of the Constitution".
  'hist-federalist-papers': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Scene_at_the_Signing_of_the_Constitution_of_the_United_States.jpg/960px-Scene_at_the_Signing_of_the_Constitution_of_the_United_States.jpg',
  // Anti-Federalist Papers -- Rothermel's "Patrick Henry Before the Virginia
  // House of Burgesses" (Henry was the leading Anti-Federalist voice; had no
  // cover or source at all before this).
  'hist-anti-federalist-papers': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Patrick_Henry_Rothermel.jpg/960px-Patrick_Henry_Rothermel.jpg',
  // Washington's Farewell Address -- Gilbert Stuart's Lansdowne portrait.
  'hist-washington-farewell': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Gilbert_Stuart_-_George_Washington_-_Google_Art_Project.jpg/960px-Gilbert_Stuart_-_George_Washington_-_Google_Art_Project.jpg',
  // Republic -- Raphael's "School of Athens".
  'phil-plato-republic': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/The_School_of_Athens_by_Raphael_%28Vatican%29.jpg/960px-The_School_of_Athens_by_Raphael_%28Vatican%29.jpg',
  // Father Brown stories -- no free period cover art exists for this 1911
  // original work; a real studio portrait of Chesterton is a dignified
  // improvement over Gutenberg's blank title page.
  'lit-chesterton-father-brown': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Gilbert_Chesterton.jpg/960px-Gilbert_Chesterton.jpg',
  // The Man Who Was Thursday -- a different Chesterton portrait so the two
  // books look distinct from each other.
  'lit-chesterton-man-thursday': 'https://upload.wikimedia.org/wikipedia/commons/5/5a/GK_Chesterton_%281920s%29.jpg',
  // Desert Fathers (catalog item also covers Bede / Legenda Aurea) -- Fra
  // Angelico's "Scenes from the Lives of the Desert Fathers" (the Thebaid).
  'lit-hagiography': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Fra_Angelico_-_Scenes_from_the_Lives_of_the_Desert_Fathers_%28Thebaid%29_-_Google_Art_Project.jpg/960px-Fra_Angelico_-_Scenes_from_the_Lives_of_the_Desert_Fathers_%28Thebaid%29_-_Google_Art_Project.jpg',
  // Foxe's Book of Martyrs -- the 1761 edition's engraved frontispiece.
  'lit-foxe-book-of-martyrs': 'https://upload.wikimedia.org/wikipedia/commons/1/11/Foxe%27s_Book_of_Martyrs_-_Frontispiece_%281761%29.jpg',
  // Pilgrim's Progress -- an 1821 illustrated "Plan of the Road from the
  // City of Destruction to the Celestial City". (A William Blake illustration
  // of Christian fighting the demon Apollyon was considered and rejected as
  // too frightening for a family/grammar-stage app; this period map is
  // beautiful, detailed, and age-appropriate.)
  'lit-bunyan-pilgrims-progress': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/John_Bunyan%2C_The_Road_From_the_City_of_Destruction_to_the_Celestial_City_1821_Cornell_CUL_PJM_1038_01.jpg/960px-John_Bunyan%2C_The_Road_From_the_City_of_Destruction_to_the_Celestial_City_1821_Cornell_CUL_PJM_1038_01.jpg',
  // Well-Tempered Clavier -- Bach's own 1722 autograph title page (distinct
  // from the generic Bach portrait used for Goldberg Variations below).
  'music-bach-wtc': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Bach-wtc1-title-ms.jpg/960px-Bach-wtc1-title-ms.jpg',
  // Goldberg Variations -- Haussmann's Bach portrait (Google Art Project
  // scan), kept distinct from the WTC manuscript image above.
  'music-bach-goldberg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Johann_Sebastian_Bach_-_Google_Arts_Project.jpg/960px-Johann_Sebastian_Bach_-_Google_Arts_Project.jpg',
  // Parallel Lives -- a period engraved portrait of Plutarch.
  'bio-plutarch-parallel-lives': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Portrait_of_Plurtarch._Wellcome_M0005616.jpg/960px-Portrait_of_Plurtarch._Wellcome_M0005616.jpg',
  // Morte d'Arthur -- Waterhouse's "The Lady of Shalott" (Google Art Project
  // scan; a wahooart.com-watermarked copy was considered and rejected).
  'lit-malory-morte': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/John-William-Waterhouse-The-Lady-of-Shalott.jpg/960px-John-William-Waterhouse-The-Lady-of-Shalott.jpg',
  // Beowulf -- J.R. Skelton's "Beowulf and the Dragon".
  'lit-beowulf': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Beowulf_and_the_dragon.jpg/960px-Beowulf_and_the_dragon.jpg',
  // Sir Gawain and the Green Knight -- the only surviving medieval
  // illustration of the story, from the poem's own manuscript (British
  // Library Cotton Nero A.x): the Green Knight on horseback holding his
  // severed head, Arthur's court above, Gawain approaching with the axe.
  'lit-malory-gawain': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Gawain_and_the_Green_Knight.jpg/960px-Gawain_and_the_Green_Knight.jpg',
  // Oedipus -- the canonical Attic red-figure kylix by the "Oedipus
  // Painter" (Vatican Museums): a clothed Oedipus questioned by the Sphinx.
  // An Ingres oil painting and a Moreau sketch were both considered and
  // rejected for depicting Oedipus nude, inappropriate for a family app;
  // this vase painting is the famous, textbook-standard image of the scene
  // and shows Oedipus in a traveler's cloak and hat.
  'lit-sophocles-oedipus': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Oedipus_being_questioned_by_the_Sphinx%2C_Attic_red-figured_kylix%2C_by_the_Oedipus_Painter%2C_470-460_BC%2C_inv._16541_-_Museo_Gregoriano_Etrusco_-_Vatican_Museums_-_DSC01041.jpg/960px-thumbnail.jpg',
  // Lord of the Rings -- an illustrated fantasy edition cover (dragon and
  // mountain citadel), replacing a plain red leather binding with no title
  // or art on it at all.
  'lit-tolkien-lotr': 'https://covers.openlibrary.org/b/id/255844-L.jpg',
  // Decline and Fall of the Roman Empire -- Thomas Cole's "The Course of
  // Empire: Destruction".
  'hist-gibbon-decline-fall': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Cole_Thomas_The_Course_of_Empire_Destruction_1836.jpg/960px-Cole_Thomas_The_Course_of_Empire_Destruction_1836.jpg',
  // Democracy in America -- Théodore Chassériau's portrait of Tocqueville.
  'hist-tocqueville-democracy': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Alexis_de_tocqueville.jpg/960px-Alexis_de_tocqueville.jpg',
};

/** Cover image for a catalog entry, or undefined to use the fallback.
 * Mirrors the first three steps of resolveCatalogCover (AppContext.tsx) --
 * everything synchronous, since this powers the Catalog/Curriculum browse
 * cards rendered before an item is ever added to the library, where the
 * fourth step (a live Open Library search) isn't an option. */
export function coverFor(itemId: string): string | undefined {
  const curated = curatedCovers[itemId];
  if (curated) return curated;
  const gutenberg = gutenbergIds[itemId]?.coverUrl;
  if (gutenberg) return gutenberg;
  const artTitle = ART_TITLE_BY_ID.get(itemId);
  if (artTitle) {
    const art = wikimediaArtwork[artTitle];
    if (art) return art;
  }
  if (wikimediaComposerPortraits[itemId]) return wikimediaComposerPortraits[itemId];
  const olCoverId = openLibraryCoverIds[itemId];
  if (olCoverId) return `https://covers.openlibrary.org/b/id/${olCoverId}-L.jpg`;
  return undefined;
}

/** Plain-text URL for a catalog entry, or null if we have no edition. */
export function textUrlFor(itemId: string): string | null {
  return gutenbergIds[itemId]?.textUrl ?? null;
}
