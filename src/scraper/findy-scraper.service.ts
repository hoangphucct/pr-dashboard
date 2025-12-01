import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer';

/**
 * Result of Findy Team scraping
 */
export interface FindyScrapeResult {
  success: boolean;
  data?: unknown;
  error?: string;
  prNumbers?: number[];
}

/**
 * Service for scraping Findy Team data using Puppeteer
 */
@Injectable()
export class FindyScraperService {
  private browser: Browser | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get or create browser instance
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      const headless = process.env.PUPPETEER_HEADLESS !== 'false';
      const slowMo = process.env.PUPPETEER_SLOW_MO
        ? Number.parseInt(process.env.PUPPETEER_SLOW_MO, 10)
        : undefined;
      const devtools = process.env.PUPPETEER_DEVTOOLS === 'true';
      this.browser = await puppeteer.launch({
        headless: headless,
        executablePath: executablePath || undefined,
        slowMo,
        devtools: devtools && !headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
      });
    }
    return this.browser;
  }

  /**
   * Validate Findy Team URL
   */
  validateFindyUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const isValidDomain = urlObj.hostname === 'findy-team.io';
      const isValidPath = urlObj.pathname === '/team/analytics/cycletime';
      const hasMonitoringId = urlObj.searchParams.has('monitoring_id');
      const hasRange = urlObj.searchParams.has('range');
      const monitoringId = urlObj.searchParams.get('monitoring_id');
      const isValidMonitoringId =
        monitoringId !== null && /^\d+$/.test(monitoringId);

      return (
        isValidDomain &&
        isValidPath &&
        hasMonitoringId &&
        hasRange &&
        isValidMonitoringId
      );
    } catch {
      return false;
    }
  }

  /**
   * Wait for network request to complete
   */
  private async waitForGraphQLRequest(
    page: Page,
    urlPattern: string,
    timeout = 30000,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout waiting for GraphQL request'));
      }, timeout);

      page.on('response', (response) => {
        const url = response.url();
        if (url.includes(urlPattern)) {
          clearTimeout(timeoutId);
          void (async () => {
            try {
              const data = (await response.json()) as unknown;
              resolve(data);
            } catch (error) {
              reject(
                new Error(
                  `Failed to parse GraphQL response: ${
                    error instanceof Error ? error.message : 'Unknown error'
                  }`,
                ),
              );
            }
          })();
        }
      });
    });
  }

  /**
   * Wait for promise with timeout using async/await
   */
  private async waitWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error(errorMessage));
        }
      }, timeoutMs);
      let isResolved = false;
      promise
        .then((result) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            resolve(result);
          }
        })
        .catch((error) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
    });
  }

  /**
   * Scrape Findy Team data
   */
  async scrapeFindyTeam(url: string): Promise<FindyScrapeResult> {
    if (!this.validateFindyUrl(url)) {
      return {
        success: false,
        error:
          'Invalid URL format. Expected: https://findy-team.io/team/analytics/cycletime?monitoring_id=<number>&range=<string>',
      };
    }

    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to URL
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait for login (check if we need to login)
      // Look for login form or check if already logged in
      const isLoggedIn = await page.evaluate(() => {
        // Check if there's a login form or if we're already logged in
        const loginForm = document.querySelector('form[action*="login"]');
        const userMenu = document.querySelector('[data-testid="user-menu"]');
        return (
          !loginForm &&
          (userMenu !== null || document.body.innerText.includes('Monthly'))
        );
      });

      if (!isLoggedIn) {
        // Try to login if credentials are available
        const orgName = this.configService.get<string>('FINDY_ORG_NAME');
        const email = this.configService.get<string>('FINDY_EMAIL');
        const password = this.configService.get<string>('FINDY_PASSWORD');

        if (orgName && email && password) {
          // Wait for login form to be visible
          try {
            await page.waitForSelector('#orgName', { timeout: 5000 });
            await page.waitForSelector('#email', { timeout: 5000 });
            await page.waitForSelector('#current-password', { timeout: 5000 });
          } catch {
            return {
              success: false,
              error:
                'Login form not found. Please check if you are already logged in or if the page structure has changed.',
            };
          }

          // Fill in login form
          const orgNameInput = await page.$('#orgName');
          const emailInput = await page.$('#email');
          const passwordInput = await page.$('#current-password');
          const loginButton = await page.$('button[type="submit"]');

          if (orgNameInput && emailInput && passwordInput && loginButton) {
            await orgNameInput.type(orgName);
            await emailInput.type(email);
            await passwordInput.type(password);
            await loginButton.click();

            // Wait for navigation after login
            await page.waitForNavigation({
              waitUntil: 'networkidle2',
              timeout: 15000,
            });

            // Wait a bit more to ensure page is fully loaded
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } else {
            return {
              success: false,
              error:
                'Could not find all required login form elements. Please check the page structure.',
            };
          }
        } else {
          return {
            success: false,
            error:
              'Not logged in and no credentials provided. Please set FINDY_ORG_NAME, FINDY_EMAIL and FINDY_PASSWORD environment variables.',
          };
        }
      }

      // Wait for page to load completely
      await page
        .waitForSelector(
          'button:has-text("Monthly"), button[text*="Monthly"]',
          {
            timeout: 15000,
          },
        )
        .catch(() => {
          console.error('Monthly button not found');
          // Button might already be selected or have different text
        });

      // Find and click Monthly button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const monthlyButton = buttons.find((btn) =>
          btn.textContent?.includes('Monthly'),
        );
        if (monthlyButton) {
          monthlyButton.click();
        }
      });

      // Wait for UI to update
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Wait for chart to be visible
      await page.waitForSelector('.recharts-layer.recharts-bar', {
        timeout: 10000,
      });

      // Set up listener for GraphQL request BEFORE clicking
      const graphQLPromise = this.waitForGraphQLRequest(
        page,
        'api.findy-team.io/graphql/enterprise?opname=PullListTablePullStatsList',
        30000,
      );

      // Click on the chart bar to trigger GraphQL request
      const chartBar = await page.$('.recharts-layer.recharts-bar');
      if (chartBar) {
        await chartBar.click();
      }

      // Wait for GraphQL response
      try {
        const graphQLData = await this.waitWithTimeout(
          graphQLPromise,
          30000,
          'GraphQL request timeout',
        );

        // Extract PR numbers from GraphQL data
        const prNumbers = this.extractPrNumbers(graphQLData);

        return {
          success: true,
          data: graphQLData,
          prNumbers,
        };
      } catch (error) {
        // If GraphQL request didn't happen, try to get data from page
        const pageData = await page.evaluate(() => {
          // Try to find data in window object or DOM
          const scripts = Array.from(document.querySelectorAll('script'));
          for (const script of scripts) {
            if (script.textContent?.includes('PullListTablePullStatsList')) {
              return script.textContent;
            }
          }
          return null;
        });

        if (pageData) {
          const prNumbers = this.extractPrNumbersFromText(pageData);
          return {
            success: true,
            data: { source: 'page', content: pageData },
            prNumbers,
          };
        }

        return {
          success: false,
          error: `Failed to get GraphQL data: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Scraping failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Extract PR numbers from GraphQL data
   */
  private extractPrNumbers(data: unknown): number[] {
    if (!data || typeof data !== 'object') {
      return [];
    }

    const dataObj = data as Record<string, unknown>;
    const prNumbers: number[] = [];

    // Recursively search for PR numbers in the data structure
    const searchForPrNumbers = (obj: unknown): void => {
      if (typeof obj === 'number' && obj > 0 && obj < 1000000) {
        // Likely a PR number (reasonable range)
        if (!prNumbers.includes(obj)) {
          prNumbers.push(obj);
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item) => searchForPrNumbers(item));
      } else if (obj !== null && typeof obj === 'object') {
        Object.values(obj).forEach((value) => searchForPrNumbers(value));
      }
    };

    searchForPrNumbers(dataObj);

    // Filter to reasonable PR numbers (typically 4-6 digits)
    return prNumbers
      .filter((num) => num >= 1000 && num < 100000)
      .sort((a, b) => a - b);
  }

  /**
   * Extract PR numbers from text content
   */
  private extractPrNumbersFromText(text: string): number[] {
    const prNumberRegex = /(?:PR|pr|#)?\s*(\d{4,6})\b/g;
    const matches = text.matchAll(prNumberRegex);
    const prNumbers = Array.from(matches, (match) =>
      Number.parseInt(match[1], 10),
    ).filter((num) => !Number.isNaN(num) && num >= 1000 && num < 100000);
    return [...new Set(prNumbers)].sort((a, b) => a - b);
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
}
