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
   * Save PR metrics data for today (merge with existing data, update only new/changed PRs)
   * If a PR already exists and forceUpdate is false, it will be skipped
   */
  saveTodayData(prs: PrMetrics[], forceUpdate = false): void {
    const today = this.getTodayDate();
    const filePath = this.getFilePath(today);
    const existingData = this.loadTodayData();

    // Merge existing PRs with new PRs (update existing, add new)
    // First, filter out any null/invalid values from existing data
    const existingPrsMap = new Map<number, PrMetrics>();
    if (existingData?.prs && Array.isArray(existingData.prs)) {
      existingData.prs
        .filter(
          (pr) =>
            pr != null &&
            typeof pr === 'object' &&
            'prNumber' in pr &&
            pr.prNumber != null &&
            typeof pr.prNumber === 'number',
        )
        .forEach((pr) => {
          existingPrsMap.set(pr.prNumber, pr);
        });
    }

    // Update or add new PRs
    // If forceUpdate is false and PR already exists, skip it
    // Also filter out any null/undefined/invalid PRs
    prs.forEach((pr) => {
      if (
        pr != null &&
        typeof pr === 'object' &&
        'prNumber' in pr &&
        pr.prNumber != null &&
        typeof pr.prNumber === 'number'
      ) {
        if (forceUpdate || !existingPrsMap.has(pr.prNumber)) {
          existingPrsMap.set(pr.prNumber, pr);
        }
      }
    });

    // Filter out any null/undefined values from merged PRs
    const mergedPrs = Array.from(existingPrsMap.values()).filter(
      (pr) =>
        pr != null &&
        typeof pr === 'object' &&
        'prNumber' in pr &&
        pr.prNumber != null,
    );

    const data: DailyData = {
      date: today,
      prs: mergedPrs,
      createdAt: existingData?.createdAt || new Date().toISOString(),
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
      const data = JSON.parse(content) as DailyData;
      
      // Clean up any null/undefined values in prs array
      if (data.prs && Array.isArray(data.prs)) {
        data.prs = data.prs.filter(
          (pr) =>
            pr != null &&
            typeof pr === 'object' &&
            'prNumber' in pr &&
            pr.prNumber != null &&
            typeof pr.prNumber === 'number',
        );
      }
      
      return data;
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
      const data = JSON.parse(content) as DailyData;
      
      // Clean up any null/undefined values in prs array
      if (data.prs && Array.isArray(data.prs)) {
        data.prs = data.prs.filter(
          (pr) =>
            pr != null &&
            typeof pr === 'object' &&
            'prNumber' in pr &&
            pr.prNumber != null &&
            typeof pr.prNumber === 'number',
        );
      }
      
      return data;
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
