import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Book, Bookmark, Highlight, ReadingSession, ReadingGoal } from '../types';

const DB_NAME = 'bookvpr.db';

export class DatabaseService {
  private static db: SQLite.SQLiteDatabase | null = null;

  static async init() {
    try {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.createTables();
    } catch (error) {
      console.error('Database init error:', error);
      throw error;
    }
  }

  private static async createTables() {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS books (
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
      );

      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        bookId TEXT NOT NULL,
        chapter INTEGER,
        page INTEGER,
        progress REAL,
        timestamp INTEGER,
        note TEXT,
        createdAt INTEGER DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(bookId) REFERENCES books(id)
      );

      CREATE TABLE IF NOT EXISTS highlights (
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
      );

      CREATE TABLE IF NOT EXISTS reading_sessions (
        id TEXT PRIMARY KEY,
        bookId TEXT NOT NULL,
        startTime INTEGER,
        endTime INTEGER,
        durationMinutes INTEGER,
        pageStart INTEGER,
        pageEnd INTEGER,
        createdAt INTEGER DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(bookId) REFERENCES books(id)
      );

      CREATE TABLE IF NOT EXISTS reading_goals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        targetPages INTEGER,
        targetMinutes INTEGER,
        currentProgress INTEGER DEFAULT 0,
        createdDate INTEGER,
        targetDate INTEGER,
        status TEXT DEFAULT 'active',
        createdAt INTEGER DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_books_favorite ON books(isFavorite);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_book ON bookmarks(bookId);
      CREATE INDEX IF NOT EXISTS idx_highlights_book ON highlights(bookId);
      CREATE INDEX IF NOT EXISTS idx_sessions_book ON reading_sessions(bookId);
    `);
  }

  // Books
  static async addBook(book: Omit<Book, 'id'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');
    const id = `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.db.runAsync(
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
    if (!this.db) throw new Error('Database not initialized');
    const rows = await this.db.getAllAsync('SELECT * FROM books ORDER BY lastReadDate DESC');
    return rows.map(row => this.rowToBook(row));
  }

  static async getBook(id: string): Promise<Book | null> {
    if (!this.db) throw new Error('Database not initialized');
    const row = await this.db.getFirstAsync('SELECT * FROM books WHERE id = ?', [id]);
    return row ? this.rowToBook(row) : null;
  }

  static async updateBook(id: string, updates: Partial<Book>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const fields = Object.keys(updates)
      .filter(k => k !== 'id')
      .map(k => `${k} = ?`)
      .join(', ');
    const values = Object.keys(updates)
      .filter(k => k !== 'id')
      .map(k => (updates as any)[k]);
    await this.db.runAsync(`UPDATE books SET ${fields} WHERE id = ?`, [...values, id]);
  }

  static async deleteBook(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync('DELETE FROM bookmarks WHERE bookId = ?', [id]);
    await this.db.runAsync('DELETE FROM highlights WHERE bookId = ?', [id]);
    await this.db.runAsync('DELETE FROM reading_sessions WHERE bookId = ?', [id]);
    await this.db.runAsync('DELETE FROM books WHERE id = ?', [id]);
  }

  // Bookmarks
  static async addBookmark(bookmark: Omit<Bookmark, 'id'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');
    const id = `bm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.db.runAsync(
      `INSERT INTO bookmarks (id, bookId, chapter, page, progress, timestamp, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, bookmark.bookId, bookmark.chapter, bookmark.page, bookmark.progress, bookmark.timestamp, bookmark.note]
    );
    return id;
  }

  static async getBookmarks(bookId: string): Promise<Bookmark[]> {
    if (!this.db) throw new Error('Database not initialized');
    const rows = await this.db.getAllAsync(
      'SELECT * FROM bookmarks WHERE bookId = ? ORDER BY page DESC',
      [bookId]
    );
    return rows as Bookmark[];
  }

  static async deleteBookmark(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync('DELETE FROM bookmarks WHERE id = ?', [id]);
  }

  // Highlights
  static async addHighlight(highlight: Omit<Highlight, 'id'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');
    const id = `hl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.db.runAsync(
      `INSERT INTO highlights (id, bookId, chapter, page, text, color, timestamp, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, highlight.bookId, highlight.chapter, highlight.page, highlight.text, highlight.color, highlight.timestamp, highlight.note]
    );
    return id;
  }

  static async getHighlights(bookId: string): Promise<Highlight[]> {
    if (!this.db) throw new Error('Database not initialized');
    const rows = await this.db.getAllAsync(
      'SELECT * FROM highlights WHERE bookId = ? ORDER BY page DESC',
      [bookId]
    );
    return rows as Highlight[];
  }

  static async updateHighlight(id: string, updates: Partial<Highlight>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.keys(updates).map(k => (updates as any)[k]);
    await this.db.runAsync(`UPDATE highlights SET ${fields} WHERE id = ?`, [...values, id]);
  }

  static async deleteHighlight(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync('DELETE FROM highlights WHERE id = ?', [id]);
  }

  // Reading Sessions
  static async addReadingSession(session: Omit<ReadingSession, 'id'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');
    const id = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.db.runAsync(
      `INSERT INTO reading_sessions (id, bookId, startTime, endTime, durationMinutes, pageStart, pageEnd)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, session.bookId, session.startTime, session.endTime, session.durationMinutes, session.pageStart, session.pageEnd]
    );
    return id;
  }

  static async getReadingStats(bookId: string): Promise<{ totalMinutes: number; sessionCount: number }> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.getFirstAsync(
      `SELECT COALESCE(SUM(durationMinutes), 0) as totalMinutes, COUNT(*) as sessionCount
       FROM reading_sessions WHERE bookId = ?`,
      [bookId]
    );
    return result as { totalMinutes: number; sessionCount: number };
  }

  // Goals
  static async addGoal(goal: Omit<ReadingGoal, 'id'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');
    const id = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.db.runAsync(
      `INSERT INTO reading_goals (id, name, targetPages, targetMinutes, currentProgress, createdDate, targetDate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, goal.name, goal.targetPages, goal.targetMinutes, goal.currentProgress, goal.createdDate, goal.targetDate, goal.status]
    );
    return id;
  }

  static async getGoals(): Promise<ReadingGoal[]> {
    if (!this.db) throw new Error('Database not initialized');
    const rows = await this.db.getAllAsync(
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
