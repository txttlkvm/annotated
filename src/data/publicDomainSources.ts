// Public Domain Sources for Classical Library Items
// Sources: Project Gutenberg, Internet Archive, Standard Ebooks, Open Library, Wikimedia Commons, YouTube
// All sources provide direct download links for EPUB/PDF/TXT formats

// Priority order for book formats:
// 1. Standard Ebooks (EPUB) - highest quality, best formatting
// 2. Project Gutenberg (EPUB) - direct download, reliable
// 3. Internet Archive (EPUB/PDF) - large collection, multiple formats
// 4. Open Library API - searches millions of books

export const publicDomainSources: Record<string, Array<{ type: string; url: string; provider: string }>> = {
  // Literature - Texts
  'Iliad': [
    { type: 'epub', provider: 'standard-ebooks', url: 'https://standardebooks.org/ebooks/homer--iliad--samuel-butler/downloads/homer--iliad--samuel-butler.epub' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/6150/pg6150.epub' },
    { type: 'mobi', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/6150/pg6150.kindle.images' },
    { type: 'pdf', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/6150/pg6150.pdf' },
  ],
  'Odyssey': [
    { type: 'epub', provider: 'standard-ebooks', url: 'https://standardebooks.org/ebooks/homer--odyssey--samuel-butler/downloads/homer--odyssey--samuel-butler.epub' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1727/pg1727.epub' },
    { type: 'mobi', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1727/pg1727.kindle.images' },
    { type: 'pdf', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1727/pg1727.pdf' },
  ],
  'The Divine Comedy': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/8800' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/8800/pg8800.epub' },
    { type: 'txt', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/8800/pg8800.txt' },
  ],
  'Hamlet': [
    { type: 'epub', provider: 'standard-ebooks', url: 'https://standardebooks.org/ebooks/william-shakespeare--hamlet/downloads/william-shakespeare--hamlet.epub' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1524/pg1524.epub' },
    { type: 'mobi', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1524/pg1524.kindle.images' },
    { type: 'pdf', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1524/pg1524.pdf' },
  ],
  'King Lear': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/1533' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1533/pg1533.epub' },
  ],
  'Macbeth': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/1534' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1534/pg1534.epub' },
  ],
  'Othello': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/1531' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1531/pg1531.epub' },
  ],
  'A Midsummer Night\'s Dream': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/1514' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1514/pg1514.epub' },
  ],
  'Beowulf': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/98' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/98/pg98.epub' },
  ],
  'Sir Gawain and the Green Knight': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/1819' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1819/pg1819.epub' },
  ],
  'Pilgrim\'s Progress': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/131' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/131/pg131.epub' },
  ],
  'The Republic': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/1497' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1497/pg1497.epub' },
    { type: 'mobi', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1497/pg1497.kindle.images' },
  ],
  'Metaphysics': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/8014' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/8014/pg8014.epub' },
  ],
  'Nicomachean Ethics': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/8438' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/8438/pg8438.epub' },
  ],
  'Politics': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/6762' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/6762/pg6762.epub' },
  ],
  'Confessions': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/3296' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/3296/pg3296.epub' },
  ],
  'City of God': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/12216' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/12216/pg12216.epub' },
  ],
  'Meditations': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/14502' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/14502/pg14502.epub' },
  ],
  'An Essay Concerning Human Understanding': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/10615' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/10615/pg10615.epub' },
  ],
  'Leviathan': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/3207' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/3207/pg3207.epub' },
  ],
  'The Prince': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/1232' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1232/pg1232.epub' },
  ],
  'The Federalist Papers': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/18' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/18/pg18.epub' },
  ],
  'Declaration of Independence': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/1' },
    { type: 'txt', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1/pg1.txt' },
  ],
  'U.S. Constitution': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/2' },
    { type: 'txt', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/2/pg2.txt' },
  ],
  'On War': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/19281' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/19281/pg19281.epub' },
  ],
  'Elements': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/21076' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/21076/pg21076.epub' },
  ],
  'Parallel Lives': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/674' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/674/pg674.epub' },
  ],
  'The Man Who Was Thursday': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/1695' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1695/pg1695.epub' },
  ],
  'Decline and Fall of the Roman Empire': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/25717' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/25717/pg25717.epub' },
  ],
  'Democracy in America': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/815' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/815/pg815.epub' },
  ],
  'A System of Oratory': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/31046' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/31046/pg31046.epub' },
  ],
  'Commentaries on the Laws of England': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/24268' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/24268/pg24268.epub' },
  ],
  'Geographica': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/44425' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/44425/pg44425.epub' },
  ],

  // Music - Links to public domain recordings
  'Well-Tempered Clavier': [
    { type: 'audio', provider: 'archive', url: 'https://archive.org/search.php?query=bach+well-tempered+clavier' },
    { type: 'audio', provider: 'youtube', url: 'https://www.youtube.com/results?search_query=Bach+Well-Tempered+Clavier+full' },
  ],
  'Goldberg Variations': [
    { type: 'audio', provider: 'archive', url: 'https://archive.org/search.php?query=bach+goldberg+variations' },
    { type: 'audio', provider: 'youtube', url: 'https://www.youtube.com/results?search_query=Bach+Goldberg+Variations' },
  ],
  'Brandenburg Concertos': [
    { type: 'audio', provider: 'archive', url: 'https://archive.org/search.php?query=bach+brandenburg+concertos' },
    { type: 'audio', provider: 'youtube', url: 'https://www.youtube.com/results?search_query=Bach+Brandenburg+Concertos' },
  ],
  'Mass in B Minor': [
    { type: 'audio', provider: 'archive', url: 'https://archive.org/search.php?query=bach+mass+b+minor' },
    { type: 'audio', provider: 'youtube', url: 'https://www.youtube.com/results?search_query=Bach+Mass+B+Minor' },
  ],
  'Gregorian Chant': [
    { type: 'audio', provider: 'archive', url: 'https://archive.org/search.php?query=gregorian+chant' },
    { type: 'audio', provider: 'youtube', url: 'https://www.youtube.com/results?search_query=Gregorian+Chant' },
  ],
  'Missa Papae Marcelli': [
    { type: 'audio', provider: 'archive', url: 'https://archive.org/search.php?query=palestrina+missa+papae+marcelli' },
    { type: 'audio', provider: 'youtube', url: 'https://www.youtube.com/results?search_query=Palestrina+Missa+Papae+Marcelli' },
  ],
  'Traité de l\'harmonie': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/25265' },
  ],

  // Additional Literature
  'El Poema de Mio Cid': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/12105' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/12105/pg12105.epub' },
  ],
  'Morte d\'Arthur': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/1684' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1684/pg1684.epub' },
  ],
  'The Faerie Queene': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/14' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/14/pg14.epub' },
  ],
  'Prose Edda': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/1001' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/1001/pg1001.epub' },
  ],
  'Poetic Edda': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/15797' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/15797/pg15797.epub' },
  ],
  'Grimm Fairy Tales': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/25344' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/25344/pg25344.epub' },
  ],
  'Oedipus Rex': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/30' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/30/pg30.epub' },
  ],
  'Volsunga Saga': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/5130' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/5130/pg5130.epub' },
  ],
  'Piers Plowman': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/30152' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/30152/pg30152.epub' },
  ],

  // Philosophy & Theology
  'Critique of Pure Reason': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/4280' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/4280/pg4280.epub' },
  ],
  'On Christian Doctrine': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/3295' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/3295/pg3295.epub' },
  ],
  'De Institutione Musica': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/14955' },
  ],

  // History
  'Peloponnesian War': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/3231' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/3231/pg3231.epub' },
  ],
  'Second Treatise of Government': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/7370' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/7370/pg7370.epub' },
  ],
  'The Anti-Federalist Papers': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/62' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/62/pg62.epub' },
  ],
  'Life of Charlemagne': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/32815' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/32815/pg32815.epub' },
  ],

  // Biography
  'George Washington Writings': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/30012' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/30012/pg30012.epub' },
  ],
  'Lincoln Speeches and Writings': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/100' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/100/pg100.epub' },
  ],

  // Language
  'De Oratore': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/46499' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/46499/pg46499.epub' },
  ],

  // Architecture & Specialized
  'De architectura': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/17629' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/17629/pg17629.epub' },
  ],
  'Commentaries on the Laws of England (Extended)': [
    { type: 'html', provider: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/24268' },
    { type: 'epub', provider: 'gutenberg', url: 'https://www.gutenberg.org/cache/epub/24268/pg24268.epub' },
  ],

  // Music - Public Domain Recordings and Scores
  'Toccata and Fugue in D minor': [
    { type: 'html', provider: 'archive.org', url: 'https://archive.org/search.php?query=%22Toccata%20and%20Fugue%22%20Bach&mediatype=audio' },
    { type: 'html', provider: 'youtube', url: 'https://www.youtube.com/results?search_query=Toccata+and+Fugue+Bach+classical' },
  ],
  'Polyphony - Palestrina': [
    { type: 'html', provider: 'archive.org', url: 'https://archive.org/search.php?query=Palestrina%20polyphony&mediatype=audio' },
    { type: 'html', provider: 'youtube', url: 'https://www.youtube.com/results?search_query=Palestrina+Renaissance+music' },
  ],

  // Art - Wikimedia Commons public domain images
  'The Trinity (Rublev)': [
    { type: 'html', provider: 'wikimedia', url: 'https://commons.wikimedia.org/wiki/File:Rublev_Trinity.jpg' },
  ],
  'Sistine Chapel Ceiling': [
    { type: 'html', provider: 'wikimedia', url: 'https://commons.wikimedia.org/wiki/Category:Sistine_Chapel_ceiling' },
  ],
  'Pietà': [
    { type: 'html', provider: 'wikimedia', url: 'https://commons.wikimedia.org/wiki/File:Michelangelo%27s_Pieta_5450_cropncleaned_edit.jpg' },
  ],
  'David': [
    { type: 'html', provider: 'wikimedia', url: 'https://commons.wikimedia.org/wiki/File:Michelangelo%27s_David_1504.jpg' },
  ],
  'Annunciation (Fra Angelico)': [
    { type: 'html', provider: 'wikimedia', url: 'https://commons.wikimedia.org/wiki/File:Fra_Angelico_-_The_Annunciation.jpg' },
  ],
  'Scrovegni Chapel Frescoes': [
    { type: 'html', provider: 'wikimedia', url: 'https://commons.wikimedia.org/wiki/Category:Scrovegni_Chapel' },
  ],
  'Hagia Sophia': [
    { type: 'html', provider: 'wikimedia', url: 'https://commons.wikimedia.org/wiki/Category:Hagia_Sophia' },
  ],
  'Byzantine Icons': [
    { type: 'html', provider: 'wikimedia', url: 'https://commons.wikimedia.org/wiki/Category:Byzantine_icons' },
  ],
};

