// Classical Christian Education Complete Library
// Source: Classical Christian Education: Complete 12-Year Map
// Organized by category, tier, and stage

export interface PublicDomainSource {
  type: 'epub' | 'pdf' | 'html' | 'txt' | 'audio' | 'image';
  url: string;
  provider: string; // 'gutenberg', 'archive', 'wikimedia', 'youtube', etc.
}

export interface ClassicalLibraryItem {
  id: string;
  title: string;
  author: string;
  category: 'literature' | 'philosophy' | 'history' | 'mathematics' | 'science' | 'biography' | 'music' | 'art' | 'language' | 'theology';
  tier?: 1 | 2; // Tier 1 = core texts revisited 3x, Tier 2 = one thorough pass
  stage?: 'grammar' | 'logic' | 'rhetoric'; // Educational stage introduced
  grade?: number; // Specific grade level
  description: string;
  type: 'book' | 'music' | 'art' | 'resource';
  notes?: string;
  sources?: PublicDomainSource[]; // Public domain URLs
}

export const classicalLibrary: ClassicalLibraryItem[] = [
  // ============ TIER 1: CORE TEXTS ============
  // Scripture - The Base Layer
  {
    id: 'scripture-bible',
    title: 'The Bible',
    author: 'Various',
    category: 'theology',
    tier: 1,
    stage: 'grammar',
    grade: 0,
    type: 'book',
    description: 'Genesis, Exodus, Gospels, Epistles — encountered every year at rising depth; the text all others answer to.',
    notes: 'Foundation of the entire curriculum; revisited across all three stages',
    sources: [
      { type: 'html', url: 'https://www.gutenberg.org/ebooks/10', provider: 'gutenberg', },
      { type: 'txt', url: 'https://www.gutenberg.org/cache/epub/10/pg10.txt', provider: 'gutenberg' },
      { type: 'epub', url: 'https://www.gutenberg.org/cache/epub/10/pg10.epub', provider: 'gutenberg' }
    ]
  },

  // Literature - Christian-First Ordering
  {
    id: 'lit-homer-iliad',
    title: 'Iliad',
    author: 'Homer',
    category: 'literature',
    tier: 1,
    stage: 'grammar',
    grade: 4,
    type: 'book',
    description: 'The pagan root Christian writers absorbed and answered.',
    notes: 'Revisited in logic stage (6th gr.) for structure; rhetoric stage (10th gr.) for final synthesis',
    sources: [
      { type: 'html', url: 'https://www.gutenberg.org/ebooks/6150', provider: 'gutenberg' },
      { type: 'epub', url: 'https://www.gutenberg.org/cache/epub/6150/pg6150.epub', provider: 'gutenberg' },
      { type: 'txt', url: 'https://www.gutenberg.org/cache/epub/6150/pg6150.txt', provider: 'gutenberg' }
    ]
  },

  {
    id: 'lit-homer-odyssey',
    title: 'Odyssey',
    author: 'Homer',
    category: 'literature',
    tier: 1,
    stage: 'grammar',
    grade: 4,
    type: 'book',
    description: 'Companion to the Iliad; completes Homer\'s foundational works.',
    notes: 'Revisited in logic and rhetoric stages',
    sources: [
      { type: 'html', url: 'https://www.gutenberg.org/ebooks/1727', provider: 'gutenberg' },
      { type: 'epub', url: 'https://www.gutenberg.org/cache/epub/1727/pg1727.epub', provider: 'gutenberg' },
      { type: 'txt', url: 'https://www.gutenberg.org/cache/epub/1727/pg1727.txt', provider: 'gutenberg' }
    ]
  },

  {
    id: 'lit-el-poema-mio-cid',
    title: 'El Poema de Mio Cid',
    author: 'Anonymous',
    category: 'literature',
    tier: 1,
    stage: 'grammar',
    grade: 1,
    type: 'book',
    description: 'The Christian warrior-hero epic; foundational for understanding Christian heroism.',
    notes: 'Read aloud in grade 1; revisited at depth in rhetoric stage (9th gr.)'
  },

  {
    id: 'lit-dante-divine-comedy',
    title: 'The Divine Comedy',
    author: 'Dante Alighieri',
    category: 'literature',
    tier: 1,
    stage: 'grammar',
    grade: 4,
    type: 'book',
    description: 'The Christian cosmos; the answer to Homer. Images introduced through art in grade 4; studied in full in rhetoric stage (9th gr.).',
    notes: 'Sacred architecture of Christian worldview made poetic'
  },

  {
    id: 'lit-hagiography',
    title: 'Desert Fathers / Bede / Legenda Aurea',
    author: 'Various',
    category: 'literature',
    tier: 1,
    stage: 'grammar',
    grade: 0,
    type: 'book',
    description: 'Christian virtue narratives; bedtime stories that saturate the imagination with saints and martyrs.',
    notes: 'Age-appropriate selections in grammar stage; foundational for virtue formation'
  },

  {
    id: 'lit-foxe-book-of-martyrs',
    title: 'Book of Martyrs',
    author: 'John Foxe',
    category: 'literature',
    tier: 1,
    stage: 'grammar',
    grade: 2,
    type: 'book',
    description: 'The Protestant martyr narrative; age-appropriate selections in grammar stage.',
    notes: 'Revisited at depth in rhetoric stage (9th gr.)'
  },

  {
    id: 'lit-bunyan-pilgrims-progress',
    title: 'The Pilgrim\'s Progress',
    author: 'John Bunyan',
    category: 'literature',
    tier: 1,
    stage: 'grammar',
    grade: 0,
    type: 'book',
    description: 'The Protestant allegorical epic; the first fiction children know (children\'s edition in K).',
    notes: 'Foundational for understanding Christian journey as narrative'
  },

  {
    id: 'lit-shakespeare-hamlet',
    title: 'Hamlet',
    author: 'William Shakespeare',
    category: 'literature',
    tier: 1,
    stage: 'rhetoric',
    grade: 10,
    type: 'book',
    description: 'Peak literary synthesis; performed and analyzed in rhetoric stage.',
    notes: 'One soliloquy memorized in rhetoric stage for recitation'
  },

  {
    id: 'lit-chesterton-man-thursday',
    title: 'The Man Who Was Thursday',
    author: 'G.K. Chesterton',
    category: 'literature',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'book',
    description: 'Delight and wit tier — gravity and whimsy in the same sentence; fulfillment of "genuinely delightful, not just serious."',
    notes: 'Introduces joy as integral to Christian thought'
  },

  {
    id: 'lit-chesterton-father-brown',
    title: 'Father Brown Stories',
    author: 'G.K. Chesterton',
    category: 'literature',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'book',
    description: 'Detective stories embodying Christian virtue and wisdom.',
    notes: 'Part of the delight/wit tier'
  },

  // Philosophy & Theology - Tier 1
  {
    id: 'phil-plato-republic',
    title: 'Republic',
    author: 'Plato',
    category: 'philosophy',
    tier: 1,
    stage: 'logic',
    grade: 7,
    type: 'book',
    description: 'Justice, virtue, and the ideal state; foundational for Western thought.',
    notes: 'Logic stage: analyze; revisited in rhetoric stage'
  },

  {
    id: 'phil-aristotle-ethics',
    title: 'Nicomachean Ethics',
    author: 'Aristotle',
    category: 'philosophy',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'book',
    description: 'Virtue analyzed through practical wisdom (phronesis); the foundation of virtue ethics.',
    notes: 'Grade 6: virtue analyzed, not just admired'
  },

  {
    id: 'phil-aristotle-metaphysics',
    title: 'Metaphysics',
    author: 'Aristotle',
    category: 'philosophy',
    tier: 1,
    stage: 'rhetoric',
    grade: 9,
    type: 'book',
    description: 'Being and substance; what exists and why.',
    notes: 'Studied alongside Aquinas in rhetoric stage'
  },

  {
    id: 'phil-aristotle-politics',
    title: 'Politics',
    author: 'Aristotle',
    category: 'philosophy',
    tier: 1,
    stage: 'logic',
    grade: 8,
    type: 'book',
    description: 'Authority belongs at the smallest competent level (subsidiarity); organizing principle for federalism.',
    notes: 'Explicit naming of subsidiarity principle'
  },

  {
    id: 'phil-augustine-confessions',
    title: 'Confessions',
    author: 'Augustine of Hippo',
    category: 'philosophy',
    tier: 1,
    stage: 'logic',
    grade: 7,
    type: 'book',
    description: 'Autobiographical theology; the Christian journey of conversion and understanding.',
    notes: 'Read in Latin in rhetoric stage (Augustine\'s prose as peak stylized writing)'
  },

  {
    id: 'phil-augustine-city-of-god',
    title: 'City of God',
    author: 'Augustine of Hippo',
    category: 'philosophy',
    tier: 1,
    stage: 'logic',
    grade: 8,
    type: 'book',
    description: 'Two cities thesis; Christian interpretation of history.',
    notes: 'Excerpts in logic stage; capstone essay in rhetoric: "How does Augustine\'s City of God explain the American Founding?"'
  },

  {
    id: 'phil-aquinas-summa',
    title: 'Summa Theologiae (Key Questions)',
    author: 'Thomas Aquinas',
    category: 'theology',
    tier: 1,
    stage: 'rhetoric',
    grade: 9,
    type: 'book',
    description: 'Systematic theology; synthesis of Aristotle and Christian thought.',
    notes: 'Grade 9: key questions; studied alongside Aristotle\'s Metaphysics'
  },

  {
    id: 'phil-descartes-meditations',
    title: 'Meditations',
    author: 'René Descartes',
    category: 'philosophy',
    tier: 1,
    stage: 'rhetoric',
    grade: 10,
    type: 'book',
    description: 'Method and certainty; the philosophical turn toward the subject.',
    notes: 'Studied in rhetoric stage'
  },

  {
    id: 'phil-kant-critique',
    title: 'Critique of Pure Reason (via Prolegomena)',
    author: 'Immanuel Kant',
    category: 'philosophy',
    tier: 1,
    stage: 'rhetoric',
    grade: 11,
    type: 'book',
    description: 'Modernity\'s strongest intellectual framework; encounter as real opponent for Christian worldview.',
    notes: 'Grade 11: via Prolegomena; Grade 12: completed. Paired with Chesterton\'s Orthodoxy'
  },

  // History & Politics - Tier 1
  {
    id: 'hist-thucydides-war',
    title: 'History of the Peloponnesian War',
    author: 'Thucydides',
    category: 'history',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'book',
    description: 'Power dynamics; the Melian Dialogue — power dissected.',
    notes: 'Grade 6 for power analysis; revisited in logic stage for structure analysis; part of "why civilizations fall" unit (8th gr.)'
  },

  {
    id: 'hist-locke-second-treatise',
    title: 'Second Treatise of Government',
    author: 'John Locke',
    category: 'history',
    tier: 1,
    stage: 'rhetoric',
    grade: 11,
    type: 'book',
    description: 'Natural rights and property; foundation for American political theory.',
    notes: 'Part of the full founding argument (grades 11-12)'
  },

  {
    id: 'hist-federalist-papers',
    title: 'The Federalist Papers',
    author: 'Hamilton, Madison, Jay',
    category: 'history',
    tier: 1,
    stage: 'rhetoric',
    grade: 11,
    type: 'book',
    description: 'Defense of the Constitution; essays 10, 51, and 78 emphasized.',
    notes: 'Full founding argument, both sides (esp. Anti-Federalist Papers for balance)'
  },

  {
    id: 'hist-declaration-constitution',
    title: 'Declaration of Independence & U.S. Constitution',
    author: 'Various',
    category: 'history',
    tier: 1,
    stage: 'rhetoric',
    grade: 11,
    type: 'book',
    description: 'Founding documents; the American political experiment.',
    notes: 'Grade 11: full founding argument'
  },

  // Mathematics & Music - Tier 1
  {
    id: 'math-euclid-elements',
    title: 'Elements',
    author: 'Euclid',
    category: 'mathematics',
    tier: 1,
    stage: 'grammar',
    grade: 1,
    type: 'book',
    description: 'Geometry as hands-on shapes in grammar; as formal proof in logic; as argument-form in rhetoric.',
    notes: 'Three passes: grammar (intuitive), logic (formal), rhetoric (argumentative)'
  },

  {
    id: 'music-bach-wtc',
    title: 'Well-Tempered Clavier',
    author: 'Johann Sebastian Bach',
    category: 'music',
    tier: 1,
    stage: 'grammar',
    grade: 0,
    type: 'music',
    description: 'Performed and studied (not just listened to); Bach as musical foundation.',
    notes: 'Performed in midmorning music slot; studied for harmony later'
  },

  {
    id: 'music-bach-goldberg',
    title: 'Goldberg Variations',
    author: 'Johann Sebastian Bach',
    category: 'music',
    tier: 1,
    stage: 'grammar',
    grade: 0,
    type: 'music',
    description: 'Performed; Bach\'s systematic exploration of variations.',
    notes: 'Performance-based, not theoretical'
  },

  {
    id: 'music-bach-brandenburg',
    title: 'Brandenburg Concertos',
    author: 'Johann Sebastian Bach',
    category: 'music',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'music',
    description: 'Studied in depth for musical structure.',
    notes: 'Part of Tier 2 arts but sometimes approached as Tier 1 depending on stage'
  },

  {
    id: 'music-bach-mass-b-minor',
    title: 'Mass in B Minor',
    author: 'Johann Sebastian Bach',
    category: 'music',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'music',
    description: 'Theological music; integration of faith and composition.',
    notes: 'Studied in Tier 2 arts sequence'
  },

  // Biography - The Great Men Track - Tier 1
  {
    id: 'bio-plutarch-parallel-lives',
    title: 'Parallel Lives',
    author: 'Plutarch',
    category: 'biography',
    tier: 1,
    stage: 'grammar',
    grade: 0,
    type: 'book',
    description: 'Simplified Plutarch lives in grammar; revisited in logic; paired-lives comparison in logic stage.',
    notes: 'Archetype-generating text; three passes across stages'
  },

  {
    id: 'bio-einhard-charlemagne',
    title: 'Life of Charlemagne',
    author: 'Einhard',
    category: 'biography',
    tier: 1,
    stage: 'logic',
    grade: 7,
    type: 'book',
    description: 'Medieval biography; model ruler and Christian leader.',
    notes: 'Logic stage biography study'
  },

  {
    id: 'bio-washington-george',
    title: 'George Washington',
    author: 'Various biographies',
    category: 'biography',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'book',
    description: 'Six American Archetypes: The engineer-statesman-warrior ideal.',
    notes: 'Presidential spine begins; grade 6-7; hero archetype'
  },

  {
    id: 'bio-lincoln-abraham',
    title: 'Abraham Lincoln',
    author: 'Various biographies',
    category: 'biography',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'book',
    description: 'Six American Archetypes: Lincoln the rail-splitter; self-made man.',
    notes: 'Presidential spine; grade 7-9; Gettysburg Address & Second Inaugural memorized'
  },

  {
    id: 'bio-washington-carver-george',
    title: 'George Washington Carver',
    author: 'Various biographies',
    category: 'biography',
    tier: 1,
    stage: 'grammar',
    grade: 4,
    type: 'book',
    description: 'Six American Archetypes: Carver\'s plants and agrarian science.',
    notes: 'Represents the Carver standard: stewardship and scientific understanding'
  },

  {
    id: 'bio-washington-booker-t',
    title: 'Booker T. Washington',
    author: 'Various biographies',
    category: 'biography',
    tier: 1,
    stage: 'grammar',
    grade: 4,
    type: 'book',
    description: 'Six American Archetypes: Industrial education and self-reliance.',
    notes: 'Model of education and enterprise'
  },

  {
    id: 'bio-edwards-jonathan',
    title: 'Jonathan Edwards',
    author: 'Various biographies',
    category: 'biography',
    tier: 1,
    stage: 'grammar',
    grade: 4,
    type: 'book',
    description: 'Six American Archetypes: Theologian and preacher.',
    notes: 'His marriage to Sarah as standout model for courtship curriculum'
  },

  {
    id: 'bio-massie-thomas',
    title: 'Thomas Massie (Living Example)',
    author: 'Contemporary',
    category: 'biography',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'book',
    description: 'Engineer-farmer-statesman; how technical skill + business acumen creates independence.',
    notes: 'Living archetype; represents Massie standard for self-sufficiency'
  },

  // ============ TIER 2: CONTEXT TEXTS (One thorough pass) ============
  // Literature & Myth
  {
    id: 'lit-beowulf',
    title: 'Beowulf',
    author: 'Anonymous',
    category: 'literature',
    tier: 2,
    stage: 'grammar',
    grade: 3,
    type: 'book',
    description: 'Anglo-Saxon heroic epic; warrior virtue and mortality.',
    notes: 'Nap-time audio in grammar stage; analyzed in later stages'
  },

  {
    id: 'lit-norse-eddas',
    title: 'Norse Eddas',
    author: 'Anonymous',
    category: 'literature',
    tier: 2,
    stage: 'grammar',
    grade: 2,
    type: 'book',
    description: 'Pre-Christian mythology; wonder and myth as context.',
    notes: 'Nap-time audio (Grimm + Norse); non-Christian context essential'
  },

  {
    id: 'lit-malory-morte',
    title: 'Morte d\'Arthur',
    author: 'Thomas Malory',
    category: 'literature',
    tier: 2,
    stage: 'grammar',
    grade: 3,
    type: 'book',
    description: 'Arthurian legend; Christian knight ideals.',
    notes: 'Nap-time audio in grammar stage as story'
  },

  {
    id: 'lit-malory-gawain',
    title: 'Sir Gawain and the Green Knight',
    author: 'Anonymous (trans. Malory)',
    category: 'literature',
    tier: 2,
    stage: 'grammar',
    grade: 3,
    type: 'book',
    description: 'Virtue tested; Christian courage.',
    notes: 'Companion to Morte d\'Arthur'
  },

  {
    id: 'lit-grimm-fairy-tales',
    title: 'Grimm\'s Fairy Tales',
    author: 'Brothers Grimm',
    category: 'literature',
    tier: 2,
    stage: 'grammar',
    grade: 2,
    type: 'book',
    description: 'Archetypal stories; moral instruction through narrative.',
    notes: 'Nap-time audio; foundational for imagination'
  },

  {
    id: 'lit-sophocles-oedipus',
    title: 'Oedipus Rex',
    author: 'Sophocles',
    category: 'literature',
    tier: 2,
    stage: 'logic',
    grade: 6,
    type: 'book',
    description: 'Greek tragedy; fate and knowledge.',
    notes: 'Logic stage analysis'
  },

  {
    id: 'lit-tolkien-lotr',
    title: 'The Lord of the Rings',
    author: 'J.R.R. Tolkien',
    category: 'literature',
    tier: 2,
    stage: 'grammar',
    grade: 2,
    type: 'book',
    description: 'Christian-authored myth without overt allegory; nap-time audio.',
    notes: 'Already in family use via nap-time audio; foundational for Tier 2'
  },

  {
    id: 'lit-narnia-lion-witch',
    title: 'The Lion, the Witch and the Wardrobe',
    author: 'C.S. Lewis',
    category: 'literature',
    tier: 2,
    stage: 'grammar',
    grade: 1,
    type: 'book',
    description: 'Christian allegory; imagination and virtue.',
    notes: 'Part of nap-time audio rotation'
  },

  // History & Politics - Tier 2
  {
    id: 'hist-gibbon-decline-fall',
    title: 'Decline and Fall of the Roman Empire',
    author: 'Edward Gibbon',
    category: 'history',
    tier: 2,
    stage: 'logic',
    grade: 8,
    type: 'book',
    description: 'Civilization and collapse; why empires fail.',
    notes: 'Part of "why civilizations fall" unit'
  },

  {
    id: 'hist-machiavelli-prince',
    title: 'The Prince',
    author: 'Niccolò Machiavelli',
    category: 'history',
    tier: 2,
    stage: 'logic',
    grade: 7,
    type: 'book',
    description: 'Power and politics; political realism.',
    notes: 'Logic stage; encountered as real political philosophy'
  },

  {
    id: 'hist-hobbes-leviathan',
    title: 'Leviathan',
    author: 'Thomas Hobbes',
    category: 'history',
    tier: 2,
    stage: 'rhetoric',
    grade: 11,
    type: 'book',
    description: 'Absolute authority and the social contract.',
    notes: 'Rhetoric stage; paired with Locke in founding argument'
  },

  {
    id: 'hist-tocqueville-democracy',
    title: 'Democracy in America',
    author: 'Alexis de Tocqueville',
    category: 'history',
    tier: 2,
    stage: 'logic',
    grade: 8,
    type: 'book',
    description: 'American character and democratic culture.',
    notes: 'Grade 8 (Jackson/mass democracy unit); Grade 12 (capstone lens)'
  },

  {
    id: 'hist-anti-federalist-papers',
    title: 'The Anti-Federalist Papers',
    author: 'Brutus et al.',
    category: 'history',
    tier: 2,
    stage: 'rhetoric',
    grade: 11,
    type: 'book',
    description: 'Opposition to centralized power; both sides of founding argument.',
    notes: 'Brutus selections; balance to Federalist Papers'
  },

  {
    id: 'hist-washington-farewell',
    title: 'Washington\'s Farewell Address',
    author: 'George Washington',
    category: 'history',
    tier: 2,
    stage: 'rhetoric',
    grade: 11,
    type: 'book',
    description: 'Warnings about factionalism and foreign entanglement.',
    notes: 'Rhetoric stage founding argument'
  },

  {
    id: 'hist-lincoln-gettysburg',
    title: 'Gettysburg Address',
    author: 'Abraham Lincoln',
    category: 'history',
    tier: 2,
    stage: 'rhetoric',
    grade: 9,
    type: 'book',
    description: 'National purpose and equality; memorized.',
    notes: 'Short and powerful; memorized in grade 9'
  },

  {
    id: 'hist-lincoln-second-inaugural',
    title: 'Second Inaugural Address',
    author: 'Abraham Lincoln',
    category: 'history',
    tier: 2,
    stage: 'rhetoric',
    grade: 9,
    type: 'book',
    description: 'Providence and judgment; theological address.',
    notes: 'Memorized in grade 9'
  },

  {
    id: 'hist-wilson-critique',
    title: 'Constitutional Critiques & Second Bill of Rights (1944)',
    author: 'Woodrow Wilson & Franklin D. Roosevelt',
    category: 'history',
    tier: 2,
    stage: 'rhetoric',
    grade: 10,
    type: 'book',
    description: 'The collectivist turn in its own words; modernity\'s case.',
    notes: 'Grade 10 (FDR unit); Grade 11 (Reagan/counterswing)'
  },

  {
    id: 'hist-addison-cato',
    title: 'Cato: A Tragedy',
    author: 'Joseph Addison',
    category: 'literature',
    tier: 2,
    stage: 'rhetoric',
    grade: 11,
    type: 'book',
    description: 'Play directly responsible for founding-era rhetoric; Patrick Henry\'s "give me liberty or give me death" and Nathan Hale drawn from this text.',
    notes: '1712 play; rhetorical foundation of American founding'
  },

  // Philosophy & Science - Tier 2
  {
    id: 'phil-smith-wealth-of-nations',
    title: 'The Wealth of Nations',
    author: 'Adam Smith',
    category: 'philosophy',
    tier: 2,
    stage: 'logic',
    grade: 7,
    type: 'book',
    description: 'Political economy; division of labor and markets.',
    notes: 'Studied in rhetoric stage (grade 11)'
  },

  {
    id: 'phil-belloc-servile-state',
    title: 'The Servile State',
    author: 'Hilaire Belloc',
    category: 'philosophy',
    tier: 2,
    stage: 'logic',
    grade: 7,
    type: 'book',
    description: 'Distributist counterweight to Smith; widespread ownership vs. concentrated capital.',
    notes: 'Formal theory for agrarian track and Jefferson-over-Hamilton assumption'
  },

  {
    id: 'sci-newton-principia',
    title: 'Principia Mathematica',
    author: 'Isaac Newton',
    category: 'mathematics',
    tier: 2,
    stage: 'logic',
    grade: 7,
    type: 'book',
    description: 'Mathematical physics; Newton\'s method.',
    notes: 'Grade 8 (Newton\'s method); Grade 10 (Principia + calculus); foundations of modern physics'
  },

  {
    id: 'sci-darwin-origin',
    title: 'On the Origin of Species',
    author: 'Charles Darwin',
    category: 'science',
    tier: 2,
    stage: 'rhetoric',
    grade: 11,
    type: 'book',
    description: 'Evolution and natural selection; clash with biblical frame discussed openly.',
    notes: 'Grade 11: encountered as real intellectual challenge, not strawman'
  },

  {
    id: 'math-descartes-geometry',
    title: 'La Géométrie',
    author: 'René Descartes',
    category: 'mathematics',
    tier: 2,
    stage: 'logic',
    grade: 7,
    type: 'book',
    description: 'Coordinate geometry; bridge between algebra and Euclid.',
    notes: 'Foundation for algebra → coordinate bridge'
  },

  {
    id: 'math-newton-leibniz-calculus',
    title: 'Calculus (Newton-Leibniz Development)',
    author: 'Isaac Newton & Gottfried Leibniz',
    category: 'mathematics',
    tier: 2,
    stage: 'rhetoric',
    grade: 9,
    type: 'book',
    description: 'Foundations of calculus; mathematical infinity and rates of change.',
    notes: 'Grade 9-10: calculus foundations and study'
  },

  {
    id: 'phil-chesterton-orthodoxy',
    title: 'Orthodoxy',
    author: 'G.K. Chesterton',
    category: 'philosophy',
    tier: 2,
    stage: 'rhetoric',
    grade: 11,
    type: 'book',
    description: 'Apologetics; the case that the Christian story is most reasonable.',
    notes: 'Paired with Kant/Darwin/Marx as modernity\'s strongest case'
  },

  // ============ SPECIALIZED GRAMMARS (Delivery: tutor or parent-led) ============
  {
    id: 'lang-cicero-de-oratore',
    title: 'De Oratore',
    author: 'Cicero',
    category: 'language',
    tier: 1,
    stage: 'rhetoric',
    grade: 9,
    type: 'book',
    description: 'Rhetoric as art; oratory and persuasion.',
    notes: 'Parent-led; rhetoric stage'
  },

  {
    id: 'lang-ward-oratory',
    title: 'A System of Oratory (1759)',
    author: 'John Ward',
    category: 'language',
    tier: 1,
    stage: 'rhetoric',
    grade: 9,
    type: 'book',
    description: 'Declamation practice; posture, gesture, elocution, pacing. Used at Harvard/Yale to train founders\' generation.',
    notes: 'Parent-led; rhetoric stage; physical delivery of speech'
  },

  {
    id: 'law-blackstone-commentaries',
    title: 'Commentaries on the Laws of England',
    author: 'William Blackstone',
    category: 'history',
    tier: 1,
    stage: 'rhetoric',
    grade: 11,
    type: 'book',
    description: 'Legal foundation; common law traditions.',
    notes: 'Parent-led; rhetoric stage; paired with administrative drafting'
  },

  {
    id: 'geo-strabo-geographica',
    title: 'Geographica',
    author: 'Strabo',
    category: 'history',
    tier: 1,
    stage: 'logic',
    grade: 8,
    type: 'book',
    description: 'Geography and peoples; world context.',
    notes: 'Parent-led; logic stage'
  },

  {
    id: 'mil-clausewitz-war',
    title: 'On War',
    author: 'Carl von Clausewitz',
    category: 'history',
    tier: 1,
    stage: 'logic',
    grade: 8,
    type: 'book',
    description: 'Military strategy and principles; fog of war.',
    notes: 'Parent-led; logic stage'
  },

  {
    id: 'arch-vitruvius',
    title: 'De architectura (On Architecture)',
    author: 'Vitruvius',
    category: 'art',
    tier: 1,
    stage: 'rhetoric',
    grade: 10,
    type: 'book',
    description: 'Classical architecture; proportion and principles.',
    notes: 'Parent-led; rhetoric stage'
  },

  {
    id: 'arch-suger',
    title: 'On the Abbot Church (writings on architecture)',
    author: 'Abbot Suger',
    category: 'art',
    tier: 1,
    stage: 'rhetoric',
    grade: 10,
    type: 'book',
    description: 'Gothic architecture; light and sacred space.',
    notes: 'Parent-led; rhetoric stage'
  },

  {
    id: 'mus-rameau-harmony',
    title: 'Treatise on Harmony',
    author: 'Jean-Philippe Rameau',
    category: 'music',
    tier: 1,
    stage: 'logic',
    grade: 8,
    type: 'book',
    description: 'Music theory; harmonic principles.',
    notes: 'Tutor; logic stage; grammar under the Bach they perform'
  },

  {
    id: 'mus-boethius-musica',
    title: 'De Institutione Musica (Fundamentals of Music)',
    author: 'Boethius',
    category: 'music',
    tier: 1,
    stage: 'logic',
    grade: 8,
    type: 'book',
    description: 'Quadrivial music; string ratios, proportion, monochord.',
    notes: 'Tutor, alongside piano tutor; logic stage'
  },

  {
    id: 'theo-augustine-doctrine',
    title: 'On Christian Doctrine',
    author: 'Augustine of Hippo',
    category: 'theology',
    tier: 1,
    stage: 'rhetoric',
    grade: 9,
    type: 'book',
    description: 'Biblical hermeneutics; how to interpret Scripture.',
    notes: 'Parent-led; rhetoric stage'
  },

  {
    id: 'theo-ames-medulla',
    title: 'Medulla Theologiae (1623)',
    author: 'William Ames',
    category: 'theology',
    tier: 1,
    stage: 'rhetoric',
    grade: 9,
    type: 'book',
    description: 'Reformed systematic theology; textbook used at Harvard/Yale.',
    notes: 'Rhetoric stage; fits confessional instincts (Reformed/Baptist)'
  },

  // Languages (Master Keys)
  {
    id: 'lang-wheelock-latin',
    title: 'Wheelock\'s Latin',
    author: 'Frederic M. Wheelock',
    category: 'language',
    tier: 1,
    stage: 'grammar',
    grade: 0,
    type: 'book',
    description: 'Latin primer for K-8; foundation for language mastery.',
    notes: 'Daily practice; most of Tier 1 depends on it'
  },

  {
    id: 'lang-vulgate',
    title: 'Vulgate (Latin Bible)',
    author: 'Jerome',
    category: 'language',
    tier: 1,
    stage: 'grammar',
    grade: 1,
    type: 'book',
    description: 'Narrative with already-known content; bridge to reading Latin prose.',
    notes: 'Content already familiar from Bible study'
  },

  {
    id: 'lang-juvencus-evangelia',
    title: 'Evangeliorum Libri Quattuor',
    author: 'Juvencus',
    category: 'language',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'book',
    description: 'Gospel in Latin epic meter; logic stage; epic register.',
    notes: 'Classical training progression'
  },

  {
    id: 'lang-cicero-speeches',
    title: 'Cicero\'s Speeches (Oratorical Prose)',
    author: 'Cicero',
    category: 'language',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'book',
    description: 'Latin as living speech; oratorical mastery.',
    notes: 'Logic stage mastery track'
  },

  {
    id: 'lang-augustine-confessions-latin',
    title: 'Confessions (in Latin)',
    author: 'Augustine of Hippo',
    category: 'language',
    tier: 1,
    stage: 'rhetoric',
    grade: 9,
    type: 'book',
    description: 'Peak stylized prose; rhetoric stage capstone.',
    notes: 'Rhetoric stage Latin mastery'
  },

  {
    id: 'lang-greek-mounce',
    title: 'Basics of Biblical Greek',
    author: 'William D. Mounce',
    category: 'language',
    tier: 1,
    stage: 'logic',
    grade: 8,
    type: 'book',
    description: 'Koine Greek reading fluency (not composition); alphabet delayed to ~age 8-9.',
    notes: 'Weekly tutor; avoid cross-script confusion by delaying to logic stage'
  },

  {
    id: 'lang-greek-nt',
    title: 'New Testament (Greek)',
    author: 'Various',
    category: 'language',
    tier: 1,
    stage: 'logic',
    grade: 8,
    type: 'book',
    description: 'Greek reading fluency via NT and Church Fathers.',
    notes: 'Weekly tutor; logic stage onward'
  },

  {
    id: 'lang-hebrew-pratico',
    title: 'Basics of Biblical Hebrew',
    author: 'Gary D. Pratico & Miles V. Van Pelt',
    category: 'language',
    tier: 1,
    stage: 'logic',
    grade: 8,
    type: 'book',
    description: 'Biblical Hebrew reading fluency (not composition); right-to-left script delayed to ~age 8-9.',
    notes: 'Weekly tutor; logic stage onward; delayed for same reasons as Greek'
  },

  {
    id: 'lang-hebrew-tanakh',
    title: 'Tanakh (Hebrew Bible)',
    author: 'Various',
    category: 'language',
    tier: 1,
    stage: 'logic',
    grade: 8,
    type: 'book',
    description: 'Hebrew reading via Psalms and OT.',
    notes: 'Weekly tutor; once English writing is solid'
  },

  // Warrior-Defender Reads (Family Read-Alouds)
  {
    id: 'read-defenders-west',
    title: 'Defenders of the West',
    author: 'Various',
    category: 'literature',
    tier: 2,
    stage: 'grammar',
    grade: 0,
    type: 'book',
    description: 'Christian warrior-defenders; accounts of faith under pressure.',
    notes: 'Family read-alouds; summer read (needs less structure)'
  },

  {
    id: 'read-sword-scimitar',
    title: 'The Sword and the Scimitar',
    author: 'James Reston Jr.',
    category: 'literature',
    tier: 2,
    stage: 'grammar',
    grade: 0,
    type: 'book',
    description: 'Crusades and Christian-Islamic conflict; historical courage.',
    notes: 'Family read-alouds; ongoing'
  },

  {
    id: 'read-scanderbeg',
    title: 'Scanderbeg (Historical Accounts)',
    author: 'Various',
    category: 'biography',
    tier: 2,
    stage: 'grammar',
    grade: 0,
    type: 'book',
    description: 'Albanian hero; defense of Christendom.',
    notes: 'Family read-alouds'
  },

  {
    id: 'read-ferdinand-saint',
    title: 'Saint Ferdinand (Historical Accounts)',
    author: 'Various',
    category: 'biography',
    tier: 2,
    stage: 'grammar',
    grade: 0,
    type: 'book',
    description: 'Spanish king; Christian conquest and civilization.',
    notes: 'Family read-alouds'
  },

  {
    id: 'read-templars',
    title: 'The Templars & Hospitallers (Historical Accounts)',
    author: 'Various',
    category: 'history',
    tier: 2,
    stage: 'grammar',
    grade: 0,
    type: 'book',
    description: 'Military orders; faith and defense.',
    notes: 'Family read-alouds; ongoing warrior-defender series'
  },

  // ============ SACRED ARTS SEQUENCE ============
  {
    id: 'art-gregorian-chant',
    title: 'Gregorian Chant',
    author: 'Various',
    category: 'music',
    tier: 1,
    stage: 'grammar',
    grade: 0,
    type: 'music',
    description: 'Sacred sung prayer; foundational liturgical music.',
    notes: 'Experienced and sung; grammar stage onward'
  },

  {
    id: 'art-notre-dame-school',
    title: 'Notre Dame School (Medieval Polyphony)',
    author: 'Various',
    category: 'music',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'music',
    description: 'Early polyphony; sacred vocal music.',
    notes: 'Tier 2 arts sequence'
  },

  {
    id: 'art-palestrina-papae-marcelli',
    title: 'Missa Papae Marcelli',
    author: 'Giovanni Pierluigi da Palestrina',
    category: 'music',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'music',
    description: 'Renaissance sacred music; clarity and devotion.',
    notes: 'Tier 2 arts sequence'
  },

  {
    id: 'art-byzantine-icons',
    title: 'Byzantine Icons (Rublev\'s Trinity)',
    author: 'Andrei Rublev & others',
    category: 'art',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'art',
    description: 'Sacred visual theology; icon veneration.',
    notes: 'Tier 2 arts sequence; opening of sacred-art progression'
  },

  {
    id: 'art-christ-pantocrator',
    title: 'Christ Pantocrator (Saint Catherine\'s Monastery)',
    author: 'Unknown (Byzantine, 6th century)',
    category: 'art',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'art',
    description: 'The oldest surviving icon of Christ; sacred visual theology.',
    notes: 'Tier 2 arts sequence; Byzantine icon progression'
  },

  {
    id: 'art-theotokos-of-vladimir',
    title: 'Theotokos of Vladimir',
    author: 'Unknown (Byzantine, 12th century)',
    category: 'art',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'art',
    description: 'One of the most venerated Marian icons in Orthodox Christianity; tenderness (Eleusa) iconography.',
    notes: 'Tier 2 arts sequence; Byzantine icon progression'
  },

  {
    id: 'art-hagia-sophia-mosaics',
    title: 'Hagia Sophia Mosaics',
    author: 'Various (Byzantine)',
    category: 'art',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'art',
    description: 'Byzantine mosaic art at its height; sacred architecture and image united.',
    notes: 'Tier 2 arts sequence; Byzantine icon progression'
  },

  {
    id: 'art-giotto-scrovegni',
    title: 'Giotto (Scrovegni Chapel)',
    author: 'Giotto di Bondone',
    category: 'art',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'art',
    description: 'Early Renaissance; narrative painting; emotion and space.',
    notes: 'Tier 2 arts sequence; second stage of sacred-art progression'
  },

  {
    id: 'art-fra-angelico-annunciation',
    title: 'Fra Angelico (Annunciation)',
    author: 'Fra Angelico',
    category: 'art',
    tier: 1,
    stage: 'rhetoric',
    grade: 10,
    type: 'art',
    description: 'Renaissance sacred art; light and transcendence.',
    notes: 'Rhetoric stage; third stage of sacred-art sequence'
  },

  {
    id: 'art-michelangelo-sistine',
    title: 'Michelangelo (Sistine Chapel Ceiling)',
    author: 'Michelangelo Buonarroti',
    category: 'art',
    tier: 1,
    stage: 'rhetoric',
    grade: 10,
    type: 'art',
    description: 'Renaissance apex; human form as image of God.',
    notes: 'Rhetoric stage; sacred-art sequence'
  },

  {
    id: 'art-michelangelo-pieta',
    title: 'Michelangelo (Pietà)',
    author: 'Michelangelo Buonarroti',
    category: 'art',
    tier: 1,
    stage: 'rhetoric',
    grade: 10,
    type: 'art',
    description: 'Suffering and compassion; marble carved to tenderness.',
    notes: 'Rhetoric stage; sacred-art sequence'
  },

  {
    id: 'art-michelangelo-david',
    title: 'Michelangelo (David)',
    author: 'Michelangelo Buonarroti',
    category: 'art',
    tier: 1,
    stage: 'rhetoric',
    grade: 10,
    type: 'art',
    description: 'Courage and youth; the perfect Christian warrior.',
    notes: 'Rhetoric stage; sacred-art sequence'
  },

  {
    id: 'art-greco-roman-sculpture',
    title: 'Greco-Roman Sculpture',
    author: 'Various',
    category: 'art',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'art',
    description: 'Classical ideals; form and proportion.',
    notes: 'Tier 2 arts sequence; foundation for progression'
  },

  {
    id: 'art-gothic-cathedral-sculpture',
    title: 'Gothic Cathedral Sculpture (Chartres, Reims)',
    author: 'Various',
    category: 'art',
    tier: 1,
    stage: 'logic',
    grade: 6,
    type: 'art',
    description: 'Sacred architecture; saints and biblical narrative in stone.',
    notes: 'Tier 2 arts sequence; Chartres and Reims as primary examples'
  },

  // ============ SUPPLEMENTARY & PRACTICAL TEXTS ============
  {
    id: 'supp-washington-rules-civility',
    title: 'Rules of Civility & Decent Behaviour',
    author: 'George Washington',
    category: 'literature',
    tier: 2,
    stage: 'rhetoric',
    grade: 11,
    type: 'book',
    description: 'Etiquette and character; copied at age 16 (right age for rhetoric stage).',
    notes: 'Rhetoric stage; foundation for courtship/household curriculum'
  },

  {
    id: 'supp-proverbs-31',
    title: 'Proverbs 31 (Biblical Womanhood)',
    author: 'Solomon',
    category: 'theology',
    tier: 1,
    stage: 'rhetoric',
    grade: 11,
    type: 'book',
    description: 'Virtue and enterprise; biblical economics.',
    notes: 'Studied seriously in rhetoric stage (grade 11)'
  },

  {
    id: 'supp-baxter-household',
    title: 'Household Writings',
    author: 'Richard Baxter',
    category: 'theology',
    tier: 1,
    stage: 'rhetoric',
    grade: 11,
    type: 'book',
    description: 'Marriage and oikonomia (household management).',
    notes: 'Courtship/household curriculum (rhetoric stage)'
  },

  {
    id: 'supp-genesis-ephesians',
    title: 'Genesis 2 & Ephesians 5',
    author: 'Scripture',
    category: 'theology',
    tier: 1,
    stage: 'rhetoric',
    grade: 11,
    type: 'book',
    description: 'Marriage theology; biblical foundation.',
    notes: 'Rhetoric stage courtship curriculum'
  },

  {
    id: 'supp-quran',
    title: 'The Quran',
    author: 'Muhammad (Islamic tradition)',
    category: 'theology',
    tier: 1,
    stage: 'logic',
    grade: 8,
    type: 'book',
    description: 'Islamic primary source; honest engagement with non-Christian texts.',
    notes: 'Parent-led; logic stage; source-based (not antagonistic)'
  },

  {
    id: 'supp-islamic-golden-age',
    title: 'Islamic Golden Age Unit (Primary Sources)',
    author: 'Various',
    category: 'history',
    tier: 1,
    stage: 'logic',
    grade: 8,
    type: 'book',
    description: 'Non-Western civilization; intellectual achievements.',
    notes: 'Logic stage; paired with Quran study'
  },

  // ============ MEMORIZATION TEXTS (Performed, Not Just Studied) ============
  {
    id: 'mem-kipling-if',
    title: 'If—',
    author: 'Rudyard Kipling',
    category: 'literature',
    tier: 2,
    stage: 'grammar',
    grade: 5,
    type: 'book',
    description: 'One poem per year performed at Christmas; starts with "If—".',
    notes: 'Christmas poem performance begins; memorized and recited'
  },

  {
    id: 'mem-hamlet-soliloquy',
    title: 'Hamlet Soliloquies (Memorized)',
    author: 'William Shakespeare',
    category: 'literature',
    tier: 1,
    stage: 'rhetoric',
    grade: 10,
    type: 'book',
    description: 'One Hamlet soliloquy memorized and performed.',
    notes: 'Rhetoric stage memorization'
  },

  {
    id: 'mem-homer-invocation',
    title: 'Homer\'s Invocation (Memorized)',
    author: 'Homer',
    category: 'literature',
    tier: 1,
    stage: 'rhetoric',
    grade: 9,
    type: 'book',
    description: 'One passage per major text, learned during that unit.',
    notes: 'Rhetoric stage'
  },

  {
    id: 'mem-psalms-family-melodies',
    title: 'Psalms (Memorized with Family Melodies)',
    author: 'David / Biblical Authors',
    category: 'theology',
    tier: 1,
    stage: 'grammar',
    grade: 1,
    type: 'book',
    description: 'Psalms memorized by composing original family melodies; singing is highest-retention memory tool.',
    notes: 'Ongoing across all stages; through Psalm 16 documented'
  },

  {
    id: 'mem-ten-commandments',
    title: 'Ten Commandments (Memorized)',
    author: 'Scripture',
    category: 'theology',
    tier: 1,
    stage: 'grammar',
    grade: 3,
    type: 'book',
    description: 'Foundational moral framework; memorized in grade 3.',
    notes: 'Grammar stage memorization'
  },

  {
    id: 'mem-beatitudes',
    title: 'Beatitudes (Memorized)',
    author: 'Jesus (Gospel)',
    category: 'theology',
    tier: 1,
    stage: 'grammar',
    grade: 3,
    type: 'book',
    description: 'Jesus\'s ethical teaching; memorized in grade 3.',
    notes: 'Grammar stage memorization'
  },

  {
    id: 'mem-lords-prayer',
    title: 'Lord\'s Prayer (Memorized)',
    author: 'Jesus (Gospel)',
    category: 'theology',
    tier: 1,
    stage: 'grammar',
    grade: 3,
    type: 'book',
    description: 'Daily prayer; memorized in grade 3.',
    notes: 'Grammar stage; used daily in household rhythm'
  },

  {
    id: 'mem-apostles-creed',
    title: 'Apostles\' Creed (Memorized)',
    author: 'Early Church',
    category: 'theology',
    tier: 1,
    stage: 'grammar',
    grade: 0,
    type: 'book',
    description: 'Foundational Christian theology; part of morning rhythm.',
    notes: 'Grammar stage; daily recitation'
  },

  {
    id: 'mem-gospel-structure',
    title: 'Gospel (Full Structure Memorized)',
    author: 'Various Evangelists',
    category: 'theology',
    tier: 1,
    stage: 'grammar',
    grade: 5,
    type: 'book',
    description: 'Complete gospel narrative structure held in sequence; grade 5 checkpoint.',
    notes: 'Grammar stage capstone'
  },
];

