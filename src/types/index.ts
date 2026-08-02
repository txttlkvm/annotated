export interface Book {
  id: string;
  title: string;
  author?: string;
  cover?: string;
  filePath?: string;
  fileName?: string;
  fileFormat?: 'epub' | 'mobi' | 'pdf' | 'txt';
  fileSize: number;
  currentProgress: number;
  totalPages: number;
  addedDate: string | number;
  lastReadDate?: number;
  readingTimeMinutes?: number;
  isFinished: boolean;
  isFavorite: boolean;
  description?: string;
  language?: string;
  publishedDate?: string;
  itemType?: 'book' | 'music' | 'art' | 'resource';
  coverColor?: string;
}

export interface Bookmark {
  id: string;
  bookId: string;
  chapter: number;
  page: number;
  progress: number;
  timestamp: number;
  note?: string;
}

export interface Highlight {
  id: string;
  bookId: string;
  chapter: number;
  page: number;
  text: string;
  color: string;
  timestamp: number;
  note?: string;
}

export interface ReadingSession {
  id: string;
  bookId: string;
  startTime: number;
  endTime: number;
  durationMinutes: number;
  pageStart: number;
  pageEnd: number;
}

export interface ReadingGoal {
  id: string;
  name: string;
  targetPages: number;
  targetMinutes: number;
  currentProgress: number;
  createdDate: number;
  targetDate: number;
  status: 'active' | 'completed' | 'abandoned';
}

export interface ReaderSettings {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  letterSpacing: number;
  theme: 'light' | 'dark' | 'sepia' | 'night';
  brightness: number;
  textAlignment: 'left' | 'center' | 'justify';
  marginSize: 'small' | 'medium' | 'large';
  pageMode: 'scroll' | 'paginated';
  showStatusBar: boolean;
  ttsVoicePitch: number;
  ttsVoiceRate: number;
  ttsVoice: string;
  enableTTS: boolean;
  autoBrightnessEnabled: boolean;
}

export interface TTSConfig {
  apiKey: string;
  languageCode: string;
  voiceGender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  voiceName: string;
  pitch: number;
  speakingRate: number;
  useNeuralVoices: boolean;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  bookIds: string[];
  createdDate: number;
  coverColor?: string;
  category?: 'grammar' | 'logic' | 'rhetoric' | 'custom';
}

export interface WordLookup {
  id: string;
  word: string;
  definition: string;
  partOfSpeech?: string;
  pronunciation?: string;
  example?: string;
  synonyms?: string[];
  bookId?: string;
  timestamp: number;
  context?: string;
}

export interface ChapterEntry {
  id: string;
  bookId: string;
  title: string;
  startPage: number;
  endPage?: number;
  level: number; // For nested chapters
}

export interface BookProgress {
  bookId: string;
  currentPage: number;
  totalPages: number;
  progress: number; // 0-100
  estimatedMinutesRemaining: number;
  wordsPerMinute: number;
  lastUpdated: number;
}

export interface DictionaryEntry {
  word: string;
  pronunciation?: string;
  definition: string;
  partOfSpeech?: string;
  synonyms?: string[];
  example?: string;
}

export type ReaderTheme = {
  name: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  selectionColor: string;
  statusBarStyle: 'light' | 'dark';
};

export const READER_THEMES: Record<string, ReaderTheme> = {
  light: {
    name: 'Light',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    accentColor: '#4A90E2',
    selectionColor: '#FFF3CD',
    statusBarStyle: 'dark',
  },
  dark: {
    name: 'Dark',
    backgroundColor: '#1a1a1a',
    textColor: '#e0e0e0',
    accentColor: '#4A90E2',
    selectionColor: '#333333',
    statusBarStyle: 'light',
  },
  sepia: {
    name: 'Sepia',
    backgroundColor: '#F4ECD8',
    textColor: '#5C4033',
    accentColor: '#8B6914',
    selectionColor: '#E6D7C3',
    statusBarStyle: 'dark',
  },
  night: {
    name: 'Night',
    backgroundColor: '#0a0a0a',
    textColor: '#b0b0b0',
    accentColor: '#6FA3D0',
    selectionColor: '#1a1a1a',
    statusBarStyle: 'light',
  },
};

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 16,
  fontFamily: 'Georgia',
  lineHeight: 1.6,
  letterSpacing: 0,
  theme: 'dark',
  brightness: 1,
  textAlignment: 'left',
  marginSize: 'medium',
  pageMode: 'scroll',
  showStatusBar: true,
  ttsVoicePitch: 1.0,
  ttsVoiceRate: 1.0,
  ttsVoice: 'en-US-Neural2-C',
  enableTTS: false,
  autoBrightnessEnabled: true,
};

export interface Collection {
  id: string;
  name: string;
  description?: string;
  bookIds: string[];
  coverImage?: string;
  createdAt: number;
  color?: string;
  type: 'custom' | 'smart' | 'series' | 'author';
}

export interface BookshelfTheme {
  id: string;
  name: string;
  backgroundColor: string;
  shelfColor: string;
  shelfStyle: 'wood' | 'modern' | 'minimal' | 'glass' | 'fabric';
  textColor: string;
  accentColor: string;
}

export const BOOKSHELF_THEMES: Record<string, BookshelfTheme> = {
  byzantine: {
    id: 'byzantine',
    name: 'Byzantine',
    backgroundColor: '#0d0d0d',
    shelfColor: '#1a1a1a',
    shelfStyle: 'minimal',
    textColor: '#d4af37',
    accentColor: '#d4af37',
  },
  gothic: {
    id: 'gothic',
    name: 'Gothic',
    backgroundColor: '#1a0f2e',
    shelfColor: '#2d1b4e',
    shelfStyle: 'wood',
    textColor: '#c9a961',
    accentColor: '#9b7d54',
  },
  sacred: {
    id: 'sacred',
    name: 'Sacred',
    backgroundColor: '#0f0a1a',
    shelfColor: '#1a1328',
    shelfStyle: 'minimal',
    textColor: '#b8860b',
    accentColor: '#8b7355',
  },
  manuscript: {
    id: 'manuscript',
    name: 'Manuscript',
    backgroundColor: '#2a2520',
    shelfColor: '#3d3730',
    shelfStyle: 'wood',
    textColor: '#c9a961',
    accentColor: '#8b6f47',
  },
};