// Wikimedia Commons direct image download URLs for public domain artwork
// Exported so gutenbergIds.ts's coverFor() (the synchronous lookup the
// Catalog/Curriculum BROWSE cards use, before an item is ever added to the
// library) can show the real artwork too, not just whatever a Gutenberg
// match provides -- the async addClassicalLibraryItem/resolveCatalogCover
// chain only ever runs once an item is actually added, so browse cards
// never saw it.
export const wikimediaArtwork: Record<string, string> = {
  // The original 4 entries below 400'd: Wikimedia only serves a fixed set of
  // thumbnail widths, and 800px/536px weren't on the list. Re-fetched via the
  // imageinfo API's own iiurlwidth (guarantees a width Wikimedia will
  // actually generate) and re-verified with a real HTTP 200 before landing.
  'The Trinity (Rublev)': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Andrey_Rublev_-_%D0%A1%D0%B2._%D0%A2%D1%80%D0%BE%D0%B8%D1%86%D0%B0_-_Google_Art_Project.jpg/1280px-Andrey_Rublev_-_%D0%A1%D0%B2._%D0%A2%D1%80%D0%BE%D0%B8%D1%86%D0%B0_-_Google_Art_Project.jpg',
  'Pietà': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Michelangelo%27s_Pieta_5450_cropncleaned_edit.jpg/1280px-Michelangelo%27s_Pieta_5450_cropncleaned_edit.jpg',
  'David': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Michelangelo%27s_David_2015.jpg/1280px-Michelangelo%27s_David_2015.jpg',
  'Annunciation (Fra Angelico)': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Fra_Angelico_-_The_Annunciation.jpg/1280px-Fra_Angelico_-_The_Annunciation.jpg',
  // Verified via Wikimedia Commons API + a real HTTP fetch before being added
  // (200, image/jpeg, real byte count) — not guessed filenames.
  'Giotto (Scrovegni Chapel)': 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Giotto_-_Scrovegni_-_-36-_-_Lamentation_%28The_Mourning_of_Christ%29_adj.jpg',
  'Michelangelo (Sistine Chapel Ceiling)': 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Sistine_Chapel_ceiling_02_%28brightened%29.jpg',
  'Greco-Roman Sculpture': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Laoco%C3%B6n_and_his_sons_group.jpg/1280px-Laoco%C3%B6n_and_his_sons_group.jpg',
  'Gothic Cathedral Sculpture (Chartres, Reims)': 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Chartres_Cathedral%3B_Christ_in_Majesty%3B_central_portal%2C_west_facade_-_Vanderbilt_ACT_-_00000043.jpg',
};

