export interface Book {
  id: string;
  title: string;
  author?: string;
  cover?: string;
  filePath: string;
  fileName: string;
  fileFormat: 'epub' | 'mobi' | 'pdf' | 'txt';
  fileSize: number;
  currentProgress: number;
  totalPages: number;
  addedDate: number;
  lastReadDate: number;
  readingTimeMinutes: number;
  isFinished: boolean;
  isFavorite: boolean;
  description?: string;
  language?: string;
  publishedDate?: string;
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
  classic: {
    id: 'classic',
    name: 'Classic Wood',
    backgroundColor: '#3d2817',
    shelfColor: '#5c3d2e',
    shelfStyle: 'wood',
    textColor: '#f5e6d3',
    accentColor: '#d4a574',
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    backgroundColor: '#f8f9fa',
    shelfColor: '#e9ecef',
    shelfStyle: 'modern',
    textColor: '#212529',
    accentColor: '#4A90E2',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    backgroundColor: '#ffffff',
    shelfColor: '#f0f0f0',
    shelfStyle: 'minimal',
    textColor: '#333333',
    accentColor: '#666666',
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    backgroundColor: '#1a1a1a',
    shelfColor: '#2a2a2a',
    shelfStyle: 'minimal',
    textColor: '#e0e0e0',
    accentColor: '#4A90E2',
  },
};
