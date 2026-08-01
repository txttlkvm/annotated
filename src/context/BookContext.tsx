import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Book {
  id: string;
  title: string;
  author?: string;
  filePath: string;
  fileName: string;
  coverImage?: string;
  currentPage: number;
  totalPages: number;
  lastRead: Date;
  content?: string;
}

export interface ReaderSettings {
  voiceLanguage: string;
  voicePitch: number;
  voiceRate: number;
  fontSize: number;
  lineHeight: number;
  backgroundColor: string;
  textColor: string;
  useNeuralVoices: boolean;
}

interface BookContextType {
  books: Book[];
  currentBook: Book | null;
  settings: ReaderSettings;
  addBook: (book: Book) => void;
  removeBook: (id: string) => void;
  setCurrentBook: (book: Book) => void;
  updateBookProgress: (id: string, page: number) => void;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
}

const defaultSettings: ReaderSettings = {
  voiceLanguage: 'en-US',
  voicePitch: 1.0,
  voiceRate: 1.0,
  fontSize: 16,
  lineHeight: 1.5,
  backgroundColor: '#1a1a1a',
  textColor: '#e0e0e0',
  useNeuralVoices: true,
};

const BookContext = createContext<BookContextType | undefined>(undefined);

export const BookProvider = ({ children }: { children: ReactNode }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);

  const addBook = (book: Book) => {
    setBooks([...books, book]);
  };

  const removeBook = (id: string) => {
    setBooks(books.filter(b => b.id !== id));
  };

  const updateBookProgress = (id: string, page: number) => {
    setBooks(books.map(b => b.id === id ? { ...b, currentPage: page } : b));
  };

  const updateSettings = (newSettings: Partial<ReaderSettings>) => {
    setSettings({ ...settings, ...newSettings });
  };

  return (
    <BookContext.Provider
      value={{
        books,
        currentBook,
        settings,
        addBook,
        removeBook,
        setCurrentBook,
        updateBookProgress,
        updateSettings,
      }}
    >
      {children}
    </BookContext.Provider>
  );
};

export const useBooks = () => {
  const context = useContext(BookContext);
  if (!context) {
    throw new Error('useBooks must be used within BookProvider');
  }
  return context;
};