// Helper to generate Anna's Archive search URL
function getAnnaArchiveSearchUrl(title: string, author?: string): string {
  const query = author ? `${title} ${author}` : title;
  const encoded = encodeURIComponent(query);
  return `https://annas-archive.gl/search?q=${encoded}`;
}

function getAnnaArchiveSource(title: string, author?: string) {
  return {
    type: 'html' as const,
    provider: 'annas-archive' as const,
    url: getAnnaArchiveSearchUrl(title, author),
  };
}

function getOpenLibrarySource(title: string, author?: string) {
  const query = author ? `${title} ${author}` : title;
  const encoded = encodeURIComponent(query);
  return {
    type: 'html' as const,
    provider: 'open-library' as const,
    url: `https://openlibrary.org/search?title=${encoded}&has_fulltext=true`,
  };
}

function getStandardEbooksSource(title: string) {
  // NOT /search -- that path 404s (confirmed live while auditing this file
  // for the same class of bug as OpenLibraryService's wrong /api/ URL
  // earlier tonight). Standard Ebooks' real search lives at /ebooks.
  const encoded = encodeURIComponent(title);
  return {
    type: 'html' as const,
    provider: 'standard-ebooks' as const,
    url: `https://standardebooks.org/ebooks?query=${encoded}`,
  };
}

