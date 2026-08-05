// Local file import — EPUB / TXT / PDF / MOBI.
//
// PLATFORM SPLIT
// --------------
// Web is the shipping target and expo-file-system has NO web implementation
// (`documentDirectory` is null and every read/write throws), so nothing here
// may touch it unless `Platform.OS !== 'web'`. On web we take the browser
// route end to end: a real <input type="file"> for the picker, FileReader for
// the bytes, JSZip for the EPUB container, IndexedDB for the extracted text.
//
// WHY JSZip AND NOT epub.js
// -------------------------
// epub.js wants a live DOM, its own rendering iframe and a fetchable URL. All
// we need from an EPUB is the OPF metadata plus the spine documents as plain
// text, which is a zip read and a handful of well-defined XML lookups. JSZip
// does that on web and on native (React Native has no DOM, no DOMParser), so
// one code path serves both. Both libraries are already dependencies; this is
// the one that works in both runtimes.
//
// WHY THE EXTRACTED TEXT GOES TO IndexedDB
// ----------------------------------------
// DatabaseService deliberately strips `Book.content` before persisting — a
// single title can be megabytes and localStorage caps around 5MB per origin.
// Gutenberg books survive that because they can be re-fetched from
// `sourceUrl`; an imported local file cannot — the browser has no lasting
// handle on the user's disk. So the text is written to IndexedDB (which is
// quota-generous and async) under a key recorded in `Book.filePath`, and
// LibraryScreen rehydrates `content` from it on demand. On native the copied
// file itself is the store and is simply re-parsed.
//
// PDF, VIA PDF.JS
// ---------------
// pdf.js extracts the real text layer, loaded lazily so its ~1MB bundle only
// ships to a session that actually imports a PDF. Its worker is fetched from
// jsDelivr pinned to the exact installed version — the standard integration
// pattern for pdf.js in a bundler with no custom worker-loader config. A
// scanned/image-only PDF has no text layer for ANY reader to extract without
// OCR; that case is detected and reported rather than importing a blank book.
//
// HONESTY RULE (still true for MOBI/AZW)
// ---------------------------------------
// There is no dependable browser parser for MOBI/AZW — the format needs a
// PalmDOC + Huffman/CDIC decoder and no maintained JS implementation exists
// to build on. Those files import as real catalogue records — title, format,
// size, cover placeholder — and the caller is handed a `warning` string
// pointing at Calibre's free MOBI→EPUB conversion. We never fabricate text
// and never add a silently empty book.

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import JSZip from 'jszip';
import { Book } from '../types';
import { colors } from '../theme';

const isWeb = Platform.OS === 'web';

export type EbookFormat = 'epub' | 'mobi' | 'pdf' | 'txt';

/** Extensions the importer accepts. Anything else is rejected out loud. */
export const SUPPORTED_EXTENSIONS = ['epub', 'txt', 'pdf', 'mobi', 'azw', 'azw3'];

/** Formats whose text we can actually extract in this build. */
export const READABLE_EXTENSIONS = ['epub', 'txt'];

/** `accept` for the web file dialog — extensions first, browsers vary on MIME. */
const ACCEPT_ATTR =
  '.epub,.txt,.pdf,.mobi,.azw,.azw3,application/epub+zip,application/pdf,text/plain';

/** Refuse absurd inputs before we try to hold them in memory. */
const MAX_FILE_BYTES = 100 * 1024 * 1024;

/**
 * Cover art is inlined as a data URI and rides along in the persisted book
 * row, so it has to stay small or it eats the localStorage budget that the
 * rest of the library depends on. ~200KB of base64 is ~150KB of JPEG, which
 * is more than enough for a 200px cover.
 */
const MAX_COVER_BASE64 = 200 * 1024;

/** Page estimate for the library card — matches the reader's paginated budget. */
const CHARS_PER_PAGE = 1500;

/** Marks a `Book.filePath` that points at the IndexedDB text store. */
const IMPORT_SCHEME = 'annotated-import://';

const IDB_NAME = 'annotated-imports';
const IDB_STORE = 'texts';

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

/** A file the user chose, normalised across the web and native pickers. */
export interface PickedFile {
  name: string;
  /** Bytes. 0 when the platform does not report it. */
  size: number;
  mimeType?: string;
  /** `file://…` on native, an object URL (or '') on web. */
  uri: string;
  /** Web only — the actual handle we read from. */
  file?: File;
}

export type ImportStage = 'picking' | 'reading' | 'unpacking' | 'extracting' | 'saving' | 'done';

export interface ImportProgress {
  stage: ImportStage;
  /** Human-readable, ready to render. */
  label: string;
  /** 0-100. Real work completed, never a fake animation. */
  percent: number;
}

export type ProgressFn = (progress: ImportProgress) => void;

