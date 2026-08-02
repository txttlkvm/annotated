import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { getPublicDomainSources } from '../data/publicDomainSources';
import { ClassicalLibraryItem } from '../types';

const CACHE_DIR = `${FileSystem.cacheDirectory}classical_library/`;
const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB

export interface ResourceMetadata {
  itemId: string;
  itemTitle: string;
  downloadedAt: number;
  size: number;
  type: 'epub' | 'txt' | 'pdf' | 'html' | 'audio' | 'image';
  provider: string;
  url: string;
}

export class ResourceService {
  static async initCache() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('Cache init error:', error);
    }
  }

  static async getSourcesForItem(item: ClassicalLibraryItem) {
    // Check if item already has sources
    if (item.sources && item.sources.length > 0) {
      return item.sources;
    }

    // Try to find public domain sources
    const pdSources = getPublicDomainSources(item.title);
    return pdSources || [];
  }

  static async downloadResource(
    itemId: string,
    itemTitle: string,
    url: string,
    type: 'epub' | 'txt' | 'pdf' | 'html' | 'audio' | 'image',
    provider: string
  ): Promise<string> {
    try {
      await this.initCache();

      const fileName = `${itemId}_${Date.now()}.${type}`;
      const filePath = `${CACHE_DIR}${fileName}`;

      // Download file
      const downloadResult = await FileSystem.downloadAsync(url, filePath);

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      // Store metadata
      const metadata: ResourceMetadata = {
        itemId,
        itemTitle,
        downloadedAt: Date.now(),
        size: 0, // Will be updated
        type,
        provider,
        url,
      };

      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists && fileInfo.size) {
        metadata.size = fileInfo.size;
      }

      // Save metadata
      const metadataPath = `${CACHE_DIR}${itemId}_metadata.json`;
      await FileSystem.writeAsStringAsync(metadataPath, JSON.stringify(metadata));

      // Check cache size and clean if needed
      await this.manageCacheSize();

      return filePath;
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  }

  static async getCachedResource(itemId: string): Promise<string | null> {
    try {
      const metadataPath = `${CACHE_DIR}${itemId}_metadata.json`;
      const metadataInfo = await FileSystem.getInfoAsync(metadataPath);

      if (!metadataInfo.exists) {
        return null;
      }

      const metadataContent = await FileSystem.readAsStringAsync(metadataPath);
      const metadata = JSON.parse(metadataContent) as ResourceMetadata;

      // Check if resource still exists
      const resourceInfo = await FileSystem.getInfoAsync(`${CACHE_DIR}${itemId}_*`);
      if (resourceInfo.exists) {
        return `${CACHE_DIR}${itemId}`;
      }

      return null;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  static async manageCacheSize() {
    try {
      const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
      let totalSize = 0;
      const fileStats: { path: string; size: number; modified: number }[] = [];

      for (const file of files) {
        const filePath = `${CACHE_DIR}${file}`;
        const info = await FileSystem.getInfoAsync(filePath);
        if (info.exists && info.size) {
          totalSize += info.size;
          fileStats.push({
            path: filePath,
            size: info.size,
            modified: info.modificationTime || 0,
          });
        }
      }

      // If over limit, delete oldest files
      if (totalSize > MAX_CACHE_SIZE) {
        fileStats.sort((a, b) => a.modified - b.modified);

        for (const file of fileStats) {
          if (totalSize <= MAX_CACHE_SIZE * 0.8) break; // Clean to 80% of max
          await FileSystem.deleteAsync(file.path);
          totalSize -= file.size;
        }
      }
    } catch (error) {
      console.error('Cache management error:', error);
    }
  }

  static async clearCache() {
    try {
      const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
      for (const file of files) {
        await FileSystem.deleteAsync(`${CACHE_DIR}${file}`);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  static getCacheSize(): Promise<number> {
    return (async () => {
      try {
        const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
        let totalSize = 0;

        for (const file of files) {
          const info = await FileSystem.getInfoAsync(`${CACHE_DIR}${file}`);
          if (info.exists && info.size) {
            totalSize += info.size;
          }
        }

        return totalSize;
      } catch (error) {
        console.error('Size calculation error:', error);
        return 0;
      }
    })();
  }
}