// Complete, individually-tracked recordings, ordered start to finish. A
// catalogue item pointing at one of these plays the entire real work (e.g.
// all 48 preludes/fugues of the Well-Tempered Clavier) rather than the
// single representative movement in wikimediaMusic below -- that fallback
// existed because most multi-movement works only ever had one movement's
// audio file actually tracked down; this is the complete-recording upgrade
// path as each one gets found. Every URL below curl-verified (HTTP 200,
// audio/* or application/ogg content-type) before being added, and every
// list re-checked for correct listening order (track 1 first) -- a
// shuffled classical work is a real defect, not a cosmetic one.
const wikimediaMusicPlaylists: Record<string, string[]> = {
  // All 48 movements (24 preludes + 24 fugues), Kimiko Ishizaka's "Open
  // Well-Tempered Clavier" (CC0). Previously just track 1 (~4 minutes);
  // this is the real, complete, roughly 1.5-2 hour Book 1.
  'Well-Tempered Clavier': [
    'https://upload.wikimedia.org/wikipedia/commons/b/b6/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_01_Prelude_No._1_in_C_major%2C_BWV_846.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/e/e1/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_02_Fugue_No._1_in_C_major%2C_BWV_846.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/4/4d/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_03_Prelude_No._2_in_C_minor%2C_BWV_847.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/b/b0/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_04_Fugue_No._2_in_C_minor%2C_BWV_847.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/5/59/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_05_Prelude_No._3_in_C-sharp_major%2C_BWV_848.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/b/b7/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_06_Fugue_No._3_in_C-sharp_major%2C_BWV_848.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/f/f9/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_07_Prelude_No._4_in_C-sharp_minor%2C_BWV_849.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/2/21/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_08_Fugue_No._4_in_C-sharp_minor%2C_BWV_849.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/a/a0/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_09_Prelude_No._5_in_D_major%2C_BWV_850.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/d/d4/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_10_Fugue_No._5_in_D_major%2C_BWV_850.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/7/71/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_11_Prelude_No._6_in_D_minor%2C_BWV_851.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/9/97/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_12_Fugue_No._6_in_D_minor%2C_BWV_851.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/a/aa/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_13_Prelude_No._7_in_E-flat_major%2C_BWV_852.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/7/7b/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_14_Fugue_No._7_in_E-flat_major%2C_BWV_852.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/3/35/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_15_Prelude_No._8_in_E-flat_minor%2C_BWV_853.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/1/16/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_16_Fugue_No._8_in_D-sharp_minor%2C_BWV_853.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/b/bc/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_17_Prelude_No._9_in_E_major%2C_BWV_854.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/2/2d/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_18_Fugue_No._9_in_E_major%2C_BWV_854.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/c/cb/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_19_Prelude_No._10_in_E_minor%2C_BWV_855.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/5/5c/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_20_Fugue_No._10_in_E_minor%2C_BWV_855.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/4/4a/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_21_Prelude_No._11_in_F_major%2C_BWV_856.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/b/bd/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_22_Fugue_No._11_in_F_major%2C_BWV_856.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/f/f3/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_23_Prelude_No._12_in_F_minor%2C_BWV_857.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/b/b9/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_24_Fugue_No._12_in_F_minor%2C_BWV_857.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/e/e0/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_25_Prelude_No._13_in_F-sharp_major%2C_BWV_858.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/4/46/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_26_Fugue_No._13_in_F-sharp_major%2C_BWV_858.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/f/fc/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_27_Prelude_No._14_in_F-sharp_minor%2C_BWV_859.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/0/0d/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_28_Fugue_No._14_in_F-sharp_minor%2C_BWV_859.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/8/81/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_29_Prelude_No._15_in_G_major%2C_BWV_860.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/d/d0/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_30_Fugue_No._15_in_G_major%2C_BWV_860.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/1/19/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_31_Prelude_No._16_in_G_minor%2C_BWV_861.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/2/23/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_32_Fugue_No._16_in_G_minor%2C_BWV_861.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/8/86/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_33_Prelude_No._17_in_A-flat_major%2C_BWV_862.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/f/fd/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_34_Fugue_No._17_in_A-flat_major%2C_BWV_862.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/5/5c/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_35_Prelude_No._18_in_G-sharp_minor%2C_BWV_863.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/c/c6/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_36_Fugue_No._18_in_G-sharp_minor%2C_BWV_863.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/b/be/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_37_Prelude_No._19_in_A_major%2C_BWV_864.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/2/24/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_38_Fugue_No._19_in_A_major%2C_BWV_864.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/9/9f/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_39_Prelude_No._20_in_A_minor%2C_BWV_865.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/c/c0/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_40_Fugue_No._20_in_A_minor%2C_BWV_865.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/b/b0/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_41_Prelude_No._21_in_B-flat_major%2C_BWV_866.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/5/57/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_42_Fugue_No._21_in_B-flat_major%2C_BWV_866.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/1/16/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_43_Prelude_No._22_in_B-flat_minor%2C_BWV_867.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/5/5d/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_44_Fugue_No._22_in_B-flat_minor%2C_BWV_867.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/6/63/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_45_Prelude_No._23_in_B_major%2C_BWV_868.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/8/88/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_46_Fugue_No._23_in_B_major%2C_BWV_868.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/2/2e/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_47_Prelude_No._24_in_B_minor%2C_BWV_869.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/5/5d/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_48_Fugue_No._24_in_B_minor%2C_BWV_869.ogg',
  ],
  // All 32 tracks (Aria, 30 variations, Aria da capo), Kimiko Ishizaka's
  // "Open Goldberg Variations" (CC0). Previously just track 1 (the Aria
  // alone, under 5 minutes); this is the real, complete work.
  'Goldberg Variations': [
    'https://upload.wikimedia.org/wikipedia/commons/e/e6/Kimiko_Ishizaka_-_01_-_Aria.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/2/20/Kimiko_Ishizaka_-_02_-_Variatio_1_a_1_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/9/9e/Kimiko_Ishizaka_-_03_-_Variatio_2_a_1_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/2/21/Kimiko_Ishizaka_-_04_-_Variatio_3_a_1_Clav_Canone_allUnisuono.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/f/f0/Kimiko_Ishizaka_-_05_-_Variatio_4_a_1_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/9/9d/Kimiko_Ishizaka_-_06_-_Variatio_5_a_1_ovvero_2_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/f/f9/Kimiko_Ishizaka_-_07_-_Variatio_6_a_1_Clav_Canone_alla_Seconda.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/1/1b/Kimiko_Ishizaka_-_08_-_Variatio_7_a_1_ovvero_2_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/b/bc/Kimiko_Ishizaka_-_09_-_Variatio_8_a_2_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/2/21/Kimiko_Ishizaka_-_10_-_Variatio_9_a_1_Clav_Canone_alla_Terza.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/f/f6/Kimiko_Ishizaka_-_11_-_Variatio_10_a_1_Clav_Fughetta.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/2/2f/Kimiko_Ishizaka_-_12_-_Variatio_11_a_2_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/e/e2/Kimiko_Ishizaka_-_13_-_Variatio_12_Canone_alla_Quarta.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/4/49/Kimiko_Ishizaka_-_14_-_Variatio_13_a_2_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/d/d9/Kimiko_Ishizaka_-_15_-_Variatio_14_a_2_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/2/2e/Kimiko_Ishizaka_-_16_-_Variatio_15_a_1_Clav_Canone_alla_Quinta.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/a/af/Kimiko_Ishizaka_-_17_-_Variatio_16_a_1_Clav_Ouverture.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/4/4b/Kimiko_Ishizaka_-_18_-_Variatio_17_a_2_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/7/75/Kimiko_Ishizaka_-_19_-_Variatio_18_a_1_Clav_Canone_alla_Sexta.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/1/1e/Kimiko_Ishizaka_-_20_-_Variatio_19_a_1_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/f/f9/Kimiko_Ishizaka_-_21_-_Variatio_20_a_2_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/0/02/Kimiko_Ishizaka_-_22_-_Variatio_21_Canone_alla_Settima.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/e/e8/Kimiko_Ishizaka_-_23_-_Variatio_22_a_1_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/e/ec/Kimiko_Ishizaka_-_24_-_Variatio_23_a_2_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/9/9f/Kimiko_Ishizaka_-_25_-_Variatio_24_a_1_Clav_Canone_allOttava.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/5/5f/Kimiko_Ishizaka_-_26_-_Variatio_25_a_2_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/e/e4/Kimiko_Ishizaka_-_27_-_Variatio_26_a_2_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/8/8f/Kimiko_Ishizaka_-_28_-_Variatio_27_a_2_Clav_Canone_alla_Nona.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/a/a5/Kimiko_Ishizaka_-_29_-_Variatio_28_a_2_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/0/0d/Kimiko_Ishizaka_-_30_-_Variatio_29_a_1_ovvero_2_Clav.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/c/c3/Kimiko_Ishizaka_-_31_-_Variatio_30_a_1_Clav_Quodlibet.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/e/ee/Kimiko_Ishizaka_-_32_-_Aria_da_Capo_Fine.ogg',
  ],
  // All 6 concertos, 19 movements. Not one performer -- four separate
  // recording projects spliced together, since no single complete public-
  // domain recording exists on Commons: a 1935 78rpm historical transfer
  // (Concerto 1 complete, Concerto 4 movements II-III), a 2025 IMSLP
  // upload (Concerto 2), and a Pandora Music/ibiblio.org chamber-orchestra
  // recording (Concertos 3, 5, 6). Concerto 4's first movement is the one
  // real weak link: no orchestral recording of it exists freely, so it
  // falls back to a Kevin MacLeod/incompetech synth realization, which
  // will sound stylistically discontinuous from movements II-III right
  // after it. Judged a better trade than omitting half the work entirely.
  'Brandenburg Concertos': [
    // Concerto No. 1 (4 movements)
    'https://upload.wikimedia.org/wikipedia/commons/f/f4/Bach_-_Brandenburg_Concerto_No._1_-_1._Allegro.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/1/1f/Bach_-_Brandenburg_Concerto.No.1_in_F_Major-_II._Adagio.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/1/18/Bach_-_Brandenburg_Concerto.No._1_in_F_Major-_III._Allegro.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/9/95/Bach_-_Brandenburg_Concerto.No.1_in_F_Major-_IV._Menuetto%3B_Trio_1%3B_Menuetto%3B_Polacca%3B_Menuetto_and_Trio.ogg',
    // Concerto No. 2 (3 movements)
    'https://upload.wikimedia.org/wikipedia/commons/4/46/IMSLP83563_-_Brandenburg_Concerto_No.2_in_F_major%2C_BWV_1047_%28Bach%2C_Johann_Sebastian%29_-_1._%28Allegro%29.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/4/44/IMSLP83567_-_Brandenburg_Concerto_No.2_in_F_major%2C_BWV_1047_%28Bach%2C_Johann_Sebastian%29_-_2._Andante.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/3/3a/IMSLP83569_-_Brandenburg_Concerto_No.2_in_F_major%2C_BWV_1047_%28Bach%2C_Johann_Sebastian%29_-_3._Allegro_assai.ogg',
    // Concerto No. 3 (3 movements)
    'https://upload.wikimedia.org/wikipedia/commons/b/b0/Bach_-_Brandenburg_Concerto_No._3_-_1._Allegro.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/7/78/Bach_-_Brandenburg_Concerto_No._3_-_2._Adagio.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/c/ca/Bach_-_Brandenburg_Concerto_No._3_-_3._Allegro.ogg',
    // Concerto No. 4 (3 movements -- movement I is the synth realization, see note above)
    'https://upload.wikimedia.org/wikipedia/commons/3/3b/Brandenburg_Concerto_No._4_in_G%2C_Movement_I_%28Allegro%29%2C_BWV_1049_%28ISRC_USUAN1100303%29.oga',
    'https://upload.wikimedia.org/wikipedia/commons/b/b9/Bach_-_Brandenburg_ConcertoNo._4_in_G_Major-_II._Andante.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/2/26/Bach_-_Brandenburg_Concerto.No.4_in_G_Major-_III._Presto.ogg',
    // Concerto No. 5 (3 movements)
    'https://upload.wikimedia.org/wikipedia/commons/6/68/Bach_-_Brandenburg_Concerto_5_-_1._Allegro.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/4/49/Bach_-_Brandenburg_Concerto_5_-_2._Affettuoso.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/1/12/Bach_-_Brandenburg_Concerto_5_-_3._Allegro.ogg',
    // Concerto No. 6 (3 movements)
    'https://upload.wikimedia.org/wikipedia/commons/f/f3/Bach_-_Brandenburg_Concerto_6_-_1._Allegro.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/3/37/Bach_-_Brandenburg_Concerto_6_-_2._Adagio.ogg',
    'https://upload.wikimedia.org/wikipedia/commons/6/61/Bach_-_Brandenburg_Concerto_6_-_3._Allegro.ogg',
  ],
  // All 6 movements (Kyrie, Gloria, Credo, Sanctus, Agnus Dei I & II) of
  // the actual mass, from one consistent recording. Previously just the
  // Kyrie alone.
  'Missa Papae Marcelli': [
    'https://upload.wikimedia.org/wikipedia/commons/e/e1/Missa_Papae_Marcelli_-_I._Kyrie.flac',
    'https://upload.wikimedia.org/wikipedia/commons/e/e0/Missa_Papae_Marcelli_-_II._Gloria.flac',
    'https://upload.wikimedia.org/wikipedia/commons/c/c8/Missa_Papae_Marcelli_-_III._Credo.flac',
    'https://upload.wikimedia.org/wikipedia/commons/c/ce/Missa_Papae_Marcelli_-_IV._Sanctus.flac',
    'https://upload.wikimedia.org/wikipedia/commons/0/04/Missa_Papae_Marcelli_-_V._Agnus_Dei_I.flac',
    'https://upload.wikimedia.org/wikipedia/commons/6/63/Missa_Papae_Marcelli_-_VI._Agnus_Dei_II.flac',
  ],
};

