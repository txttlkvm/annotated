import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Book } from '../types';

export interface EbookContent {
  title: string;
  author?: string;
  chapters: { title: string; content: string }[];
  totalPages: number;
  cover?: string;
}

export class EbookService {
  static async pickFile(): Promise<DocumentPicker.DocumentPickerAsset | null> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/epub+zip', 'application/x-mobipocket-ebook', 'application/pdf', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (result.type === 'success') {
        return result.assets[0];
      }
      return null;
    } catch (error) {
      console.error('File picker error:', error);
      return null;
    }
  }

  static async copyToLibrary(uri: string, fileName: string): Promise<string> {
    try {
      const libDir = `${FileSystem.documentDirectory}books/`;
      await FileSystem.makeDirectoryAsync(libDir, { intermediates: true });
      const newPath = `${libDir}${Date.now()}_${fileName}`;
      await FileSystem.copyAsync({ from: uri, to: newPath });
      return newPath;
    } catch (error) {
      console.error('Copy file error:', error);
      throw error;
    }
  }

  static getFileFormat(fileName: string): 'epub' | 'mobi' | 'pdf' | 'txt' {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    const formats: Record<string, any> = {
      epub: 'epub',
      mobi: 'mobi',
      azw: 'mobi',
      azw3: 'mobi',
      pdf: 'pdf',
      txt: 'txt',
    };
    return formats[ext] || 'txt';
  }

  static async parseEbook(filePath: string, format: string): Promise<EbookContent> {
    try {
      switch (format) {
        case 'epub':
          return this.parseEpub(filePath);
        case 'mobi':
          return this.parseMobi(filePath);
        case 'txt':
          return this.parseTxt(filePath);
        case 'pdf':
          return this.parsePdf(filePath);
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      console.error('Parse error:', error);
      throw error;
    }
  }

  private static async parseEpub(filePath: string): Promise<EbookContent> {
    const content = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return {
      title: this.extractTitle(content) || 'Unknown Title',
      chapters: [{ title: 'Content', content: this.cleanText(content) }],
      totalPages: Math.ceil(content.length / 500),
    };
  }

  private static async parseMobi(filePath: string): Promise<EbookContent> {
    const content = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return {
      title: this.extractTitle(content) || 'Unknown Title',
      chapters: [{ title: 'Content', content: this.cleanText(content) }],
      totalPages: Math.ceil(content.length / 500),
    };
  }

  private static async parseTxt(filePath: string): Promise<EbookContent> {
    const content = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const lines = content.split('\n');
    const title = lines[0]?.trim() || 'Untitled';

    return {
      title,
      chapters: [{ title: 'Content', content }],
      totalPages: Math.ceil(content.length / 500),
    };
  }

  private static async parsePdf(filePath: string): Promise<EbookContent> {
    return {
      title: 'PDF Document',
      chapters: [{ title: 'Content', content: 'PDF parsing requires additional libraries' }],
      totalPages: 1,
    };
  }

  private static extractTitle(content: string): string {
    const titleMatch = content.match(
      /<title[^>]*>([^<]+)<\/title>/i || /^#+\s*(.+)/m
    );
    return titleMatch ? titleMatch[1].trim() : '';
  }

  private static cleanText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\n\n+/g, '\n\n')
      .trim();
  }

  static async deleteBook(filePath: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(filePath);
    } catch (error) {
      console.error('Delete error:', error);
    }
  }

  static calculatePages(content: string, charsPerPage: number = 500): number {
    return Math.max(1, Math.ceil(content.length / charsPerPage));
  }

  static getReadableFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
