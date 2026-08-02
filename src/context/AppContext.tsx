import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DatabaseService } from '../services/DatabaseService';
import { Book, Bookmark, Highlight, ReadingSession, ReaderSettings, DEFAULT_READER_SETTINGS } from '../types';
import { classicalLibrary, getClassicalLibraryWithSources, ClassicalLibraryItem, classicalLibraryByCategory, tier1Texts, tier2Texts, grammarStageMaterial, logicStageMaterial, rhetoricStageMaterial } from '../data/classicalLibrary';

interface AppContextType {
  books: Book[];
  currentBook: Book | null;
  bookmarks: Bookmark[];
  highlights: Highlight[];
  settings: ReaderSettings;
  isLoading: boolean;

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

  return (
    <AppContext.Provider
      value={{
        books,
        currentBook,
        bookmarks,
        highlights,
        settings,
        isLoading,
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