// Direct, verified public-domain recordings (real HTTP 200 + audio content-
// type checked before being added — not guessed filenames). Most catalogue
// music entries are large multi-movement works, so this points at one
// representative movement, not the whole work, UNLESS a complete recording
// exists in wikimediaMusicPlaylists above, which wins.
const wikimediaMusic: Record<string, string> = {
  'Well-Tempered Clavier':
    'https://upload.wikimedia.org/wikipedia/commons/b/b6/Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier%2C_Book_1_-_01_Prelude_No._1_in_C_major%2C_BWV_846.ogg',
  'Goldberg Variations':
    'https://upload.wikimedia.org/wikipedia/commons/5/59/Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations%2C_BWV_988_%28Piano%29_-_01_Aria.mp3',
  'Brandenburg Concertos':
    'https://upload.wikimedia.org/wikipedia/commons/f/f4/Bach_-_Brandenburg_Concerto_No._1_-_1._Allegro.ogg',
  'Missa Papae Marcelli':
    'https://upload.wikimedia.org/wikipedia/commons/e/e1/Missa_Papae_Marcelli_-_I._Kyrie.flac',
  'Gregorian Chant':
    'https://upload.wikimedia.org/wikipedia/commons/7/7d/Kyrie_Eleison_Orbis_Factor.ogg',
};

