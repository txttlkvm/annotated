import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DatabaseService } from '../services/DatabaseService';
import { Book, Bookmark, Highlight, ReadingSession, ReaderSettings, DEFAULT_READER_SETTINGS } from '../types';

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
