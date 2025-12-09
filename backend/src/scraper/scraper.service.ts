import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer';
import type { ScrapeOptions, ScrapeResult } from '@shared/scraper.types';

/**
 * Service for scraping raw data using Puppeteer
 */
@Injectable()
export class ScraperService implements OnModuleDestroy {
  private browser: Browser | null = null;

  /**
   * Get or create browser instance
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      const isHeadless = process.env.PUPPETEER_HEADLESS !== 'false';
      const slowMo = process.env.PUPPETEER_SLOW_MO
        ? Number.parseInt(process.env.PUPPETEER_SLOW_MO, 10)
        : undefined;
      const devtools = process.env.PUPPETEER_DEVTOOLS === 'true';
      this.browser = await puppeteer.launch({
        headless: isHeadless,
        executablePath: executablePath || undefined,
        slowMo,
        devtools: devtools && !isHeadless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--single-process',
        ],
      });
    }
    return this.browser;
  }

  /**
   * Create a new page with default settings
   */
  private async createPage(options?: ScrapeOptions): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    if (options?.viewport) {
      await page.setViewport({
        width: options.viewport.width || 1920,
        height: options.viewport.height || 1080,
      });
    } else {
      await page.setViewport({ width: 1920, height: 1080 });
    }

    if (options?.userAgent) {
      await page.setUserAgent(options.userAgent);
    }

    return page;
  }

  /**
   * Scrape raw HTML from a URL
   */
  async scrapeHtml(
    url: string,
    options?: ScrapeOptions,
  ): Promise<ScrapeResult> {
    const page = await this.createPage(options);

    try {
      await page.goto(url, {
        waitUntil: options?.waitUntil || 'networkidle2',
        timeout: options?.timeout || 30000,
      });

      const html = await page.content();
      const title = await page.title();

      return {
        url,
        html,
        title,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Scrape text content from a URL
   */
  async scrapeText(
    url: string,
    options?: ScrapeOptions,
  ): Promise<ScrapeResult> {
    const page = await this.createPage(options);

    try {
      await page.goto(url, {
        waitUntil: options?.waitUntil || 'networkidle2',
        timeout: options?.timeout || 30000,
      });

      const text = await page.evaluate(() => document.body.innerText);
      const title = await page.title();

      return {
        url,
        text,
        title,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Scrape JSON data from a URL (expects JSON response)
   */
  async scrapeJson(
    url: string,
    options?: ScrapeOptions,
  ): Promise<ScrapeResult> {
    const page = await this.createPage(options);

    try {
      const response = await page.goto(url, {
        waitUntil: options?.waitUntil || 'networkidle2',
        timeout: options?.timeout || 30000,
      });

      if (!response) {
        throw new Error('Failed to load page');
      }

      const contentType = response.headers()['content-type'] || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Response is not JSON');
      }

      const json = (await response.json()) as unknown;
      const title = await page.title();

      return {
        url,
        json,
        title,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Take a screenshot of a URL
   */
  async takeScreenshot(
    url: string,
    options?: ScrapeOptions & { fullPage?: boolean },
  ): Promise<ScrapeResult> {
    const page = await this.createPage(options);

    try {
      await page.goto(url, {
        waitUntil: options?.waitUntil || 'networkidle2',
        timeout: options?.timeout || 30000,
      });

      const screenshot = await page.screenshot({
        fullPage: options?.fullPage || false,
        type: 'png',
      });

      const title = await page.title();

      return {
        url,
        screenshot: screenshot as Buffer,
        title,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Execute custom JavaScript on a page and return result
   */
  async executeScript<T>(
    url: string,
    script: string | ((page: Page) => Promise<T>),
    options?: ScrapeOptions,
  ): Promise<T> {
    const page = await this.createPage(options);

    try {
      await page.goto(url, {
        waitUntil: options?.waitUntil || 'networkidle2',
        timeout: options?.timeout || 30000,
      });

      if (typeof script === 'function') {
        return await script(page);
      }

      return (await page.evaluate(script)) as T;
    } finally {
      await page.close();
    }
  }

  /**
   * Scrape data with custom selector
   */
  async scrapeSelector(
    url: string,
    selector: string,
    options?: ScrapeOptions,
  ): Promise<ScrapeResult> {
    const page = await this.createPage(options);

    try {
      await page.goto(url, {
        waitUntil: options?.waitUntil || 'networkidle2',
        timeout: options?.timeout || 30000,
      });

      const elements = await page.$$(selector);
      const data = await Promise.all(
        elements.map(async (element) => {
          const text = await page.evaluate((el) => el.textContent, element);
          const html = await page.evaluate((el) => el.innerHTML, element);
          return { text, html };
        }),
      );

      const title = await page.title();

      return {
        url,
        json: data,
        title,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Close browser instance
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    await this.closeBrowser();
  }
}
