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
   * Random delay to simulate human behavior (reduced for speed)
   */
  private async humanDelay(min = 50, max = 150): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Move mouse naturally to element
   */
  private async moveMouseToElement(
    page: Page,
    element: Awaited<ReturnType<Page['$']>>,
  ): Promise<void> {
    if (!element) {
      return;
    }
    const box = await element.boundingBox();
    if (box) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y, { steps: 10 });
      await this.humanDelay(50, 150);
    }
  }

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
            await orgNameInput.type(orgName, { delay: 0 });
            await this.humanDelay(30, 50);
            await emailInput.type(email, { delay: 0 });
            await this.humanDelay(30, 50);
            await passwordInput.type(password, { delay: 0 });
            await this.humanDelay(50, 100);
            await loginButton.click();
            
            // Wait for navigation after login
            await page.waitForNavigation({
              waitUntil: 'domcontentloaded',
              timeout: 8000,
            });
            
            // Wait for page to be interactive
            await this.humanDelay(200, 300);
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

      // Wait for page to be ready
      await this.humanDelay(100, 200);

      // Find Monthly button using Puppeteer
      console.log('Looking for Monthly button...');
      let monthlyButton: Awaited<ReturnType<Page['$']>> = null;
      let wasSelected = false;

      // Strategy 1: Find by evaluating and getting selector, then use Puppeteer to get element
      const buttonIndex = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        for (let i = 0; i < buttons.length; i++) {
          const btn = buttons[i];
          const text = btn.textContent?.trim() || '';
          if (text.toLowerCase() === 'monthly' || text.toLowerCase().includes('monthly')) {
            return i;
          }
        }
        return -1;
      });

      if (buttonIndex >= 0) {
        const allButtons = await page.$$('button');
        if (allButtons[buttonIndex]) {
          monthlyButton = allButtons[buttonIndex];
          console.log('Found Monthly button at index:', buttonIndex);
        }
      }

      // Strategy 2: Try finding by checking all buttons with Puppeteer
      if (!monthlyButton) {
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const text = await page.evaluate((el) => {
            return el.textContent?.trim() || '';
          }, btn);
          if (text.toLowerCase() === 'monthly' || text.toLowerCase().includes('monthly')) {
            monthlyButton = btn;
            console.log('Found Monthly button by iterating buttons');
            break;
          }
        }
      }

      if (monthlyButton) {
        // Check if already selected
        wasSelected = await page.evaluate((el) => {
          return (el as HTMLElement).getAttribute('aria-pressed') === 'true';
        }, monthlyButton);

        // Highlight button to make it visible
        await page.evaluate((el) => {
          const btn = el as HTMLElement;
          const originalStyle = btn.getAttribute('style') || '';
          btn.setAttribute('style', `${originalStyle}; border: 3px solid red !important; background: yellow !important; z-index: 9999 !important;`);
          setTimeout(() => {
            btn.setAttribute('style', originalStyle);
          }, 1000);
        }, monthlyButton);

        console.log('Clicking Monthly button...');
        // Move mouse to button first
        await this.moveMouseToElement(page, monthlyButton);
        await this.humanDelay(100, 200);
        
        // Click using Puppeteer API
        await monthlyButton.click({ delay: 50 });
        console.log('Monthly button clicked successfully');
        
        if (wasSelected) {
          console.log('Monthly button was already selected, clicked again to ensure state');
        }
        
        // Wait for UI to update after clicking
        await this.humanDelay(300, 500);
      } else {
        console.warn('Monthly button not found - might already be selected or page structure changed');
        // Continue anyway, button might already be in correct state
      }

      // Wait for chart to be visible with retry
      let chartVisible = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await page.waitForSelector('.recharts-layer.recharts-bar', {
            timeout: 2000,
          });
          chartVisible = true;
          break;
        } catch {
          if (attempt < 2) {
            await this.humanDelay(100, 200);
          }
        }
      }

      if (!chartVisible) {
        return {
          success: false,
          error: 'Chart not found after waiting. The page might not be fully loaded.',
        };
      }

      // Wait a bit for chart to be fully rendered
      await this.humanDelay(100, 200);

      // Find chart bar element
      const chartBar = await page.$('.recharts-layer.recharts-bar');
      if (!chartBar) {
        return {
          success: false,
          error: 'Chart bar element not found',
        };
      }

      // Scroll chart into view to ensure it's visible
      await chartBar.scrollIntoView();
      await this.humanDelay(50, 100);

      // Get bounding box for natural mouse interaction
      const box = await chartBar.boundingBox();
      if (!box) {
        return {
          success: false,
          error: 'Could not get chart bar position',
        };
      }

      // Calculate center point of the first visible bar
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      console.log('Moving mouse to chart bar...');
      // Move mouse naturally to the chart bar (hover effect)
      await page.mouse.move(centerX, centerY, { steps: 10 });
      await this.humanDelay(100, 200);

      // Verify page is still visible (not black screen)
      const pageTitle = await page.title();
      if (!pageTitle || pageTitle.trim() === '') {
        return {
          success: false,
          error: 'Page became unresponsive after hovering over chart',
        };
      }

      console.log('Clicking on chart bar...');
      // Click on the chart bar with natural delay
      await page.mouse.click(centerX, centerY, { delay: 50 });
      console.log('Chart bar clicked');
      await this.humanDelay(500, 800);

      // Wait for table to appear after clicking (table is loaded from JS)
      let tableHtml: string | null = null;

      try {
        console.log('Waiting for table to appear...');
        
        // Wait for any table-related element to appear with longer timeout
        let tableFound = false;
        const selectorsToTry = [
          'table',
          'table tbody',
          'table thead',
          '[class*="table"]',
          '[class*="Table"]',
          '[class*="TABLE"]',
          '.table',
          '[role="table"]',
          '[role="grid"]',
          'div[class*="table"]',
        ];

        // Try waiting for each selector with increasing timeout
        for (let attempt = 0; attempt < selectorsToTry.length && !tableFound; attempt++) {
          const selector = selectorsToTry[attempt];
          try {
            console.log(`Trying selector: ${selector}`);
            await page.waitForSelector(selector, { timeout: 3000 });
            tableFound = true;
            console.log(`Table found with selector: ${selector}`);
            break;
          } catch {
            // Continue to next selector
          }
        }

        // If no table found, wait a bit more and check for modal/popup
        if (!tableFound) {
          console.log('No table found with standard selectors, checking for modal/popup...');
          await this.humanDelay(500, 800);
          
          // Check if modal/popup appeared
          const modalExists = await page.evaluate(() => {
            const modals = document.querySelectorAll('[role="dialog"], .modal, [class*="Modal"], [class*="popup"], [class*="Popup"], [class*="drawer"], [class*="Drawer"]');
            return modals.length > 0;
          });

          if (modalExists) {
            console.log('Modal/popup detected, waiting for table inside...');
            // Wait for table in modal
            for (let attempt = 0; attempt < 5; attempt++) {
              await this.humanDelay(300, 500);
              const hasTable = await page.evaluate(() => {
                const modals = document.querySelectorAll('[role="dialog"], .modal, [class*="Modal"], [class*="popup"], [class*="Popup"]');
                for (const modal of modals) {
                  const table = modal.querySelector('table');
                  if (table) return true;
                }
                return false;
              });
              if (hasTable) {
                tableFound = true;
                break;
              }
            }
          }
        }

        // Get table HTML
        console.log('Extracting table HTML...');
        tableHtml = await page.evaluate(() => {
          // Try to find table in various locations
          const selectors = [
            'table',
            '[role="table"]',
            '[role="grid"]',
            '.table',
            '[class*="table"]',
            '[class*="Table"]',
            '[class*="TABLE"]',
          ];

          for (const selector of selectors) {
            const table = document.querySelector(selector);
            if (table) {
              return table.outerHTML;
            }
          }

          // Try to find in modal or popup
          const modals = document.querySelectorAll(
            '[role="dialog"], .modal, [class*="Modal"], [class*="popup"], [class*="Popup"], [class*="drawer"], [class*="Drawer"]'
          );
          for (const modal of modals) {
            const table = modal.querySelector('table');
            if (table) {
              return table.outerHTML;
            }
            // Also check for div-based tables
            const divTable = modal.querySelector('[class*="table"], [class*="Table"]');
            if (divTable) {
              return divTable.outerHTML;
            }
          }

          // Try to find any element with table-like structure
          const allElements = document.querySelectorAll('*');
          for (const el of allElements) {
            const className = el.className?.toString().toLowerCase() || '';
            const id = el.id?.toLowerCase() || '';
            if (
              (className.includes('table') || id.includes('table')) &&
              (el.querySelector('tr') || el.querySelector('[role="row"]'))
            ) {
              return el.outerHTML;
            }
          }

          return null;
        });

        if (tableHtml) {
          console.log('Got table HTML from page');
        } else {
          console.warn('Table selector found but HTML is null');
          // Try to get any visible content that might contain PR numbers
          const pageContent = await page.evaluate(() => {
            return document.body.innerText;
          });
          console.log('Page content preview:', pageContent.substring(0, 500));
        }
      } catch (error) {
        console.error('Error finding table:', error);
        return {
          success: false,
          error: `Could not find table after clicking chart: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        };
      }

      if (!tableHtml) {
        return {
          success: false,
          error: 'Table HTML is empty or not found',
        };
      }

      // Extract PR numbers from table HTML
      let prNumbers: number[] = [];
      
      // Try extracting from table HTML structure first
      prNumbers = this.extractPrNumbersFromTable(tableHtml);
      
      // Fallback to general text extraction if needed
      if (prNumbers.length === 0) {
        prNumbers = this.extractPrNumbersFromText(tableHtml);
      }

      return {
        success: true,
        data: { source: 'table', html: tableHtml },
        prNumbers,
      };
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
   * Extract PR numbers from table HTML
   */
  private extractPrNumbersFromTable(tableHtml: string): number[] {
    const prNumbers: number[] = [];
    
    // Try to extract from table cells
    const cellRegex = /<t[dh][^>]*>([^<]*(?:\d{4,6})[^<]*)<\/t[dh]>/gi;
    let match;
    while ((match = cellRegex.exec(tableHtml)) !== null) {
      const cellText = match[1];
      const numbers = cellText.match(/\b(\d{4,6})\b/g);
      if (numbers) {
        numbers.forEach((num) => {
          const prNum = Number.parseInt(num, 10);
          if (prNum >= 1000 && prNum < 100000 && !prNumbers.includes(prNum)) {
            prNumbers.push(prNum);
          }
        });
      }
    }

    // Fallback to general text extraction
    if (prNumbers.length === 0) {
      return this.extractPrNumbersFromText(tableHtml);
    }

    return prNumbers.sort((a, b) => a - b);
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
