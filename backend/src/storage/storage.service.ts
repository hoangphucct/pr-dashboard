import { Injectable } from '@nestjs/common';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import type { PrMetrics, DailyData } from '@shared/storage.types';

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
   * Validate if a PR object is valid
   */
  private isValidPr(pr: unknown): pr is PrMetrics {
    return (
      pr != null &&
      typeof pr === 'object' &&
      'prNumber' in pr &&
      pr.prNumber != null &&
      typeof pr.prNumber === 'number'
    );
  }

  /**
   * Filter and return only valid PRs from an array
   */
  private filterValidPrs(prs: unknown[]): PrMetrics[] {
    return prs.filter((pr): pr is PrMetrics => this.isValidPr(pr));
  }

  /**
   * Save PR metrics data for today (merge with existing data, update only new/changed PRs)
   * If a PR already exists and forceUpdate is false, it will be skipped
   */
  saveTodayData(prs: PrMetrics[], forceUpdate = false): void {
    const today = this.getTodayDate();
    this.saveDataByDate(prs, today, forceUpdate);
  }

  /**
   * Save PR metrics data for a specific date (merge with existing data, update only new/changed PRs)
   * If a PR already exists and forceUpdate is false, it will be skipped
   */
  saveDataByDate(prs: PrMetrics[], date: string, forceUpdate = false): void {
    const filePath = this.getFilePath(date);
    const existingData = this.loadDataByDate(date);

    // Merge existing PRs with new PRs (update existing, add new)
    // First, filter out any null/invalid values from existing data
    const existingPrsMap = new Map<number, PrMetrics>();
    if (existingData?.prs && Array.isArray(existingData.prs)) {
      this.filterValidPrs(existingData.prs).forEach((pr) => {
        existingPrsMap.set(pr.prNumber, pr);
      });
    }

    // Update or add new PRs
    // If forceUpdate is false and PR already exists, skip it
    this.filterValidPrs(prs).forEach((pr) => {
      if (forceUpdate || !existingPrsMap.has(pr.prNumber)) {
        existingPrsMap.set(pr.prNumber, pr);
      }
    });

    // Get merged PRs (already validated)
    const mergedPrs = Array.from(existingPrsMap.values());

    const data: DailyData = {
      date,
      prs: mergedPrs,
      createdAt: existingData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Load and parse JSON data from file path
   */
  private loadDataFromFile(filePath: string): DailyData | null {
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content) as DailyData;

      // Clean up any null/undefined values in prs array
      if (data.prs && Array.isArray(data.prs)) {
        data.prs = this.filterValidPrs(data.prs);
      }

      return data;
    } catch (error) {
      console.error('Error loading data from file:', filePath, error);
      return null;
    }
  }

  /**
   * Load today's data
   */
  loadTodayData(): DailyData | null {
    const today = this.getTodayDate();
    const filePath = this.getFilePath(today);
    return this.loadDataFromFile(filePath);
  }

  /**
   * Load data for a specific date
   */
  loadDataByDate(date: string): DailyData | null {
    const filePath = this.getFilePath(date);
    return this.loadDataFromFile(filePath);
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

  /**
   * Delete a PR from a specific date's data
   * @param prNumber - PR number to delete
   * @param date - Date in YYYY-MM-DD format (optional, defaults to today)
   */
  deletePrFromDate(prNumber: number, date?: string): boolean {
    const targetDate = date || this.getTodayDate();
    const filePath = this.getFilePath(targetDate);
    const data = this.loadDataFromFile(filePath);

    if (!data?.prs) {
      return false;
    }

    const initialLength = data.prs.length;
    data.prs = data.prs.filter((pr) => pr.prNumber !== prNumber);

    if (data.prs.length === initialLength) {
      // PR not found
      return false;
    }

    data.updatedAt = new Date().toISOString();
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  }

  /**
   * Delete a PR from today's data (backward compatibility)
   */
  deletePrFromToday(prNumber: number): boolean {
    return this.deletePrFromDate(prNumber);
  }

  /**
   * Delete all data for a specific date
   * @param date - Date in YYYY-MM-DD format
   * @returns true if deleted, false if file not found
   */
  deleteDataByDate(date: string): boolean {
    const filePath = this.getFilePath(date);

    if (!existsSync(filePath)) {
      return false;
    }

    try {
      unlinkSync(filePath);
      return true;
    } catch (error) {
      console.error('Error deleting data file:', filePath, error);
      return false;
    }
  }
}