// Composer portraits / period art used as COVER IMAGES for music-type
// library items (BookCover has no photo to fall back on for music, only a
// typographic placeholder — this gives it a real image instead). Keyed by
// classicalLibrary item id, not title, since AppContext looks these up by
// item.id. Every URL below was resolved through the imageinfo API's
// iiurlwidth param (never hand-built as a /thumb/NNNpx-file.jpg guess) and
// verified with a real `curl -sI` returning HTTP 200 + image/* content-type
// before being added. Where no verifiable composer portrait exists (e.g.
// anonymous/12th-century Notre Dame school), a genuine period artifact
// (an actual manuscript page of the piece) is used instead — never a guess.
export const wikimediaComposerPortraits: Record<string, string> = {
  // J.S. Bach — Haussmann's 1748 portrait (the canonical Bach portrait used
  // on Wikipedia's infobox). Covers all four Bach works in the library.
  'music-bach-wtc': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Johann_Sebastian_Bach.jpg/960px-Johann_Sebastian_Bach.jpg',
  'music-bach-goldberg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Johann_Sebastian_Bach.jpg/960px-Johann_Sebastian_Bach.jpg',
  'music-bach-brandenburg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Johann_Sebastian_Bach.jpg/960px-Johann_Sebastian_Bach.jpg',
  'music-bach-mass-b-minor': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Johann_Sebastian_Bach.jpg/960px-Johann_Sebastian_Bach.jpg',
  // Palestrina — the portrait used on Wikipedia's infobox for the composer.
  'art-palestrina-papae-marcelli': 'https://upload.wikimedia.org/wikipedia/commons/1/18/Giovanni_Pierluigi_da_Palestrina.jpg',
  // Gregorian Chant has no single composer ("Various" — plainchant tradition
  // traditionally credited to Pope Gregory I). Used the well-known icon of
  // Gregory the Great receiving the chant from the Holy Spirit (a dove at his
  // ear), the standard period image for the tradition.
  'art-gregorian-chant': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Gregory_the_Great_with_the_Holy_Spirit.jpg/960px-Gregory_the_Great_with_the_Holy_Spirit.jpg',
  // Notre Dame School (Léonin/Pérotin) — no contemporary 12th/13th-century
  // portraits of either composer exist (verified: no page image on either's
  // Wikipedia article). Used an actual period artifact instead: a 13th-
  // century manuscript page of Pérotin's "Alleluia Nativitas" from Codex
  // Guelf.1099 (Wolfenbüttel W1), a genuine Notre Dame school source — not a
  // fabricated or guessed image.
  'art-notre-dame-school': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Perotin_-_Alleluia_nativitas.jpg/960px-Perotin_-_Alleluia_nativitas.jpg',
};

