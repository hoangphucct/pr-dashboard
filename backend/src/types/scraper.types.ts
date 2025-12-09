/**
 * Scraper related types
 */

export interface ScrapeOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
  viewport?: {
    width?: number;
    height?: number;
  };
  userAgent?: string;
}

export interface ScrapeResult {
  url: string;
  html?: string;
  text?: string;
  json?: unknown;
  screenshot?: Buffer;
  title?: string;
}