export interface EbookContent {
  title: string;
  author?: string;
  chapters: { title: string; content: string }[];
  totalPages: number;
  cover?: string;
  /** Full plain text, blank-line separated so the reader can paragraph it. */
  text: string;
  /** False for PDF/MOBI: the record is real, the text is not available. */
  textAvailable: boolean;
  /** Plain-English reason, shown to the user, when `textAvailable` is false. */
  note?: string;
  language?: string;
  description?: string;
}

export interface ImportedBook {
  /** Ready for `addBook()`. */
  book: Omit<Book, 'id'>;
  /** Present when the book imported without readable text. */
  warning?: string;
}

/** An import failure we can explain to the user in their own terms. */
export class EbookImportError extends Error {
  hint?: string;
  constructor(message: string, hint?: string) {
    super(message);
    this.name = 'EbookImportError';
    this.hint = hint;
    // Restores the prototype chain when targeting older JS engines.
    Object.setPrototypeOf(this, EbookImportError.prototype);
  }
}

/* ------------------------------------------------------------------ *
 * Small pure helpers (string / path / markup)
 * ------------------------------------------------------------------ */

function baseName(path: string): string {
  const cleaned = path.split(/[?#]/)[0];
  const parts = cleaned.split(/[\\/]/);
  return parts[parts.length - 1] || cleaned;
}

function extensionOf(fileName: string): string {
  const name = baseName(fileName);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function stripExtension(fileName: string): string {
  const name = baseName(fileName);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/** "the-pilgrims_progress (1).epub" -> "The Pilgrims Progress". */
function titleFromFileName(fileName: string): string {
  let stem = stripExtension(fileName);

  // Library-export filenames commonly read
  // "Title -- Author -- Edition, Year -- Publisher -- hash -- Site name".
  // A blind hyphen collapse below would run every field into one sentence
  // (author, publisher and hash all ending up inside the "title"), so the
  // double-hyphen is treated as a hard field separator first and only the
  // opening field — the actual title — is kept.
  const fields = stem.split(/\s+--\s+/);
  if (fields.length > 1 && fields[0].trim()) {
    stem = fields[0];
  }

  const raw = stem
    .replace(/[_+]+/g, ' ')
    .replace(/-+/g, ' ')
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return 'Untitled';
  return raw
    .split(' ')
    .map((word) => (word.length > 2 && word === word.toLowerCase() ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function dirName(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx >= 0 ? path.slice(0, idx + 1) : '';
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Resolve a manifest href against the OPF directory, collapsing `.` and `..`. */
function resolvePath(base: string, href: string): string {
  const target = safeDecode(href.split(/[?#]/)[0]);
  if (target.startsWith('/')) return target.replace(/^\/+/, '');

  const segments = (base + target).split('/');
  const out: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out.join('/');
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  shy: '',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  sbquo: '‚',
  bdquo: '„',
  dagger: '†',
  Dagger: '‡',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  deg: '°',
  pound: '£',
  euro: '€',
  sect: '§',
  para: '¶',
  laquo: '«',
  raquo: '»',
  oelig: 'œ',
  aelig: 'æ',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
  ccedil: 'ç',
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[body];
    return named !== undefined ? named : match;
  });
}

function stripTags(markup: string): string {
  return decodeEntities(markup.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

/**
 * XHTML -> plain text, preserving paragraph boundaries as blank lines.
 *
 * The blank lines matter: GutenbergService.parse() (which the reader uses for
 * every book, imported or not) splits on `\n\s*\n`. Collapse the structure
 * here and the whole book arrives as one unreadable mega-paragraph.
 */
function htmlToText(markup: string): string {
  let text = markup;

  text = text.replace(/<\?[\s\S]*?\?>/g, ' ');
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');
  text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  text = text.replace(/<!DOCTYPE[^>]*>/gi, ' ');
  text = text.replace(/<(script|style|head|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');

  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n\n');
  text = text.replace(
    /<\/(p|div|section|article|aside|blockquote|li|ul|ol|dd|dt|dl|tr|td|th|h[1-6]|pre|figure|figcaption|header|footer|nav)\s*>/gi,
    '\n\n'
  );
  text = text.replace(/<(p|div|section|blockquote|h[1-6]|li)\b[^>]*\/>/gi, '\n\n');
  text = text.replace(/<[^>]*>/g, '');

  text = decodeEntities(text);

  text = text.replace(/\r\n?/g, '\n');
  text = text.replace(/[ \t\u00a0\u2007\u202f]+/g, ' ');
  text = text.replace(/ *\n */g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/** First heading in a spine document, used as the chapter label. */
function headingFrom(markup: string): string | undefined {
  const match = markup.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (!match) return undefined;
  const heading = stripTags(match[1]);
  return heading && heading.length <= 120 ? heading : undefined;
}

/** Read one attribute off a single start tag. */
function attr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  if (!match) return undefined;
  const value = match[2] !== undefined ? match[2] : match[3];
  return value !== undefined ? decodeEntities(value).trim() : undefined;
}

/** Namespace-agnostic element lookup: matches `<dc:title>` and `<title>`. */
function elementText(xml: string, localName: string): string | undefined {
  const match = xml.match(
    new RegExp(`<(?:[A-Za-z0-9_.-]+:)?${localName}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9_.-]+:)?${localName}\\s*>`, 'i')
  );
  if (!match) return undefined;
  const value = stripTags(match[1]);
  return value || undefined;
}

/* ------------------------------------------------------------------ *
 * Web file reading
 * ------------------------------------------------------------------ */

function readFileWeb(
  file: File,
  as: 'arrayBuffer' | 'text',
  onFraction?: (fraction: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(
        new EbookImportError(
          `"${file.name}" could not be read.`,
          reader.error?.message || 'The browser refused access to the file.'
        )
      );
    reader.onabort = () => reject(new EbookImportError(`Reading "${file.name}" was interrupted.`));
    reader.onprogress = (event) => {
      if (onFraction && event.lengthComputable && event.total > 0) {
        onFraction(event.loaded / event.total);
      }
    };
    reader.onload = () => resolve(reader.result);
    if (as === 'text') reader.readAsText(file, 'utf-8');
    else reader.readAsArrayBuffer(file);
  });
}

/**
 * The web picker.
 *
 * expo-document-picker's web path never resolves on cancel (documented
 * platform limitation), which would leave the import UI spinning forever, so
 * we drive the input ourselves: `change` for a selection, `cancel` where the
 * browser supports it, and a focus-based fallback for the browsers that do
 * not. Must be called straight off a user gesture — the click below is
 * synchronous with the caller's tap for exactly that reason.
 */
function pickFileWeb(): Promise<PickedFile | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise<PickedFile | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT_ATTR;
    input.multiple = false;
    input.style.position = 'fixed';
    input.style.top = '-1000px';
    input.style.left = '-1000px';
    input.style.opacity = '0';
    document.body.appendChild(input);

    let settled = false;
    let fallbackTimer: any = null;

    const finish = (value: PickedFile | null) => {
      if (settled) return;
      settled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      window.removeEventListener('focus', onWindowFocus);
      try {
        input.remove();
      } catch {
        /* already detached */
      }
      resolve(value);
    };

    const onChange = () => {
      const file = input.files && input.files[0];
      if (!file) {
        finish(null);
        return;
      }
      finish({
        name: file.name,
        size: file.size,
        mimeType: file.type || undefined,
        uri: '',
        file,
      });
    };

    function onWindowFocus() {
      // The dialog closed. `change` fires shortly after a real selection, so
      // give it a beat before declaring the pick cancelled.
      fallbackTimer = setTimeout(() => {
        if (!input.files || input.files.length === 0) finish(null);
      }, 1200);
    }

    input.addEventListener('change', onChange);
    input.addEventListener('cancel', () => finish(null));
    window.addEventListener('focus', onWindowFocus);

    input.click();
  });
}

/* ------------------------------------------------------------------ *
 * IndexedDB text store (web)
 *
 * Every operation degrades to a no-op when IndexedDB is missing or blocked
 * (private mode, SSR/prerender). Import must still work in that session; only
 * the survive-a-reload part is lost.
 * ------------------------------------------------------------------ */

function openIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (!isWeb || typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(IDB_NAME, 1);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function idbPut(key: string, value: string): Promise<boolean> {
  const db = await openIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      try {
        db.close();
      } catch {
        /* noop */
      }
      resolve(false);
    }
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const request = tx.objectStore(IDB_STORE).get(key);
      request.onsuccess = () => {
        const value = request.result;
        db.close();
        resolve(typeof value === 'string' && value.length > 0 ? value : null);
      };
      request.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      try {
        db.close();
      } catch {
        /* noop */
      }
      resolve(null);
    }
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      try {
        db.close();
      } catch {
        /* noop */
      }
      resolve();
    }
  });
}

/* ------------------------------------------------------------------ *
 * Zip helpers
 * ------------------------------------------------------------------ */

/** Tolerant lookup: EPUBs in the wild percent-encode and mis-case paths. */
function zipEntry(zip: JSZip, path: string): JSZip.JSZipObject | null {
  const cleaned = path.replace(/^\/+/, '');
  const direct = zip.file(cleaned);
  if (direct) return direct;

  const decoded = safeDecode(cleaned);
  if (decoded !== cleaned) {
    const viaDecoded = zip.file(decoded);
    if (viaDecoded) return viaDecoded;
  }

  const wanted = decoded.toLowerCase();
  let found: any = null;
  zip.forEach((relativePath, entry) => {
    if (found || entry.dir) return;
    const candidate = safeDecode(relativePath).toLowerCase();
    if (candidate === wanted || candidate.endsWith('/' + wanted)) found = entry;
  });
  return found;
}

async function zipText(zip: JSZip, path: string): Promise<string | null> {
  const entry = zipEntry(zip, path);
  if (!entry) return null;
  try {
    return await entry.async('string');
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Service
 * ------------------------------------------------------------------ */

export class EbookService {
  /* --------------------------------------------------------------- picking */

  /**
   * Show the system file dialog. Resolves `null` when the user cancels.
   * On web this must run inside the user-gesture task, so callers should
   * `await` it as the first thing they do in the press handler.
   */
  static async pickFile(): Promise<PickedFile | null> {
    if (isWeb) return pickFileWeb();

    try {
      // Android providers routinely report .epub as application/octet-stream,
      // which a MIME-filtered picker hides. Show everything and validate the
      // extension ourselves so the user's own files are never unreachable.
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return null;

      const asset = result.assets && result.assets[0];
      if (!asset) return null;

      return {
        name: asset.name || baseName(asset.uri) || 'Untitled',
        size: asset.size || 0,
        mimeType: asset.mimeType,
        uri: asset.uri,
        file: asset.file,
      };
    } catch (error) {
      console.error('[EbookService] File picker error:', error);
      throw new EbookImportError(
        'The file picker could not be opened.',
        error instanceof Error ? error.message : undefined
      );
    }
  }

  /* -------------------------------------------------------------- importing */

  /**
   * Picked file -> a Book ready for `addBook()`.
   *
   * Never throws for "this format has no text extractor" — that returns a
   * complete record plus a `warning` for the UI. It throws only when the
   * import genuinely failed (unreadable file, wrong format, too large).
   */
  static async importFile(picked: PickedFile, onProgress?: ProgressFn): Promise<ImportedBook> {
    const report = (stage: ImportStage, label: string, percent: number) => {
      if (!onProgress) return;
      try {
        onProgress({ stage, label, percent: Math.max(0, Math.min(100, Math.round(percent))) });
      } catch {
        /* a broken listener must not fail the import */
      }
    };

    const extension = extensionOf(picked.name);
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      throw new EbookImportError(
        `Annotated can't open "${picked.name}".`,
        'Supported files: EPUB, TXT, PDF, MOBI, AZW and AZW3.'
      );
    }

    if (picked.size > MAX_FILE_BYTES) {
      throw new EbookImportError(
        `"${picked.name}" is ${this.getReadableFileSize(picked.size)} — too large to import.`,
        `The limit is ${this.getReadableFileSize(MAX_FILE_BYTES)}.`
      );
    }

    const format = this.getFileFormat(picked.name);
    report('reading', 'Reading file', 4);

    const parsed = await this.parseEbook(picked, format, onProgress);

    report('saving', 'Saving to your library', 92);

    let filePath: string | undefined;
    if (isWeb) {
      // A blob: URL dies with the page, so it is worthless as a stored path.
      // What we keep is the extracted text, under an IndexedDB key.
      if (parsed.textAvailable && parsed.text) {
        const key = `import_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const stored = await idbPut(key, parsed.text);
        if (stored) filePath = `${IMPORT_SCHEME}${key}`;
      }
    } else {
      try {
        filePath = await this.copyToLibrary(picked.uri, picked.name);
      } catch (error) {
        // The book is still usable this session; only the copy failed.
        console.warn('[EbookService] Could not copy the file into the library:', error);
      }
    }

    const title = parsed.title || titleFromFileName(picked.name);
    const text = parsed.textAvailable ? parsed.text : '';

    const book: Omit<Book, 'id'> = {
      title,
      author: parsed.author,
      cover: parsed.cover,
      coverColor: colors.board,
      filePath,
      fileName: picked.name,
      fileFormat: format,
      fileSize: picked.size || 0,
      currentProgress: 0,
      totalPages: text ? this.calculatePages(text, CHARS_PER_PAGE) : 0,
      addedDate: Date.now(),
      lastReadDate: Date.now(),
      readingTimeMinutes: 0,
      isFinished: false,
      isFavorite: false,
      itemType: 'book',
      description: parsed.description,
      language: parsed.language,
      content: text || undefined,
    };

    report('done', 'Added to your library', 100);

    return { book, warning: parsed.textAvailable ? undefined : parsed.note };
  }

  /**
   * Native only: keep a copy of the file inside the app's document directory
   * so the text can be re-parsed after a restart. On web there is no
   * filesystem to copy into, so the picked reference is handed straight back.
   */
  static async copyToLibrary(uri: string, fileName: string): Promise<string> {
    if (isWeb) return uri;

    const libDir = `${FileSystem.documentDirectory}books/`;
    await FileSystem.makeDirectoryAsync(libDir, { intermediates: true });
    const safeName = baseName(fileName).replace(/[^A-Za-z0-9._-]+/g, '_');
    const newPath = `${libDir}${Date.now()}_${safeName}`;
    await FileSystem.copyAsync({ from: uri, to: newPath });
    return newPath;
  }

  static getFileFormat(fileName: string): EbookFormat {
    const formats: Record<string, EbookFormat> = {
      epub: 'epub',
      mobi: 'mobi',
      azw: 'mobi',
      azw3: 'mobi',
      prc: 'mobi',
      pdf: 'pdf',
      txt: 'txt',
      text: 'txt',
      md: 'txt',
    };
    return formats[extensionOf(fileName)] || 'txt';
  }

  /* ---------------------------------------------------------------- parsing */

  /**
   * Parse a picked file (or, on native, a path already on disk).
   *
   * PDF and MOBI resolve with `textAvailable: false` and a `note` rather than
   * throwing: the caller still gets a valid catalogue record to store.
   */
  static async parseEbook(
    source: PickedFile | string,
    format: string,
    onProgress?: ProgressFn
  ): Promise<EbookContent> {
    const picked: PickedFile =
      typeof source === 'string' ? { name: baseName(source), size: 0, uri: source } : source;

    switch (format) {
      case 'epub':
        return this.parseEpub(picked, onProgress);
      case 'txt':
        return this.parseTxt(picked, onProgress);
      case 'pdf':
        return this.parsePdf(picked, onProgress);
      case 'mobi':
        return this.describeUnextractable(picked, format as EbookFormat);
      default:
        throw new EbookImportError(`Annotated has no reader for .${format} files.`);
    }
  }

  /**
   * Honest placeholder for the one format we still cannot read.
   *
   * MOBI/AZW3 needs a PalmDOC + Huffman/CDIC decoder. No maintained
   * JavaScript implementation exists to build on (checked the npm registry:
   * the only package named `mobi` is a dead 2012 stub with an unrelated
   * dependency) — every real MOBI-capable reader either ships Amazon's own
   * closed decoder or shells out to Calibre to convert the file first. A
   * hand-rolled decoder risks silently mis-decoding text, which is worse
   * than telling the truth, so the book is catalogued and the user is told
   * exactly what did and did not happen.
   */
  private static describeUnextractable(picked: PickedFile, format: EbookFormat): EbookContent {
    const note = `"${titleFromFileName(picked.name)}" is on the shelf, but its text could not be extracted — Annotated cannot read MOBI/AZW files yet. Convert it to EPUB with Calibre (free, calibre-ebook.com) and import the result to read it here.`;

    return {
      title: titleFromFileName(picked.name),
      chapters: [],
      totalPages: 0,
      text: '',
      textAvailable: false,
      note,
    };
  }

  /**
   * PDF via pdf.js — the actual text layer, not an approximation.
   *
   * pdf.js is loaded lazily (only when a PDF is actually imported) and its
   * worker is fetched from a CDN pinned to the exact installed version, which
   * avoids wiring a custom Metro worker-loader config for one format.
   *
   * A scanned/image-only PDF has no text layer at all — no reader, including
   * this one, can extract words from a picture of a page without OCR. That
   * case is detected and reported honestly rather than importing an empty
   * or garbled book.
   */
  private static async parsePdf(picked: PickedFile, onProgress?: ProgressFn): Promise<EbookContent> {
    if (!isWeb) {
      throw new EbookImportError(
        `"${picked.name}" could not be opened.`,
        'PDF reading is only available in the web build.'
      );
    }
    if (!picked.file) {
      throw new EbookImportError(
        `"${picked.name}" is no longer available.`,
        'Pick the file again — the browser only lends access for a moment.'
      );
    }

    const report = (percent: number, label: string) => {
      if (!onProgress) return;
      try {
        onProgress({ stage: 'extracting', label, percent: Math.max(0, Math.min(100, Math.round(percent))) });
      } catch {
        /* ignore listener errors */
      }
    };

    report(2, 'Reading file');
    const buffer = await readFileWeb(picked.file, 'arrayBuffer', (fraction) => report(2 + fraction * 8, 'Reading file'));

    report(12, 'Loading PDF engine');
    const pdfjsLib = await import('pdfjs-dist');
    // Pin the worker to the exact installed version so it can never drift out
    // of sync with the API this code was written against.
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    let doc;
    try {
      doc = await pdfjsLib.getDocument({
        data: buffer,
        // Without this, PDFs that reference a standard base-14 font (Times,
        // Helvetica, Courier…) rather than embedding their own — the common
        // case for plainly-typeset documents — throw an UnknownErrorException
        // asking for exactly this. Same version-pinned CDN pattern as the
        // worker, pointed at pdf.js's bundled Foxit/Liberation substitutes.
        standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
      }).promise;
    } catch (error: any) {
      if (error?.name === 'PasswordException') {
        throw new EbookImportError(
          `"${picked.name}" is password-protected.`,
          'Remove the password (e.g. with Calibre or your PDF viewer) and import it again.'
        );
      }
      throw new EbookImportError(
        `"${picked.name}" could not be opened as a PDF.`,
        'The file may be damaged or not a real PDF.'
      );
    }

    const numPages = doc.numPages;
    const pageTexts: string[] = [];
    for (let i = 1; i <= numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      pageTexts.push(pageText);
      report(15 + (i / numPages) * 75, `Extracting text — page ${i} of ${numPages}`);
    }

    const text = pageTexts.filter(Boolean).join('\n\n');
    const nonEmptyPages = pageTexts.filter((t) => t.length > 0).length;

    // Below this bar the PDF is almost certainly scanned pages/images with no
    // embedded text — importing it as "readable" would just show a nearly
    // blank book with no honest way to explain why.
    if (text.length < 200 || nonEmptyPages / numPages < 0.5) {
      throw new EbookImportError(
        `"${picked.name}" has no readable text layer.`,
        'This looks like a scanned or image-only PDF — the pages are pictures of text, not digital text, so no reader can extract them without OCR.'
      );
    }

    report(92, 'Reading metadata');
    let title: string | undefined;
    let author: string | undefined;
    try {
      const meta: any = await doc.getMetadata();
      const info = meta?.info || {};
      if (typeof info.Title === 'string' && info.Title.trim()) title = info.Title.trim();
      if (typeof info.Author === 'string' && info.Author.trim()) author = info.Author.trim();
    } catch {
      /* PDF metadata is optional; fall through to the filename. */
    }

    report(98, 'Finishing up');
    return {
      title: title || titleFromFileName(picked.name),
      author,
      chapters: [{ title: 'Full Text', content: text }],
      totalPages: this.calculatePages(text, CHARS_PER_PAGE),
      text,
      textAvailable: true,
    };
  }

  private static async parseTxt(picked: PickedFile, onProgress?: ProgressFn): Promise<EbookContent> {
    const raw = await this.readText(picked, onProgress);
    const text = raw.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

    if (!text) {
      throw new EbookImportError(`"${picked.name}" is empty.`, 'There is no text to read in this file.');
    }

    // Plain-text Gutenberg downloads carry their metadata in the header.
    const header = text.slice(0, 3000);
    const titleLine = header.match(/^\s*Title:\s*(.+)$/im);
    const authorLine = header.match(/^\s*Author:\s*(.+)$/im);
    const languageLine = header.match(/^\s*Language:\s*(.+)$/im);

    return {
      title: (titleLine && titleLine[1].trim()) || titleFromFileName(picked.name),
      author: authorLine ? authorLine[1].trim() : undefined,
      language: languageLine ? languageLine[1].trim() : undefined,
      chapters: [{ title: 'Full Text', content: text }],
      totalPages: this.calculatePages(text, CHARS_PER_PAGE),
      text,
      textAvailable: true,
    };
  }

  private static async parseEpub(picked: PickedFile, onProgress?: ProgressFn): Promise<EbookContent> {
    const report = (stage: ImportStage, label: string, percent: number) => {
      if (!onProgress) return;
      try {
        onProgress({ stage, label, percent: Math.max(0, Math.min(100, Math.round(percent))) });
      } catch {
        /* ignore listener errors */
      }
    };

    const zip = await this.openZip(picked, onProgress);
    report('unpacking', 'Reading the EPUB container', 22);

    // 1. container.xml points at the OPF package document.
    const container = await zipText(zip, 'META-INF/container.xml');
    let opfPath = container ? attr(container.match(/<rootfile\b[^>]*>/i)?.[0] || '', 'full-path') : undefined;

    if (!opfPath) {
      // Some hand-rolled EPUBs ship a broken container; find the OPF directly.
      zip.forEach((relativePath, entry) => {
        if (!opfPath && !entry.dir && /\.opf$/i.test(relativePath)) opfPath = relativePath;
      });
    }
    if (!opfPath) {
      throw new EbookImportError(
        `"${picked.name}" is not a readable EPUB.`,
        'The archive has no package document (.opf), so there is nothing to open.'
      );
    }

    const opf = await zipText(zip, opfPath);
    if (!opf) {
      throw new EbookImportError(
        `"${picked.name}" is not a readable EPUB.`,
        `The package document (${opfPath}) could not be read.`
      );
    }

    const opfDir = dirName(opfPath.replace(/^\/+/, ''));

    // 2. Metadata.
    const metadataBlock =
      opf.match(/<(?:[A-Za-z0-9_.-]+:)?metadata\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_.-]+:)?metadata\s*>/i)?.[1] || opf;

    const title = elementText(metadataBlock, 'title') || titleFromFileName(picked.name);
    const author = elementText(metadataBlock, 'creator');
    const language = elementText(metadataBlock, 'language');
    const rawDescription = elementText(metadataBlock, 'description');
    const description = rawDescription
      ? rawDescription.length > 800
        ? `${rawDescription.slice(0, 797)}…`
        : rawDescription
      : undefined;

    // 3. Manifest and spine.
    const manifest = new Map<string, { href: string; type: string; properties: string }>();
    for (const tag of opf.match(/<(?:[A-Za-z0-9_.-]+:)?item\b[^>]*>/gi) || []) {
      const id = attr(tag, 'id');
      const href = attr(tag, 'href');
      if (!id || !href) continue;
      manifest.set(id, {
        href,
        type: (attr(tag, 'media-type') || '').toLowerCase(),
        properties: (attr(tag, 'properties') || '').toLowerCase(),
      });
    }

    const spineIds: string[] = [];
    for (const tag of opf.match(/<(?:[A-Za-z0-9_.-]+:)?itemref\b[^>]*>/gi) || []) {
      const idref = attr(tag, 'idref');
      if (!idref) continue;
      if ((attr(tag, 'linear') || '').toLowerCase() === 'no') continue;
      spineIds.push(idref);
    }

    const isDocument = (type: string, href: string) =>
      type.includes('xhtml') ||
      type.includes('html') ||
      (!type && /\.x?html?$/i.test(href));

    let documents = spineIds
      .map((id) => manifest.get(id))
      .filter((item): item is { href: string; type: string; properties: string } => !!item)
      .filter((item) => isDocument(item.type, item.href));

    if (!documents.length) {
      // No usable spine — fall back to every HTML document in the manifest.
      documents = Array.from(manifest.values()).filter((item) => isDocument(item.type, item.href));
    }
    if (!documents.length) {
      throw new EbookImportError(
        `No readable chapters were found in "${picked.name}".`,
        'The EPUB lists no HTML content documents.'
      );
    }

    // 4. Chapter text. This is the long pole, so it owns most of the bar.
    const chapters: { title: string; content: string }[] = [];
    const blocks: string[] = [];

    for (let index = 0; index < documents.length; index += 1) {
      const item = documents[index];
      report(
        'extracting',
        `Extracting text — section ${index + 1} of ${documents.length}`,
        25 + (index / documents.length) * 60
      );

      const markup = await zipText(zip, resolvePath(opfDir, item.href));
      if (!markup) continue;

      const body = htmlToText(markup);
      if (!body || body.length < 2) continue;

      chapters.push({ title: headingFrom(markup) || `Section ${chapters.length + 1}`, content: body });
      blocks.push(body);
    }

    const text = blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();

    if (!text) {
      throw new EbookImportError(
        `No text could be extracted from "${picked.name}".`,
        'Every chapter in this EPUB came back empty — it may be a scanned or DRM-protected file.'
      );
    }

    // 5. Cover art, best effort — a missing cover is never an import failure.
    report('extracting', 'Looking for cover art', 88);
    const cover = await this.extractEpubCover(zip, opf, opfDir, manifest);

    return {
      title,
      author,
      language,
      description,
      chapters,
      totalPages: this.calculatePages(text, CHARS_PER_PAGE),
      cover,
      text,
      textAvailable: true,
    };
  }

  /** EPUB 2 (`<meta name="cover">`) and EPUB 3 (`properties="cover-image"`). */
  private static async extractEpubCover(
    zip: JSZip,
    opf: string,
    opfDir: string,
    manifest: Map<string, { href: string; type: string; properties: string }>
  ): Promise<string | undefined> {
    try {
      let candidate: { href: string; type: string } | undefined;

      for (const item of manifest.values()) {
        if (item.properties.includes('cover-image') && item.type.startsWith('image/')) {
          candidate = item;
          break;
        }
      }

      if (!candidate) {
        const metaTag = (opf.match(/<meta\b[^>]*>/gi) || []).find(
          (tag) => (attr(tag, 'name') || '').toLowerCase() === 'cover'
        );
        const coverId = metaTag ? attr(metaTag, 'content') : undefined;
        const item = coverId ? manifest.get(coverId) : undefined;
        if (item && (item.type.startsWith('image/') || /\.(jpe?g|png|gif|webp)$/i.test(item.href))) {
          candidate = item;
        }
      }

      if (!candidate) {
        for (const item of manifest.values()) {
          if (item.type.startsWith('image/') && /cover/i.test(item.href)) {
            candidate = item;
            break;
          }
        }
      }

      if (!candidate) return undefined;

      const entry = zipEntry(zip, resolvePath(opfDir, candidate.href));
      if (!entry) return undefined;

      const base64 = await entry.async('base64');
      if (!base64 || base64.length > MAX_COVER_BASE64) return undefined;

      const mime =
        candidate.type && candidate.type.startsWith('image/')
          ? candidate.type
          : /\.png$/i.test(candidate.href)
          ? 'image/png'
          : /\.gif$/i.test(candidate.href)
          ? 'image/gif'
          : /\.webp$/i.test(candidate.href)
          ? 'image/webp'
          : 'image/jpeg';

      return `data:${mime};base64,${base64}`;
    } catch {
      return undefined;
    }
  }

  /* ------------------------------------------------------------ file access */

  private static async openZip(picked: PickedFile, onProgress?: ProgressFn): Promise<JSZip> {
    const report = (percent: number, label: string) => {
      if (!onProgress) return;
      try {
        onProgress({ stage: 'reading', label, percent: Math.max(0, Math.min(100, Math.round(percent))) });
      } catch {
        /* ignore listener errors */
      }
    };

    try {
      if (isWeb) {
        if (!picked.file) {
          throw new EbookImportError(
            `"${picked.name}" is no longer available.`,
            'Pick the file again — the browser only lends access for a moment.'
          );
        }
        const buffer = await readFileWeb(picked.file, 'arrayBuffer', (fraction) =>
          report(4 + fraction * 14, 'Reading file')
        );
        report(18, 'Unpacking the EPUB');
        return await JSZip.loadAsync(buffer);
      }

      const base64 = await FileSystem.readAsStringAsync(picked.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      report(18, 'Unpacking the EPUB');
      return await JSZip.loadAsync(base64, { base64: true });
    } catch (error) {
      if (error instanceof EbookImportError) throw error;
      throw new EbookImportError(
        `"${picked.name}" could not be opened as an EPUB.`,
        'The archive is unreadable — the file may be damaged or DRM-protected.'
      );
    }
  }

  private static async readText(picked: PickedFile, onProgress?: ProgressFn): Promise<string> {
    try {
      if (isWeb) {
        if (!picked.file) {
          throw new EbookImportError(
            `"${picked.name}" is no longer available.`,
            'Pick the file again — the browser only lends access for a moment.'
          );
        }
        return await readFileWeb(picked.file, 'text', (fraction) => {
          if (!onProgress) return;
          try {
            onProgress({
              stage: 'reading',
              label: 'Reading file',
              percent: Math.round(5 + fraction * 80),
            });
          } catch {
            /* ignore listener errors */
          }
        });
      }
      return await FileSystem.readAsStringAsync(picked.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch (error) {
      if (error instanceof EbookImportError) throw error;
      throw new EbookImportError(
        `"${picked.name}" could not be read.`,
        error instanceof Error ? error.message : undefined
      );
    }
  }

  /* ------------------------------------------------------- stored full text */

  /** True when this book's text can be restored without the user re-picking. */
  static hasStoredText(book: Partial<Book>): boolean {
    if (!book || !book.filePath) return false;
    if (book.filePath.startsWith(IMPORT_SCHEME)) return true;
    if (isWeb) return false;
    const format = book.fileFormat || this.getFileFormat(book.fileName || book.filePath);
    return READABLE_EXTENSIONS.includes(format);
  }

  /**
   * Re-read the full text of a previously imported book.
   *
   * Web: straight out of IndexedDB. Native: re-parse the copy on disk.
   * Returns null rather than throwing — a failed rehydrate is a missing book
   * body, not a crash.
   */
  static async loadStoredText(book: Partial<Book>): Promise<string | null> {
    const path = book?.filePath;
    if (!path) return null;

    try {
      if (path.startsWith(IMPORT_SCHEME)) {
        return await idbGet(path.slice(IMPORT_SCHEME.length));
      }
      if (isWeb) return null;

      const format = book.fileFormat || this.getFileFormat(book.fileName || path);
      if (!READABLE_EXTENSIONS.includes(format)) return null;

      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return null;

      const parsed = await this.parseEbook(
        { name: book.fileName || baseName(path), size: 0, uri: path },
        format
      );
      return parsed.text || null;
    } catch (error) {
      console.warn('[EbookService] Could not restore stored text:', error);
      return null;
    }
  }

  /* ---------------------------------------------------------------- cleanup */

  /** Drop the stored copy of an imported book. Never throws. */
  static async deleteBook(filePath: string): Promise<void> {
    if (!filePath) return;
    try {
      if (filePath.startsWith(IMPORT_SCHEME)) {
        await idbDelete(filePath.slice(IMPORT_SCHEME.length));
        return;
      }
      if (isWeb) return;
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    } catch (error) {
      console.warn('[EbookService] Delete error:', error);
    }
  }

  /* ------------------------------------------------------------ formatting */

  static calculatePages(content: string, charsPerPage: number = 500): number {
    if (!content) return 0;
    return Math.max(1, Math.ceil(content.length / charsPerPage));
  }

  static getReadableFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  }

  /** Turn any thrown value into something worth showing a human. */
  static describeError(error: unknown): { message: string; hint?: string } {
    if (error instanceof EbookImportError) return { message: error.message, hint: error.hint };
    if (error instanceof Error) return { message: error.message };
    if (typeof error === 'string' && error.trim()) return { message: error };
    return { message: 'The import failed for an unknown reason.' };
  }
}