// Open Library cover_i ids for catalogue items with no Gutenberg match at
// all (so no cover from that path) -- some of these are modern in-copyright
// works (Tolkien, Lewis, Mounce, Pratico) where only the cover THUMBNAIL is
// used, never the text; the book itself correctly stays unreadable in the
// app since no public-domain full text exists to source. Every id below was
// found via a real Open Library search (title + author surname match, same
// discipline as everywhere else in this file) and curl-verified (302 -> 200
// image/jpeg via covers.openlibrary.org) before being added -- not guessed.
export const openLibraryCoverIds: Record<string, number> = {
  'lit-el-poema-mio-cid': 12098552,
  'phil-aristotle-metaphysics': 10702956,
  'hist-declaration-constitution': 8481317,
  'math-euclid-elements': 1736063,
  'lit-tolkien-lotr': 14625765,
  'lit-narnia-lion-witch': 8441376,
  'math-descartes-geometry': 6527933,
  'lang-cicero-de-oratore': 6749759,
  'lang-ward-oratory': 11352942,
  'arch-suger': 4439074,
  'mus-rameau-harmony': 308921,
  'theo-augustine-doctrine': 7125465,
  'theo-ames-medulla': 10896541,
  'lang-greek-mounce': 171250,
  'lang-hebrew-pratico': 170171,
  'read-scanderbeg': 4269749,
  'read-ferdinand-saint': 6211719,
  'mem-apostles-creed': 5604763,
};

function getWikimediaMusicSource(title: string) {
  // A complete, individually-tracked recording wins over the single-
  // movement fallback below -- MusicPlayerScreen plays the full ordered
  // list in sequence instead of just one representative movement.
  const playlist = wikimediaMusicPlaylists[title];
  if (playlist && playlist.length) {
    return { type: 'audio' as const, provider: 'wikimedia' as const, url: playlist[0], urls: playlist };
  }
  const directUrl = wikimediaMusic[title];
  if (directUrl) {
    // Was 'html' -- a real direct audio file, not a webpage about one.
    return { type: 'audio' as const, provider: 'wikimedia' as const, url: directUrl };
  }
  return null;
}

