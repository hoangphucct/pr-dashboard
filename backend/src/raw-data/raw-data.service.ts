import { Injectable } from '@nestjs/common';
import {
  readdirSync,
  readFileSync,
  existsSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';

export interface RawDataFile {
  fileName: string;
  filePath: string;
  scrapedAt: string;
  url: string;
  prCount: number;
  prNumbers: number[];
  fileSize: number;
  lastModified: Date;
}

export interface RawDataPrsContainer {
  prs?: unknown[];
}

export interface RawDataContent {
  url: string;
  scrapedAt: string;
  success: boolean;
  data: RawDataPrsContainer | null;
  prNumbers: number[];
  error?: string;
}

@Injectable()
export class RawDataService {
  private readonly rawDataDir: string;

  constructor() {
    this.rawDataDir = join(process.cwd(), 'data', 'raw');
    if (!existsSync(this.rawDataDir)) {
      return;
    }
  }

  /**
   * List all raw data files
   */
  listRawDataFiles(): RawDataFile[] {
    if (!existsSync(this.rawDataDir)) {
      return [];
    }

    try {
      const files = readdirSync(this.rawDataDir)
        .filter(
          (file) => file.endsWith('.json') && file.startsWith('raw-data-'),
        )
        .map((fileName) => {
          const filePath = join(this.rawDataDir, fileName);
          const stats = statSync(filePath);
          const content = this.loadRawDataFile(fileName);

          return {
            fileName,
            filePath,
            scrapedAt: content?.scrapedAt || stats.mtime.toISOString(),
            url: content?.url || '',
            prCount: content?.prNumbers?.length || 0,
            prNumbers: content?.prNumbers || [],
            fileSize: stats.size,
            lastModified: stats.mtime,
          };
        })
        .sort((a, b) => {
          // Sort by last modified date, newest first
          return b.lastModified.getTime() - a.lastModified.getTime();
        });

      return files;
    } catch (error) {
      console.error('Error listing raw data files:', error);
      return [];
    }
  }

  /**
   * Load a specific raw data file
   */
  loadRawDataFile(fileName: string): RawDataContent | null {
    if (!existsSync(this.rawDataDir)) {
      return null;
    }

    const filePath = join(this.rawDataDir, fileName);
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as RawDataContent;
    } catch (error) {
      console.error(`Error loading raw data file ${fileName}:`, error);
      return null;
    }
  }

  /**
   * Get raw data file by name
   */
  getRawDataFile(fileName: string): RawDataFile | null {
    if (!existsSync(this.rawDataDir)) {
      return null;
    }

    const filePath = join(this.rawDataDir, fileName);
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const stats = statSync(filePath);
      const content = this.loadRawDataFile(fileName);

      return {
        fileName,
        filePath,
        scrapedAt: content?.scrapedAt || stats.mtime.toISOString(),
        url: content?.url || '',
        prCount: content?.prNumbers?.length || 0,
        prNumbers: content?.prNumbers || [],
        fileSize: stats.size,
        lastModified: stats.mtime,
      };
    } catch (error) {
      console.error(`Error getting raw data file ${fileName}:`, error);
      return null;
    }
  }

  /**
   * Delete a raw data file
   * @param fileName - Name of the file to delete
   * @returns true if deleted, false if file not found
   */
  deleteRawDataFile(fileName: string): boolean {
    if (!existsSync(this.rawDataDir)) {
      return false;
    }

    // Validate file name format to prevent directory traversal
    if (!fileName.startsWith('raw-data-') || !fileName.endsWith('.json')) {
      return false;
    }

    const filePath = join(this.rawDataDir, fileName);
    if (!existsSync(filePath)) {
      return false;
    }

    try {
      unlinkSync(filePath);
      return true;
    } catch (error) {
      console.error(`Error deleting raw data file ${fileName}:`, error);
      return false;
    }
  }
}
