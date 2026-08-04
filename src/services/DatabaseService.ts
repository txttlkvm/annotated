import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { Book, Bookmark, Highlight, ReadingSession, ReadingGoal } from '../types';

const DB_NAME = 'bookvpr.db';
const isWeb = Platform.OS === 'web';

/* ------------------------------------------------------------------ *
 * WEB PERSISTENCE
 *
 * expo-sqlite has no web backend, so the web build keeps the same row
 * shapes in memory and mirrors them into localStorage after every
 * mutation, rehydrating on init().
 *
 * Why localStorage: the payload is small metadata, the API is
 * synchronous (so the public API here stays byte-for-byte identical),
 * and it is available in every browser we target. It is also durable
 * across a page refresh, which the previous in-process-only store was
 * not — books added on web simply vanished on reload.
 *
 * !! Book.content IS DELIBERATELY NOT PERSISTED !!
 * `content` holds the FULL plain text of a book (the Iliad alone is
 * ~1.1MB) and localStorage caps at roughly 5MB per origin, so two or
 * three books would blow the quota and every later write would throw,
 * silently killing persistence for bookmarks/highlights/goals too.
 * `content` is stripped on the way out and re-fetched on demand from
 * `Book.sourceUrl` via GutenbergService. It stays in memory for the
 * life of the session, so nothing changes for the current reader.
 * Every other Book field (sourceUrl included) round-trips.
 *
 * All storage access degrades to plain in-memory operation if
 * localStorage is missing (SSR/static prerender), blocked (private
 * mode, cookies disabled) or full (quota) — it must never throw into
 * the app.
 * ------------------------------------------------------------------ */

const WEB_STORE_KEY = 'annotated:db:v1';

type WebCollection =
  | 'books'
  | 'bookmarks'
  | 'highlights'
  | 'reading_sessions'
  | 'reading_goals';

type WebStore = Record<WebCollection, any[]>;

const WEB_COLLECTIONS: WebCollection[] = [
  'books',
  'bookmarks',
  'highlights',
  'reading_sessions',
  'reading_goals',
];

const memoryStore: WebStore = {
  books: [],
  bookmarks: [],
  highlights: [],
  reading_sessions: [],
  reading_goals: [],
};

let storageResolved = false;
let storageRef: Storage | null = null;
let hydrated = false;
let warnedOnWrite = false;

/** localStorage, or null when it is unavailable/blocked. Resolved once. */
function getStorage(): Storage | null {
  if (storageResolved) return storageRef;
  storageResolved = true;
  try {
    // Merely *reading* the property can throw when storage is blocked.
    const candidate: any =
      typeof globalThis !== 'undefined' ? (globalThis as any).localStorage : undefined;
    storageRef =
      candidate && typeof candidate.getItem === 'function' ? (candidate as Storage) : null;
  } catch {
    storageRef = null;
  }
  return storageRef;
}

/** SQLite stores booleans as 0/1; keep the web rows byte-compatible. */
function normalizeBookRow(row: any): any {
  return {
    ...row,
    isFinished: row?.isFinished ? 1 : 0,
    isFavorite: row?.isFavorite ? 1 : 0,
  };
}

/**
 * Read the persisted store into memory. Idempotent, and safe to call
 * from any operation so a read that races ahead of init() still sees
 * persisted data. A corrupt value must never brick the app: it is
 * logged and treated as an empty library.
 */
function hydrateWebStore(): void {
  if (hydrated) return;
  hydrated = true;

  const storage = getStorage();
  if (!storage) return;

  let raw: string | null = null;
  try {
    raw = storage.getItem(WEB_STORE_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    for (const key of WEB_COLLECTIONS) {
      const rows = (parsed as any)[key];
      if (Array.isArray(rows)) {
        memoryStore[key] = rows.filter((r) => r && typeof r === 'object');
      }
    }
    memoryStore.books = memoryStore.books.map(normalizeBookRow);
  } catch (error) {
    console.warn('[DatabaseService] Corrupt web store; starting from empty.', error);
  }
}

/** Snapshot for serialization — strips Book.content (see note above). */
function toPersistable(): WebStore {
  return {
    books: memoryStore.books.map((row) => {
      const { content, ...rest } = row || {};
      return rest;
    }),
    bookmarks: memoryStore.bookmarks,
    highlights: memoryStore.highlights,
    reading_sessions: memoryStore.reading_sessions,
    reading_goals: memoryStore.reading_goals,
  };
}

/** Write memory back to storage. Never throws; warns once on failure. */
function persistWebStore(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(WEB_STORE_KEY, JSON.stringify(toPersistable()));
  } catch (error) {
    if (!warnedOnWrite) {
      warnedOnWrite = true;
      console.warn(
        '[DatabaseService] localStorage write failed (quota or private mode); ' +
          'continuing in memory only for this session.',
        error
      );
    }
  }
}

