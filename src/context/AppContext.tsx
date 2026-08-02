import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DatabaseService } from '../services/DatabaseService';
import { Book, Bookmark, Highlight, ReadingSession, ReaderSettings, DEFAULT_READER_SETTINGS, Collection, WordLookup, BookProgress } from '../types';
import { classicalLibrary, getClassicalLibraryWithSources, ClassicalLibraryItem, classicalLibraryByCategory, tier1Texts, tier2Texts, grammarStageMaterial, logicStageMaterial, rhetoricStageMaterial } from '../data/classicalLibrary';

interface AppContextType {
  books: Book[];
  currentBook: Book | null;
  bookmarks: Bookmark[];
  highlights: Highlight[];
  settings: ReaderSettings;
  isLoading: boolean;
  collections: Collection[];
  wordLookups: WordLookup[];
  bookProgress: Map<string, BookProgress>;

  // Book operations
  addBook: (book: Omit<Book, 'id'>) => Promise<string>;
  updateBook: (id: string, updates: Partial<Book>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  setCurrentBook: (book: Book | null) => void;

  // Bookmark operations
  addBookmark: (bookmark: Omit<Bookmark, 'id'>) => Promise<string>;
  removeBookmark: (id: string) => Promise<void>;
  loadBookmarks: (bookId: string) => Promise<void>;

  // Highlight operations
  addHighlight: (highlight: Omit<Highlight, 'id'>) => Promise<string>;
  updateHighlight: (id: string, updates: Partial<Highlight>) => Promise<void>;
  deleteHighlight: (id: string) => Promise<void>;
  loadHighlights: (bookId: string) => Promise<void>;

  // Settings
  updateSettings: (updates: Partial<ReaderSettings>) => void;

  // Reading sessions
  addReadingSession: (session: Omit<ReadingSession, 'id'>) => Promise<void>;

  // Collections
  createCollection: (collection: Omit<Collection, 'id'>) => Promise<string>;
  updateCollection: (id: string, updates: Partial<Collection>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addBookToCollection: (collectionId: string, bookId: string) => Promise<void>;
  removeBookFromCollection: (collectionId: string, bookId: string) => Promise<void>;

  // Dictionary/Word lookups
  addWordLookup: (lookup: Omit<WordLookup, 'id' | 'timestamp'>) => Promise<string>;
  getWordLookups: () => WordLookup[];
  getWordLookupHistory: (word: string) => WordLookup[];
  deleteWordLookup: (id: string) => Promise<void>;

  // Book progress
  updateBookProgress: (bookId: string, progress: BookProgress) => Promise<void>;
  getBookProgress: (bookId: string) => BookProgress | undefined;
  calculateEstimatedTimeRemaining: (bookId: string) => number;

  // Classical library
  getClassicalLibrary: () => ClassicalLibraryItem[];
  getClassicalLibraryByCategory: (category: string) => ClassicalLibraryItem[];
  getClassicalLibraryByTier: (tier: 1 | 2) => ClassicalLibraryItem[];
  getClassicalLibraryByStage: (stage: 'grammar' | 'logic' | 'rhetoric') => ClassicalLibraryItem[];
  addClassicalLibraryItem: (item: ClassicalLibraryItem) => Promise<string>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_READER_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [wordLookups, setWordLookups] = useState<WordLookup[]>([]);
  const [bookProgress, setBookProgress] = useState<Map<string, BookProgress>>(new Map());

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      const books = await DatabaseService.getBooks();
      setBooks(books);
    } catch (error) {
      console.error('Load books error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addBook = async (book: Omit<Book, 'id'>) => {
    const id = await DatabaseService.addBook(book);
    const newBook = { ...book, id };
    setBooks([newBook as Book, ...books]);
    return id;
  };

  const updateBook = async (id: string, updates: Partial<Book>) => {
    await DatabaseService.updateBook(id, updates);
    setBooks(books.map(b => b.id === id ? { ...b, ...updates } : b));
    if (currentBook?.id === id) {
      setCurrentBook({ ...currentBook, ...updates });
    }
  };

  const deleteBook = async (id: string) => {
    await DatabaseService.deleteBook(id);
    setBooks(books.filter(b => b.id !== id));
    if (currentBook?.id === id) {
      setCurrentBook(null);
    }
  };

  const addBookmark = async (bookmark: Omit<Bookmark, 'id'>) => {
    const id = await DatabaseService.addBookmark(bookmark);
    setBookmarks([{ ...bookmark, id } as Bookmark, ...bookmarks]);
    return id;
  };

  const removeBookmark = async (id: string) => {
    await DatabaseService.deleteBookmark(id);
    setBookmarks(bookmarks.filter(b => b.id !== id));
  };

  const loadBookmarks = async (bookId: string) => {
    const bms = await DatabaseService.getBookmarks(bookId);
    setBookmarks(bms);
  };

  const addHighlight = async (highlight: Omit<Highlight, 'id'>) => {
    const id = await DatabaseService.addHighlight(highlight);
    setHighlights([{ ...highlight, id } as Highlight, ...highlights]);
    return id;
  };

  const updateHighlight = async (id: string, updates: Partial<Highlight>) => {
    await DatabaseService.updateHighlight(id, updates);
    setHighlights(highlights.map(h => h.id === id ? { ...h, ...updates } : h));
  };

  const deleteHighlight = async (id: string) => {
    await DatabaseService.deleteHighlight(id);
    setHighlights(highlights.filter(h => h.id !== id));
  };

  const loadHighlights = async (bookId: string) => {
    const hls = await DatabaseService.getHighlights(bookId);
    setHighlights(hls);
  };

  const updateSettings = (updates: Partial<ReaderSettings>) => {
    setSettings({ ...settings, ...updates });
  };

  const addReadingSession = async (session: Omit<ReadingSession, 'id'>) => {
    await DatabaseService.addReadingSession(session);
  };

  const getClassicalLibrary = () => {
    try {
      return getClassicalLibraryWithSources();
    } catch (error) {
      console.error('Error loading classical library with sources:', error);
      return classicalLibrary;
    }
  };

  const getClassicalLibraryByCategory = (category: string) => {
    const key = category as keyof typeof classicalLibraryByCategory;
    return classicalLibraryByCategory[key] || [];
  };

  const getClassicalLibraryByTier = (tier: 1 | 2) => {
    return tier === 1 ? tier1Texts : tier2Texts;
  };

  const getClassicalLibraryByStage = (stage: 'grammar' | 'logic' | 'rhetoric') => {
    if (stage === 'grammar') return grammarStageMaterial;
    if (stage === 'logic') return logicStageMaterial;
    return rhetoricStageMaterial;
  };

  const addClassicalLibraryItem = async (item: ClassicalLibraryItem) => {
    const book: Omit<Book, 'id'> = {
      title: item.title,
      author: item.author,
      currentProgress: 0,
      totalPages: item.type === 'book' ? 100 : 0,
      fileSize: 0,
      isFavorite: false,
      isFinished: false,
      coverColor: '#2d1b4e',
      addedDate: new Date().toISOString(),
      itemType: item.type,
      description: item.description,
    };
    return addBook(book);
  };

  // Collection operations
  const createCollection = async (collection: Omit<Collection, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newCollection: Collection = { ...collection, id };
    setCollections([newCollection, ...collections]);
    return id;
  };

  const updateCollection = async (id: string, updates: Partial<Collection>) => {
    setCollections(collections.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCollection = async (id: string) => {
    setCollections(collections.filter(c => c.id !== id));
  };

  const addBookToCollection = async (collectionId: string, bookId: string) => {
    setCollections(collections.map(c => {
      if (c.id === collectionId && !c.bookIds.includes(bookId)) {
        return { ...c, bookIds: [...c.bookIds, bookId] };
      }
      return c;
    }));
  };

  const removeBookFromCollection = async (collectionId: string, bookId: string) => {
    setCollections(collections.map(c => {
      if (c.id === collectionId) {
        return { ...c, bookIds: c.bookIds.filter(id => id !== bookId) };
      }
      return c;
    }));
  };

  // Dictionary/Word lookups
  const addWordLookup = async (lookup: Omit<WordLookup, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newLookup: WordLookup = { ...lookup, id, timestamp: Date.now() };
    setWordLookups([newLookup, ...wordLookups]);
    return id;
  };

  const getWordLookups = () => wordLookups;

  const getWordLookupHistory = (word: string) => {
    return wordLookups.filter(w => w.word.toLowerCase() === word.toLowerCase());
  };

  const deleteWordLookup = async (id: string) => {
    setWordLookups(wordLookups.filter(w => w.id !== id));
  };

  // Book progress
  const updateBookProgress = async (bookId: string, progress: BookProgress) => {
    const newProgress = new Map(bookProgress);
    newProgress.set(bookId, progress);
    setBookProgress(newProgress);
  };

  const getBookProgress = (bookId: string) => {
    return bookProgress.get(bookId);
  };

  const calculateEstimatedTimeRemaining = (bookId: string) => {
    const progress = bookProgress.get(bookId);
    if (!progress || progress.totalPages === 0) return 0;

    const pagesRemaining = progress.totalPages - progress.currentPage;
    return Math.ceil((pagesRemaining / progress.wordsPerMinute) / 60); // Hours
  };

  return (
    <AppContext.Provider
      value={{
        books,
        currentBook,
        bookmarks,
        highlights,
        settings,
        isLoading,
        collections,
        wordLookups,
        bookProgress,
        addBook,
        updateBook,
        deleteBook,
        setCurrentBook,
        addBookmark,
        removeBookmark,
        loadBookmarks,
        addHighlight,
        updateHighlight,
        deleteHighlight,
        loadHighlights,
        updateSettings,
        addReadingSession,
        createCollection,
        updateCollection,
        deleteCollection,
        addBookToCollection,
        removeBookFromCollection,
        addWordLookup,
        getWordLookups,
        getWordLookupHistory,
        deleteWordLookup,
        updateBookProgress,
        getBookProgress,
        calculateEstimatedTimeRemaining,
        getClassicalLibrary,
        getClassicalLibraryByCategory,
        getClassicalLibraryByTier,
        getClassicalLibraryByStage,
        addClassicalLibraryItem,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
