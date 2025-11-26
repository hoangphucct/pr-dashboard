import { Injectable } from '@nestjs/common';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';

export interface PrMetrics {
  prNumber: number;
  title: string;
  author: string;
  url: string;
  status: string;
  commitToOpen: number;
  openToReview: number;
  reviewToApproval: number;
  approvalToMerge: number;
  createdAt: string;
  updatedAt: string;
}

interface DailyData {
  date: string;
  prs: PrMetrics[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class StorageService {
  private readonly storageDir: string;

  constructor() {
    this.storageDir = join(process.cwd(), 'data');
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get file path for a specific date
   */
  private getFilePath(date: string): string {
    return join(this.storageDir, `data-${date}.json`);
  }

  /**
   * Save PR metrics data for today (overwrite if same day)
   */
  saveTodayData(prs: PrMetrics[]): void {
    const today = this.getTodayDate();
    const filePath = this.getFilePath(today);

    const data: DailyData = {
      date: today,
      prs,
      createdAt: existsSync(filePath)
        ? this.loadTodayData()?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Load today's data
   */
  loadTodayData(): DailyData | null {
    const today = this.getTodayDate();
    const filePath = this.getFilePath(today);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as DailyData;
    } catch (error) {
      console.error("Error loading today's data:", error);
      return null;
    }
  }

  /**
   * Load data for a specific date
   */
  loadDataByDate(date: string): DailyData | null {
    const filePath = this.getFilePath(date);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as DailyData;
    } catch (error) {
      console.error('Error loading data for date:', date, error);
      return null;
    }
  }

  /**
   * List all available dates with data
   */
  listAvailableDates(): string[] {
    if (!existsSync(this.storageDir)) {
      return [];
    }

    const files = readdirSync(this.storageDir);
    return files
      .filter((file) => file.startsWith('data-') && file.endsWith('.json'))
      .map((file) => file.replace('data-', '').replace('.json', ''))
      .sort((a, b) => b.localeCompare(a));
  }
}