/**
 * Columns that actually exist on the native `books` table. Used to
 * filter dynamic UPDATEs so transient fields (notably `content`, which
 * is never stored) cannot produce "no such column" SQL errors.
 */
const BOOK_COLUMNS: string[] = [
  'title',
  'author',
  'cover',
  'filePath',
  'fileName',
  'fileFormat',
  'fileSize',
  'currentProgress',
  'totalPages',
  'addedDate',
  'lastReadDate',
  'readingTimeMinutes',
  'isFinished',
  'isFavorite',
  'description',
  'language',
  'publishedDate',
  'itemType',
  'coverColor',
  'sourceUrl',
];

/** SQLite bindings reject `undefined`; NULL is the right equivalent. */
function bind(value: any): any {
  return value === undefined ? null : value;
}

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
    if (isWeb) {
      hydrateWebStore();
      return;
    }
    try {
      this.db = SQLite.openDatabase(DB_NAME);
      await this.createTables();
      await this.migrate();
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
        sourceUrl TEXT,
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

  /**
   * CREATE TABLE IF NOT EXISTS will not add columns to a table that
   * already exists, so installs created before a column was introduced
   * need an explicit ALTER. Duplicate-column errors are expected on
   * every launch after the first and are swallowed.
   */
  private static async migrate() {
    const additions = ['ALTER TABLE books ADD COLUMN sourceUrl TEXT;'];
    for (const sql of additions) {
      try {
        await this.run(sql);
      } catch {
        // Column already present — nothing to do.
      }
    }
  }

  // Books
  static async addBook(book: Omit<Book, 'id'>): Promise<string> {
    const id = genId('book');
    if (isWeb) {
      hydrateWebStore();
      memoryStore.books.unshift(normalizeBookRow({ id, ...book }));
      persistWebStore();
      return id;
    }
    await this.run(
      `INSERT INTO books (
        id, title, author, cover, filePath, fileName, fileFormat, fileSize,
        currentProgress, totalPages, addedDate, lastReadDate, readingTimeMinutes,
        isFinished, isFavorite, description, language, publishedDate,
        itemType, coverColor, sourceUrl
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, book.title, book.author, book.cover, book.filePath, book.fileName,
        book.fileFormat, book.fileSize, book.currentProgress, book.totalPages,
        book.addedDate, book.lastReadDate, book.readingTimeMinutes,
        book.isFinished ? 1 : 0, book.isFavorite ? 1 : 0, book.description,
        book.language, book.publishedDate, book.itemType, book.coverColor,
        book.sourceUrl,
      ].map(bind)
    );
    return id;
  }

  static async getBooks(): Promise<Book[]> {
    if (isWeb) {
      hydrateWebStore();
      return memoryStore.books.map(row => this.rowToBook(row));
    }
    const rows = await this.all('SELECT * FROM books ORDER BY lastReadDate DESC');
    return rows.map(row => this.rowToBook(row));
  }

  static async getBook(id: string): Promise<Book | null> {
    if (isWeb) {
      hydrateWebStore();
      const row = memoryStore.books.find(b => b.id === id);
      return row ? this.rowToBook(row) : null;
    }
    const row = await this.first('SELECT * FROM books WHERE id = ?', [id]);
    return row ? this.rowToBook(row) : null;
  }

  static async updateBook(id: string, updates: Partial<Book>): Promise<void> {
    if (isWeb) {
      hydrateWebStore();
      const idx = memoryStore.books.findIndex(b => b.id === id);
      if (idx >= 0) {
        memoryStore.books[idx] = normalizeBookRow({ ...memoryStore.books[idx], ...updates });
        persistWebStore();
      }
      return;
    }
    // `content` is intentionally absent from BOOK_COLUMNS: full book text
    // is never stored, it is re-fetched from sourceUrl on demand.
    const entries = Object.entries(updates).filter(([key]) => BOOK_COLUMNS.includes(key));
    if (entries.length === 0) return;
    const fields = entries.map(([key]) => `${key} = ?`).join(', ');
    const values = entries.map(([key, value]) =>
      key === 'isFinished' || key === 'isFavorite' ? (value ? 1 : 0) : bind(value)
    );
    await this.run(`UPDATE books SET ${fields} WHERE id = ?`, [...values, id]);
  }

  static async deleteBook(id: string): Promise<void> {
    if (isWeb) {
      hydrateWebStore();
      memoryStore.books = memoryStore.books.filter(b => b.id !== id);
      memoryStore.bookmarks = memoryStore.bookmarks.filter(b => b.bookId !== id);
      memoryStore.highlights = memoryStore.highlights.filter(h => h.bookId !== id);
      memoryStore.reading_sessions = memoryStore.reading_sessions.filter(s => s.bookId !== id);
      persistWebStore();
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
      hydrateWebStore();
      memoryStore.bookmarks.unshift({ id, ...bookmark });
      persistWebStore();
      return id;
    }
    await this.run(
      `INSERT INTO bookmarks (id, bookId, chapter, page, progress, timestamp, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, bookmark.bookId, bookmark.chapter, bookmark.page, bookmark.progress, bookmark.timestamp, bookmark.note].map(bind)
    );
    return id;
  }

  static async getBookmarks(bookId: string): Promise<Bookmark[]> {
    if (isWeb) {
      hydrateWebStore();
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
      hydrateWebStore();
      memoryStore.bookmarks = memoryStore.bookmarks.filter(b => b.id !== id);
      persistWebStore();
      return;
    }
    await this.run('DELETE FROM bookmarks WHERE id = ?', [id]);
  }

  // Highlights
  static async addHighlight(highlight: Omit<Highlight, 'id'>): Promise<string> {
    const id = genId('hl');
    if (isWeb) {
      hydrateWebStore();
      memoryStore.highlights.unshift({ id, ...highlight });
      persistWebStore();
      return id;
    }
    await this.run(
      `INSERT INTO highlights (id, bookId, chapter, page, text, color, timestamp, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, highlight.bookId, highlight.chapter, highlight.page, highlight.text, highlight.color, highlight.timestamp, highlight.note].map(bind)
    );
    return id;
  }

  static async getHighlights(bookId: string): Promise<Highlight[]> {
    if (isWeb) {
      hydrateWebStore();
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
      hydrateWebStore();
      const idx = memoryStore.highlights.findIndex(h => h.id === id);
      if (idx >= 0) {
        memoryStore.highlights[idx] = { ...memoryStore.highlights[idx], ...updates };
        persistWebStore();
      }
      return;
    }
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.keys(updates).map(k => bind((updates as any)[k]));
    await this.run(`UPDATE highlights SET ${fields} WHERE id = ?`, [...values, id]);
  }

  static async deleteHighlight(id: string): Promise<void> {
    if (isWeb) {
      hydrateWebStore();
      memoryStore.highlights = memoryStore.highlights.filter(h => h.id !== id);
      persistWebStore();
      return;
    }
    await this.run('DELETE FROM highlights WHERE id = ?', [id]);
  }

  // Reading Sessions
  static async addReadingSession(session: Omit<ReadingSession, 'id'>): Promise<string> {
    const id = genId('sess');
    if (isWeb) {
      hydrateWebStore();
      memoryStore.reading_sessions.unshift({ id, ...session });
      persistWebStore();
      return id;
    }
    await this.run(
      `INSERT INTO reading_sessions (id, bookId, startTime, endTime, durationMinutes, pageStart, pageEnd)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, session.bookId, session.startTime, session.endTime, session.durationMinutes, session.pageStart, session.pageEnd].map(bind)
    );
    return id;
  }

  static async getReadingStats(bookId: string): Promise<{ totalMinutes: number; sessionCount: number }> {
    if (isWeb) {
      hydrateWebStore();
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
      hydrateWebStore();
      memoryStore.reading_goals.unshift({ id, ...goal });
      persistWebStore();
      return id;
    }
    await this.run(
      `INSERT INTO reading_goals (id, name, targetPages, targetMinutes, currentProgress, createdDate, targetDate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, goal.name, goal.targetPages, goal.targetMinutes, goal.currentProgress, goal.createdDate, goal.targetDate, goal.status].map(bind)
    );
    return id;
  }

  static async getGoals(): Promise<ReadingGoal[]> {
    if (isWeb) {
      hydrateWebStore();
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
