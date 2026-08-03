import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { Book, Bookmark, Highlight, ReadingSession, ReadingGoal } from '../types';

const DB_NAME = 'bookvpr.db';
const isWeb = Platform.OS === 'web';

// expo-sqlite has no web backend, so the web build keeps an in-memory
// store with the same shape instead of persisting to disk.
const memoryStore: {
  books: any[];
  bookmarks: any[];
  highlights: any[];
  reading_sessions: any[];
  reading_goals: any[];
} = {
  books: [],
  bookmarks: [],
  highlights: [],
  reading_sessions: [],
  reading_goals: [],
};

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export class DatabaseService {
  private static db: SQLite.SQLiteDatabase | null = null;

  private static async run(sql: string, args: any[] = []) {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.transactionAsync(async (tx) => {
      await tx.executeSqlAsync(sql, args);
    }, false);
  }

  private static async all(sql: string, args: any[] = []): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    let rows: any[] = [];
    await this.db.transactionAsync(async (tx) => {
      const result = await tx.executeSqlAsync(sql, args);
      rows = result.rows;
    }, true);
    return rows;
  }

  private static async first(sql: string, args: any[] = []): Promise<any | null> {
    const rows = await this.all(sql, args);
    return rows.length > 0 ? rows[0] : null;
  }

  static async init() {
    if (isWeb) return;
    try {
      this.db = SQLite.openDatabase(DB_NAME);
      await this.createTables();
    } catch (error) {
      console.error('Database init error:', error);
      throw error;
    }
  }

  private static async createTables() {
    if (!this.db) throw new Error('Database not initialized');

    const statements = [
      `CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT,
        cover TEXT,
        filePath TEXT,
        fileName TEXT,
        fileFormat TEXT,
        fileSize INTEGER,
        currentProgress REAL DEFAULT 0,
        totalPages INTEGER,
        addedDate INTEGER,
        lastReadDate INTEGER,
        readingTimeMinutes INTEGER DEFAULT 0,
        isFinished INTEGER DEFAULT 0,
        isFavorite INTEGER DEFAULT 0,
        description TEXT,
        language TEXT,
        publishedDate TEXT,
        itemType TEXT DEFAULT 'book',
        coverColor TEXT DEFAULT '#2d1b4e',
        createdAt INTEGER DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        bookId TEXT NOT NULL,
        chapter INTEGER,
        page INTEGER,
        progress REAL,
        timestamp INTEGER,
        note TEXT,
        createdAt INTEGER DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(bookId) REFERENCES books(id)
      );`,
      `CREATE TABLE IF NOT EXISTS highlights (
        id TEXT PRIMARY KEY,
        bookId TEXT NOT NULL,
        chapter INTEGER,
        page INTEGER,
        text TEXT,
        color TEXT,
        timestamp INTEGER,
        note TEXT,
        createdAt INTEGER DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(bookId) REFERENCES books(id)
      );`,
      `CREATE TABLE IF NOT EXISTS reading_sessions (
        id TEXT PRIMARY KEY,
        bookId TEXT NOT NULL,
        startTime INTEGER,
        endTime INTEGER,
        durationMinutes INTEGER,
        pageStart INTEGER,
        pageEnd INTEGER,
        createdAt INTEGER DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(bookId) REFERENCES books(id)
      );`,
      `CREATE TABLE IF NOT EXISTS reading_goals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        targetPages INTEGER,
        targetMinutes INTEGER,
        currentProgress INTEGER DEFAULT 0,
        createdDate INTEGER,
        targetDate INTEGER,
        status TEXT DEFAULT 'active',
        createdAt INTEGER DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );`,
      `CREATE INDEX IF NOT EXISTS idx_books_favorite ON books(isFavorite);`,
      `CREATE INDEX IF NOT EXISTS idx_bookmarks_book ON bookmarks(bookId);`,
      `CREATE INDEX IF NOT EXISTS idx_highlights_book ON highlights(bookId);`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_book ON reading_sessions(bookId);`,
    ];

    await this.db.transactionAsync(async (tx) => {
      for (const statement of statements) {
        await tx.executeSqlAsync(statement);
      }
    }, false);
  }

  // Books
  static async addBook(book: Omit<Book, 'id'>): Promise<string> {
    const id = genId('book');
    if (isWeb) {
      memoryStore.books.unshift({
        id,
        ...book,
        isFinished: book.isFinished ? 1 : 0,
        isFavorite: book.isFavorite ? 1 : 0,
      });
      return id;
    }
    await this.run(
      `INSERT INTO books (
        id, title, author, cover, filePath, fileName, fileFormat, fileSize,
        currentProgress, totalPages, addedDate, lastReadDate, readingTimeMinutes,
        isFinished, isFavorite, description, language, publishedDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, book.title, book.author, book.cover, book.filePath, book.fileName,
        book.fileFormat, book.fileSize, book.currentProgress, book.totalPages,
        book.addedDate, book.lastReadDate, book.readingTimeMinutes,
        book.isFinished ? 1 : 0, book.isFavorite ? 1 : 0, book.description,
        book.language, book.publishedDate,
      ]
    );
    return id;
  }

  static async getBooks(): Promise<Book[]> {
    if (isWeb) {
      return memoryStore.books.map(row => this.rowToBook(row));
    }
    const rows = await this.all('SELECT * FROM books ORDER BY lastReadDate DESC');
    return rows.map(row => this.rowToBook(row));
  }

  static async getBook(id: string): Promise<Book | null> {
    if (isWeb) {
      const row = memoryStore.books.find(b => b.id === id);
      return row ? this.rowToBook(row) : null;
    }
    const row = await this.first('SELECT * FROM books WHERE id = ?', [id]);
    return row ? this.rowToBook(row) : null;
  }

  static async updateBook(id: string, updates: Partial<Book>): Promise<void> {
    if (isWeb) {
      const idx = memoryStore.books.findIndex(b => b.id === id);
      if (idx >= 0) memoryStore.books[idx] = { ...memoryStore.books[idx], ...updates };
      return;
    }
    const fields = Object.keys(updates)
      .filter(k => k !== 'id')
      .map(k => `${k} = ?`)
      .join(', ');
    const values = Object.keys(updates)
      .filter(k => k !== 'id')
      .map(k => (updates as any)[k]);
    await this.run(`UPDATE books SET ${fields} WHERE id = ?`, [...values, id]);
  }

  static async deleteBook(id: string): Promise<void> {
    if (isWeb) {
      memoryStore.books = memoryStore.books.filter(b => b.id !== id);
      memoryStore.bookmarks = memoryStore.bookmarks.filter(b => b.bookId !== id);
      memoryStore.highlights = memoryStore.highlights.filter(h => h.bookId !== id);
      memoryStore.reading_sessions = memoryStore.reading_sessions.filter(s => s.bookId !== id);
      return;
    }
    await this.run('DELETE FROM bookmarks WHERE bookId = ?', [id]);
    await this.run('DELETE FROM highlights WHERE bookId = ?', [id]);
    await this.run('DELETE FROM reading_sessions WHERE bookId = ?', [id]);
    await this.run('DELETE FROM books WHERE id = ?', [id]);
  }

  // Bookmarks
  static async addBookmark(bookmark: Omit<Bookmark, 'id'>): Promise<string> {
    const id = genId('bm');
    if (isWeb) {
      memoryStore.bookmarks.unshift({ id, ...bookmark });
      return id;
    }
    await this.run(
      `INSERT INTO bookmarks (id, bookId, chapter, page, progress, timestamp, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, bookmark.bookId, bookmark.chapter, bookmark.page, bookmark.progress, bookmark.timestamp, bookmark.note]
    );
    return id;
  }

  static async getBookmarks(bookId: string): Promise<Bookmark[]> {
    if (isWeb) {
      return memoryStore.bookmarks.filter(b => b.bookId === bookId).sort((a, b) => b.page - a.page) as Bookmark[];
    }
    const rows = await this.all(
      'SELECT * FROM bookmarks WHERE bookId = ? ORDER BY page DESC',
      [bookId]
    );
    return rows as Bookmark[];
  }

  static async deleteBookmark(id: string): Promise<void> {
    if (isWeb) {
      memoryStore.bookmarks = memoryStore.bookmarks.filter(b => b.id !== id);
      return;
    }
    await this.run('DELETE FROM bookmarks WHERE id = ?', [id]);
  }

  // Highlights
  static async addHighlight(highlight: Omit<Highlight, 'id'>): Promise<string> {
    const id = genId('hl');
    if (isWeb) {
      memoryStore.highlights.unshift({ id, ...highlight });
      return id;
    }
    await this.run(
      `INSERT INTO highlights (id, bookId, chapter, page, text, color, timestamp, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, highlight.bookId, highlight.chapter, highlight.page, highlight.text, highlight.color, highlight.timestamp, highlight.note]
    );
    return id;
  }

  static async getHighlights(bookId: string): Promise<Highlight[]> {
    if (isWeb) {
      return memoryStore.highlights.filter(h => h.bookId === bookId).sort((a, b) => b.page - a.page) as Highlight[];
    }
    const rows = await this.all(
      'SELECT * FROM highlights WHERE bookId = ? ORDER BY page DESC',
      [bookId]
    );
    return rows as Highlight[];
  }

  static async updateHighlight(id: string, updates: Partial<Highlight>): Promise<void> {
    if (isWeb) {
      const idx = memoryStore.highlights.findIndex(h => h.id === id);
      if (idx >= 0) memoryStore.highlights[idx] = { ...memoryStore.highlights[idx], ...updates };
      return;
    }
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.keys(updates).map(k => (updates as any)[k]);
    await this.run(`UPDATE highlights SET ${fields} WHERE id = ?`, [...values, id]);
  }

  static async deleteHighlight(id: string): Promise<void> {
    if (isWeb) {
      memoryStore.highlights = memoryStore.highlights.filter(h => h.id !== id);
      return;
    }
    await this.run('DELETE FROM highlights WHERE id = ?', [id]);
  }

  // Reading Sessions
  static async addReadingSession(session: Omit<ReadingSession, 'id'>): Promise<string> {
    const id = genId('sess');
    if (isWeb) {
      memoryStore.reading_sessions.unshift({ id, ...session });
      return id;
    }
    await this.run(
      `INSERT INTO reading_sessions (id, bookId, startTime, endTime, durationMinutes, pageStart, pageEnd)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, session.bookId, session.startTime, session.endTime, session.durationMinutes, session.pageStart, session.pageEnd]
    );
    return id;
  }

  static async getReadingStats(bookId: string): Promise<{ totalMinutes: number; sessionCount: number }> {
    if (isWeb) {
      const sessions = memoryStore.reading_sessions.filter(s => s.bookId === bookId);
      return {
        totalMinutes: sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0),
        sessionCount: sessions.length,
      };
    }
    const result = await this.first(
      `SELECT COALESCE(SUM(durationMinutes), 0) as totalMinutes, COUNT(*) as sessionCount
       FROM reading_sessions WHERE bookId = ?`,
      [bookId]
    );
    return result as { totalMinutes: number; sessionCount: number };
  }

  // Goals
  static async addGoal(goal: Omit<ReadingGoal, 'id'>): Promise<string> {
    const id = genId('goal');
    if (isWeb) {
      memoryStore.reading_goals.unshift({ id, ...goal });
      return id;
    }
    await this.run(
      `INSERT INTO reading_goals (id, name, targetPages, targetMinutes, currentProgress, createdDate, targetDate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, goal.name, goal.targetPages, goal.targetMinutes, goal.currentProgress, goal.createdDate, goal.targetDate, goal.status]
    );
    return id;
  }

  static async getGoals(): Promise<ReadingGoal[]> {
    if (isWeb) {
      return memoryStore.reading_goals.filter(g => g.status === 'active').sort((a, b) => a.targetDate - b.targetDate) as ReadingGoal[];
    }
    const rows = await this.all(
      'SELECT * FROM reading_goals WHERE status = ? ORDER BY targetDate ASC',
      ['active']
    );
    return rows as ReadingGoal[];
  }

  private static rowToBook(row: any): Book {
    return {
      ...row,
      isFinished: row.isFinished === 1,
      isFavorite: row.isFavorite === 1,
    };
  }
}
