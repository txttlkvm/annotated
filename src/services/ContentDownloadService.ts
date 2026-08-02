import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { ClassicalLibraryItem } from '../types';

const CONTENT_DIR = `${FileSystem.documentDirectory}classical_content/`;
const BOOKS_DIR = `${CONTENT_DIR}books/`;
const MUSIC_DIR = `${CONTENT_DIR}music/`;
const ART_DIR = `${CONTENT_DIR}art/`;

export interface DownloadProgress {
  itemId: string;
  progress: number; // 0-100
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  size: number;
  error?: string;
}

export class ContentDownloadService {
  private static downloads = new Map<string, DownloadProgress>();
  private static listeners = new Set<(progress: DownloadProgress) => void>();

  static async initDirectories() {
    try {
      const dirs = [CONTENT_DIR, BOOKS_DIR, MUSIC_DIR, ART_DIR];
      for (const dir of dirs) {
        const info = await FileSystem.getInfoAsync(dir);
        if (!info.exists) {
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        }
      }
    } catch (error) {
      console.error('Directory init error:', error);
    }
  }

  static onDownloadProgress(listener: (progress: DownloadProgress) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private static notifyProgress(progress: DownloadProgress) {
    this.downloads.set(progress.itemId, progress);
    this.listeners.forEach(listener => listener(progress));
  }

  static async downloadBook(
    item: ClassicalLibraryItem,
    sourceUrl: string,
    format: 'epub' | 'pdf' | 'txt' = 'epub'
  ): Promise<string> {
    const fileName = `${item.id}.${format}`;
    const filePath = `${BOOKS_DIR}${fileName}`;

    // Check if already downloaded
    const existing = await FileSystem.getInfoAsync(filePath);
    if (existing.exists) {
      return filePath;
    }

    try {
      this.notifyProgress({
        itemId: item.id,
        progress: 0,
        status: 'downloading',
        size: 0,
      });

      const downloadResult = await FileSystem.downloadAsync(sourceUrl, filePath, {
        progressInterval: 1000,
      });

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      const info = await FileSystem.getInfoAsync(filePath);
      const size = info.size || 0;

      this.notifyProgress({
        itemId: item.id,
        progress: 100,
        status: 'completed',
        size,
      });

      return filePath;
    } catch (error) {
      this.notifyProgress({
        itemId: item.id,
        progress: 0,
        status: 'failed',
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  static async downloadMusic(
    item: ClassicalLibraryItem,
    sourceUrl: string
  ): Promise<string> {
    const fileName = `${item.id}.mp3`;
    const filePath = `${MUSIC_DIR}${fileName}`;

    // Check if already downloaded
    const existing = await FileSystem.getInfoAsync(filePath);
    if (existing.exists) {
      return filePath;
    }

    try {
      this.notifyProgress({
        itemId: item.id,
        progress: 0,
        status: 'downloading',
        size: 0,
      });

      const downloadResult = await FileSystem.downloadAsync(sourceUrl, filePath);

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      const info = await FileSystem.getInfoAsync(filePath);
      const size = info.size || 0;

      this.notifyProgress({
        itemId: item.id,
        progress: 100,
        status: 'completed',
        size,
      });

      return filePath;
    } catch (error) {
      this.notifyProgress({
        itemId: item.id,
        progress: 0,
        status: 'failed',
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  static async downloadArt(
    item: ClassicalLibraryItem,
    sourceUrl: string
  ): Promise<string> {
    const fileName = `${item.id}.jpg`;
    const filePath = `${ART_DIR}${fileName}`;

    // Check if already downloaded
    const existing = await FileSystem.getInfoAsync(filePath);
    if (existing.exists) {
      return filePath;
    }

    try {
      this.notifyProgress({
        itemId: item.id,
        progress: 0,
        status: 'downloading',
        size: 0,
      });

      const downloadResult = await FileSystem.downloadAsync(sourceUrl, filePath);

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      const info = await FileSystem.getInfoAsync(filePath);
      const size = info.size || 0;

      this.notifyProgress({
        itemId: item.id,
        progress: 100,
        status: 'completed',
        size,
      });

      return filePath;
    } catch (error) {
      this.notifyProgress({
        itemId: item.id,
        progress: 0,
        status: 'failed',
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  static async getLocalPath(itemId: string, type: 'book' | 'music' | 'art'): Promise<string | null> {
    const dir = type === 'book' ? BOOKS_DIR : type === 'music' ? MUSIC_DIR : ART_DIR;
    const files = await FileSystem.readDirectoryAsync(dir);

    const file = files.find(f => f.startsWith(itemId));
    return file ? `${dir}${file}` : null;
  }

  static async getDownloadProgress(itemId: string): Promise<DownloadProgress | undefined> {
    return this.downloads.get(itemId);
  }

  static async deleteContent(itemId: string): Promise<void> {
    try {
      const bookPath = await this.getLocalPath(itemId, 'book');
      const musicPath = await this.getLocalPath(itemId, 'music');
      const artPath = await this.getLocalPath(itemId, 'art');

      if (bookPath) await FileSystem.deleteAsync(bookPath);
      if (musicPath) await FileSystem.deleteAsync(musicPath);
      if (artPath) await FileSystem.deleteAsync(artPath);

      this.downloads.delete(itemId);
    } catch (error) {
      console.error('Delete error:', error);
    }
  }

  static async getTotalContentSize(): Promise<number> {
    try {
      let total = 0;
      const dirs = [BOOKS_DIR, MUSIC_DIR, ART_DIR];

      for (const dir of dirs) {
        const files = await FileSystem.readDirectoryAsync(dir);
        for (const file of files) {
          const info = await FileSystem.getInfoAsync(`${dir}${file}`);
          if (info.size) total += info.size;
        }
      }

      return total;
    } catch (error) {
      console.error('Size calculation error:', error);
      return 0;
    }
  }

  static async clearAllContent(): Promise<void> {
    try {
      const dirs = [BOOKS_DIR, MUSIC_DIR, ART_DIR];
      for (const dir of dirs) {
        const files = await FileSystem.readDirectoryAsync(dir);
        for (const file of files) {
          await FileSystem.deleteAsync(`${dir}${file}`);
        }
      }
      this.downloads.clear();
    } catch (error) {
      console.error('Clear error:', error);
    }
  }
}
