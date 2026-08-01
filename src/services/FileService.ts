import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

export interface ParsedBook {
  title: string;
  author?: string;
  chapters: Chapter[];
}

export interface Chapter {
  title: string;
  content: string;
  order: number;
}

export class FileService {
  static async pickMobiFile(): Promise<DocumentPicker.DocumentPickerAsset | null> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/*',
        copyToCacheDirectory: true,
      });

      if (result.type === 'success') {
        return result.assets[0];
      }
      return null;
    } catch (error) {
      console.error('Error picking file:', error);
      return null;
    }
  }

  static async copyFileToAppDirectory(
    uri: string,
    fileName: string
  ): Promise<string> {
    const appDir = `${FileSystem.documentDirectory}books/`;
    await FileSystem.makeDirectoryAsync(appDir, { intermediates: true });
    const newPath = `${appDir}${fileName}`;
    await FileSystem.copyAsync({ from: uri, to: newPath });
    return newPath;
  }

  static async parseMobiFile(filePath: string): Promise<ParsedBook> {
    try {
      const content = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Basic MOBI parsing - extract title and content
      // For production, use a proper MOBI library like 'mobi-js'
      const title = this.extractTitle(content);
      const text = this.extractText(content);

      return {
        title: title || 'Unknown Title',
        chapters: [
          {
            title: 'Content',
            content: text,
            order: 1,
          },
        ],
      };
    } catch (error) {
      console.error('Error parsing MOBI file:', error);
      throw error;
    }
  }

  private static extractTitle(content: string): string {
    // Simple extraction - in production, use proper parsing
    const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1] : '';
  }

  private static extractText(content: string): string {
    // Remove HTML tags and extract plain text
    return content
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  }

  static async getStoredBooks(): Promise<string[]> {
    const booksDir = `${FileSystem.documentDirectory}books/`;
    try {
      const files = await FileSystem.readDirectoryAsync(booksDir);
      return files.filter(f => f.endsWith('.mobi'));
    } catch {
      return [];
    }
  }

  static async deleteBook(fileName: string): Promise<void> {
    const path = `${FileSystem.documentDirectory}books/${fileName}`;
    await FileSystem.deleteAsync(path);
  }
}