// Export by category for easy filtering
export const classicalLibraryByCategory = {
  literature: classicalLibrary.filter(item => item.category === 'literature'),
  philosophy: classicalLibrary.filter(item => item.category === 'philosophy'),
  theology: classicalLibrary.filter(item => item.category === 'theology'),
  history: classicalLibrary.filter(item => item.category === 'history'),
  mathematics: classicalLibrary.filter(item => item.category === 'mathematics'),
  science: classicalLibrary.filter(item => item.category === 'science'),
  biography: classicalLibrary.filter(item => item.category === 'biography'),
  music: classicalLibrary.filter(item => item.category === 'music'),
  art: classicalLibrary.filter(item => item.category === 'art'),
  language: classicalLibrary.filter(item => item.category === 'language'),
};

// Export by tier
export const tier1Texts = classicalLibrary.filter(item => item.tier === 1);
export const tier2Texts = classicalLibrary.filter(item => item.tier === 2);

// Export by stage
export const grammarStageMaterial = classicalLibrary.filter(item => item.stage === 'grammar' || !item.stage);
export const logicStageMaterial = classicalLibrary.filter(item => item.stage === 'logic' || !item.stage);
export const rhetoricStageMaterial = classicalLibrary.filter(item => item.stage === 'rhetoric' || !item.stage);

// Function to add public domain sources to library items
export function getClassicalLibraryWithSources(): ClassicalLibraryItem[] {
  const { publicDomainSources, getPublicDomainSources } = require('./publicDomainSources');

  return classicalLibrary.map(item => {
    if (item.sources && item.sources.length > 0) {
      return item; // Already has sources
    }

    const pdSources = getPublicDomainSources(item.title, item.author, item.type);
    if (pdSources) {
      return { ...item, sources: pdSources };
    }

    return item;
  });
}