function getArchiveOrgMusicSource(title: string, artist?: string) {
  const query = artist ? `${title} ${artist}` : title;
  const encoded = encodeURIComponent(query);
  return {
    type: 'html' as const,
    provider: 'archive.org' as const,
    url: `https://archive.org/search.php?query=${encoded}&mediatype=audio`,
  };
}

function getYouTubeMusicSource(title: string, artist?: string) {
  const query = artist ? `${title} ${artist}` : title;
  const encoded = encodeURIComponent(query);
  return {
    type: 'html' as const,
    provider: 'youtube' as const,
    url: `https://www.youtube.com/results?search_query=${encoded}+classical+music`,
  };
}

function getWikimediaArtSource(title: string) {
  // Check if we have a direct image URL
  const directUrl = wikimediaArtwork[title];
  if (directUrl) {
    return {
      // 'image', not 'html': this URL IS the artwork file, not a page
      // about it. AppContext.addClassicalLibraryItem finds this by
      // filtering sources for type 'image' to use as the item's cover --
      // it never matched anything back when this said 'html', so every
      // art-type item fell through to Open Library and then the
      // typographic fallback despite having a perfectly good image right
      // here the whole time.
      type: 'image' as const,
      provider: 'wikimedia' as const,
      url: directUrl,
    };
  }

  // Otherwise provide search
  const encoded = encodeURIComponent(title);
  return {
    type: 'html' as const,
    provider: 'wikimedia' as const,
    url: `https://commons.wikimedia.org/w/index.php?search=${encoded}&title=Special:MediaSearch&go=Go`,
  };
}

// Helper function to get sources by title (handles variations)
export function getPublicDomainSources(
  title: string,
  author?: string,
  itemType: 'book' | 'music' | 'art' | 'resource' = 'book'
) {
  // Try exact match first
  if (publicDomainSources[title]) {
    const sources = publicDomainSources[title];

    // For music and art, include appropriate search sources
    if (itemType === 'music') {
      const direct = getWikimediaMusicSource(title);
      return [
        ...(direct ? [direct] : []),
        ...sources,
        getArchiveOrgMusicSource(title, author),
        getYouTubeMusicSource(title, author),
      ];
    } else if (itemType === 'art') {
      return [
        getWikimediaArtSource(title),
        ...sources,
      ];
    }

    // For books, add multiple fallback sources
    return [
      ...sources,
      getStandardEbooksSource(title),
      getOpenLibrarySource(title, author),
      getAnnaArchiveSource(title, author),
    ];
  }

  // Try partial match (case-insensitive)
  for (const [key, value] of Object.entries(publicDomainSources)) {
    if (key.toLowerCase().includes(title.toLowerCase()) || title.toLowerCase().includes(key.toLowerCase())) {
      const sources = value;

      if (itemType === 'music') {
        const direct = getWikimediaMusicSource(title);
        return [
          ...(direct ? [direct] : []),
          ...sources,
          getArchiveOrgMusicSource(title, author),
          getYouTubeMusicSource(title, author),
        ];
      } else if (itemType === 'art') {
        return [
          getWikimediaArtSource(title),
          ...sources,
        ];
      }

      return [
        ...sources,
        getStandardEbooksSource(title),
        getOpenLibrarySource(title, author),
        getAnnaArchiveSource(title, author),
      ];
    }
  }

  // If no direct source found, return appropriate search options based on type
  if (itemType === 'music') {
    const direct = getWikimediaMusicSource(title);
    return [
      ...(direct ? [direct] : []),
      getArchiveOrgMusicSource(title, author),
      getYouTubeMusicSource(title, author),
    ];
  } else if (itemType === 'art') {
    return [
      getWikimediaArtSource(title),
    ];
  }

  // For books and resources, return book search options
  return [
    getStandardEbooksSource(title),
    getOpenLibrarySource(title, author),
    getAnnaArchiveSource(title, author),
  ];
}

/*
  COVERAGE SUMMARY:
  ================

  Total Classical Library Items: 113

  Books (99 items):
  - ~50+ have public domain sources mapped (Project Gutenberg)
  - All pre-1928 works are public domain in US
  - Most major classical texts are on Gutenberg or Archive.org
  - Some specialized texts may only be in Archive.org

  Music (7 items):
  - All classical compositions (pre-1928) are public domain
  - Recordings available via Archive.org, YouTube, classical music sites
  - Direct playback URLs available for major works

  Art (8 items):
  - All classical artworks (pre-1928 public domain in most countries)
  - High-res images available on Wikimedia Commons
  - Museum websites host their own public domain collections

  IMPORTANT NOTES:
  ================
  1. Pre-1928 works are PUBLIC DOMAIN in the United States
  2. Project Gutenberg has 70,000+ free ebooks, mostly public domain
  3. Internet Archive has 36+ million texts, including rare classical works
  4. Wikimedia Commons has 90+ million freely usable media files
  5. All mapped sources are verified public domain or Creative Commons
  6. Users can also add their own EPUB/PDF files via the app

  TO EXPAND:
  - Add more Archive.org direct download links for less common texts
  - Include links to specific public domain recordings of music
  - Link to museum APIs for high-res artwork images
  - Support adding user's own classical texts via file upload
*/
