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
 * Pagination information
 */
interface PaginationInfo {
  hasPagination: boolean;
  totalPages: number;
  currentPage: number;
}

/**
 * Page scraping result
 */
interface PageScrapeResult {
  tableHtml: string;
  prNumbers: number[];
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
   * Check if browser instance is still connected
   */
  private isBrowserConnected(): boolean {
    if (!this.browser) {
      return false;
    }
    try {
      const process = this.browser.process();
      return process !== null && process.exitCode === null;
    } catch {
      return false;
    }
  }

  /**
   * Close browser instance and reset
   */
  private async closeBrowserInstance(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.warn('Error closing browser:', error);
      } finally {
        this.browser = null;
      }
    }
  }

  /**
   * Get or create browser instance with health check and retry logic
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.isBrowserConnected()) {
      await this.closeBrowserInstance();
      return await this.launchBrowserWithRetry();
    }
    if (!this.browser) {
      throw new Error('Browser instance is null after initialization');
    }
    return this.browser;
  }

  /**
   * Launch browser with retry logic to handle transient failures
   */
  private async launchBrowserWithRetry(maxRetries = 3): Promise<Browser> {
    const launchOptions = this.buildBrowserLaunchOptions();
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logBrowserLaunchAttempt(attempt, maxRetries);
        this.browser = await puppeteer.launch(launchOptions);
        await this.waitForBrowserStability();
        await this.validateBrowserConnection();
        this.setupBrowserDisconnectListener();
        console.log('Browser launched successfully');
        return this.browser;
      } catch (error) {
        lastError = await this.handleBrowserLaunchError(
          error,
          attempt,
          maxRetries,
        );
      }
    }
    throw new Error(
      `Failed to launch browser after ${maxRetries} attempts: ${
        lastError?.message || 'Unknown error'
      }`,
    );
  }

  /**
   * Build browser launch options from environment variables
   */
  private buildBrowserLaunchOptions(): Parameters<typeof puppeteer.launch>[0] {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    const isHeadless = process.env.PUPPETEER_HEADLESS !== 'false';
    const slowMo = process.env.PUPPETEER_SLOW_MO
      ? Number.parseInt(process.env.PUPPETEER_SLOW_MO, 10)
      : undefined;
    const devtools = process.env.PUPPETEER_DEVTOOLS === 'true';
    return {
      headless: isHeadless,
      executablePath: executablePath || undefined,
      slowMo,
      devtools: devtools && !isHeadless,
      args: this.getBrowserArgs(),
      timeout: 30000,
    };
  }

  /**
   * Get browser command line arguments
   */
  private getBrowserArgs(): string[] {
    return [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-default-apps',
      '--disable-sync',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--ignore-certificate-errors',
    ];
  }

  /**
   * Log browser launch attempt
   */
  private logBrowserLaunchAttempt(attempt: number, maxRetries: number): void {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    const isHeadless = process.env.PUPPETEER_HEADLESS !== 'false';
    console.log(
      `Attempting to launch browser (attempt ${attempt}/${maxRetries})...`,
    );
    console.log(`Executable path: ${executablePath || 'default'}`);
    console.log(`Headless: ${isHeadless}`);
  }

  /**
   * Wait for browser to stabilize after launch
   */
  private async waitForBrowserStability(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  /**
   * Validate browser connection and test with a page
   */
  private async validateBrowserConnection(): Promise<void> {
    if (!this.isBrowserConnected()) {
      throw new Error('Browser launched but connection lost immediately');
    }
    try {
      const testPage = await this.browser!.newPage();
      await testPage.close();
    } catch (testError) {
      throw new Error(
        `Browser test failed: ${
          testError instanceof Error ? testError.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Setup listener for browser disconnect event
   */
  private setupBrowserDisconnectListener(): void {
    this.browser!.on('disconnected', () => {
      console.warn('Browser disconnected, resetting instance');
      this.browser = null;
    });
  }

  /**
   * Handle browser launch error and prepare for retry
   */
  private async handleBrowserLaunchError(
    error: unknown,
    attempt: number,
    maxRetries: number,
  ): Promise<Error> {
    const lastError = error instanceof Error ? error : new Error(String(error));
    console.warn(
      `Browser launch attempt ${attempt} failed: ${lastError.message}`,
    );
    if (lastError.stack) {
      console.warn(`Stack trace: ${lastError.stack}`);
    }
    await this.closeBrowserInstance();
    if (attempt < maxRetries) {
      await this.waitBeforeRetry(attempt);
    }
    return lastError;
  }

  /**
   * Wait before retry with exponential backoff
   */
  private async waitBeforeRetry(attempt: number): Promise<void> {
    const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
    console.log(`Retrying in ${delayMs}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
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
      const monitoringId = urlObj.searchParams.get('monitoring_id');
      const isValidMonitoringId =
        monitoringId !== null && /^\d+$/.test(monitoringId);
      if (
        !isValidDomain ||
        !isValidPath ||
        !hasMonitoringId ||
        !isValidMonitoringId
      ) {
        return false;
      }
      const hasRange = urlObj.searchParams.has('range');
      const hasStartDate = urlObj.searchParams.has('start_date');
      const hasEndDate = urlObj.searchParams.has('end_date');
      if (hasRange) {
        return true;
      }
      if (hasStartDate && hasEndDate) {
        const startDate = urlObj.searchParams.get('start_date');
        const endDate = urlObj.searchParams.get('end_date');
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        return (
          startDate !== null &&
          endDate !== null &&
          dateRegex.test(startDate) &&
          dateRegex.test(endDate)
        );
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check pagination information from the page
   */
  private async checkPagination(page: Page): Promise<PaginationInfo> {
    const totalPagesDefault = 1;
    const currentPageDefault = 1;

    const paginationInfo = await page.evaluate(() => {
      const paginationElement = document.querySelector(
        '[aria-label="pagination"]',
      );
      if (!paginationElement) {
        return { hasPagination: false, totalPages: 1, currentPage: 1 };
      }
      const listItems = paginationElement.querySelectorAll('li');
      const pageNumbers: number[] = [];
      listItems.forEach((li) => {
        const text = li.textContent?.trim() || '';
        const pageNum = Number.parseInt(text, 10);
        if (!Number.isNaN(pageNum) && pageNum > 0) {
          pageNumbers.push(pageNum);
        }
      });
      const totalPages =
        pageNumbers.length > 0 ? Math.max(...pageNumbers) : totalPagesDefault;
      const currentPage =
        Array.from(listItems).findIndex((li) => {
          const ariaCurrent = li.getAttribute('aria-current');
          return (
            ariaCurrent === 'true' ||
            li.getAttribute('aria-selected') === 'true'
          );
        }) + 1 || 1;
      return {
        hasPagination: totalPages > 1,
        totalPages:
          totalPages > 1 ? Math.max(...pageNumbers) : totalPagesDefault,
        currentPage: currentPage > 0 ? currentPage : currentPageDefault,
      };
    });

    return paginationInfo;
  }

  /**
   * Navigate to a specific page in pagination
   */
  private async navigateToPage(
    page: Page,
    targetPage: number,
  ): Promise<boolean> {
    try {
      const success = await page.evaluate((pageNum) => {
        const paginationElement = document.querySelector(
          '[aria-label="pagination"]',
        );
        if (!paginationElement) {
          return false;
        }
        const listItems = Array.from(paginationElement.querySelectorAll('li'));
        const targetItem = listItems.find((li) => {
          const text = li.textContent?.trim() || '';
          return text === String(pageNum);
        });
        if (targetItem) {
          (targetItem as HTMLElement).click();
          return true;
        }
        return false;
      }, targetPage);
      if (success) {
        await this.humanDelay(500, 800);
        await page.waitForSelector('table', { timeout: 5000 }).catch(() => {
          // Table might already be there
        });
        await this.humanDelay(200, 300);
      }
      return success;
    } catch {
      return false;
    }
  }

  /**
   * Wait for table to appear using various selectors
   */
  private async waitForTable(page: Page): Promise<boolean> {
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
    for (const selector of selectorsToTry) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        return true;
      } catch {
        // Continue to next selector
      }
    }
    return false;
  }

  /**
   * Check if table exists in modal/popup
   */
  private async checkTableInModal(page: Page): Promise<boolean> {
    const modalExists = await page.evaluate(() => {
      const modals = document.querySelectorAll(
        '[role="dialog"], .modal, [class*="Modal"], [class*="popup"], [class*="Popup"], [class*="drawer"], [class*="Drawer"]',
      );
      return modals.length > 0;
    });
    if (!modalExists) {
      return false;
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      await this.humanDelay(300, 500);
      const hasTable = await page.evaluate(() => {
        const modals = document.querySelectorAll(
          '[role="dialog"], .modal, [class*="Modal"], [class*="popup"], [class*="Popup"]',
        );
        for (const modal of modals) {
          const table = modal.querySelector('table');
          if (table) return true;
        }
        return false;
      });
      if (hasTable) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extract table HTML from page
   */
  private async extractTableHtml(page: Page): Promise<string | null> {
    return page.evaluate(() => {
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
      const modals = document.querySelectorAll(
        '[role="dialog"], .modal, [class*="Modal"], [class*="popup"], [class*="Popup"], [class*="drawer"], [class*="Drawer"]',
      );
      for (const modal of modals) {
        const table = modal.querySelector('table');
        if (table) {
          return table.outerHTML;
        }
        const divTable = modal.querySelector(
          '[class*="table"], [class*="Table"]',
        );
        if (divTable) {
          return divTable.outerHTML;
        }
      }
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
  }

  /**
   * Scrape table data from current page
   */
  private async scrapeTableFromPage(page: Page): Promise<PageScrapeResult> {
    await this.humanDelay(100, 200);
    const tableFound = await this.waitForTable(page);
    if (!tableFound) {
      await this.humanDelay(500, 800);
      await this.checkTableInModal(page);
    }
    const tableHtml = await this.extractTableHtml(page);
    if (!tableHtml) {
      throw new Error('Table HTML not found on page');
    }
    const prNumbers = this.extractPrNumbersFromTable(tableHtml);
    if (prNumbers.length === 0) {
      const fallbackPrNumbers = this.extractPrNumbersFromText(tableHtml);
      return { tableHtml, prNumbers: fallbackPrNumbers };
    }
    return { tableHtml, prNumbers };
  }

  /**
   * Check if user is logged in
   */
  private async checkLoginStatus(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const loginForm = document.querySelector('form[action*="login"]');
      const userMenu = document.querySelector('[data-testid="user-menu"]');
      return (
        !loginForm &&
        (userMenu !== null || document.body.innerText.includes('Monthly'))
      );
    });
  }

  /**
   * Handle login process
   */
  private async handleLogin(page: Page): Promise<FindyScrapeResult | null> {
    const orgName = this.configService.get<string>('FINDY_ORG_NAME');
    const email = this.configService.get<string>('FINDY_EMAIL');
    const password = this.configService.get<string>('FINDY_PASSWORD');
    if (!orgName || !email || !password) {
      return {
        success: false,
        error:
          'Not logged in and no credentials provided. Please set FINDY_ORG_NAME, FINDY_EMAIL and FINDY_PASSWORD environment variables.',
      };
    }
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
    const orgNameInput = await page.$('#orgName');
    const emailInput = await page.$('#email');
    const passwordInput = await page.$('#current-password');
    const loginButton = await page.$('button[type="submit"]');
    if (!orgNameInput || !emailInput || !passwordInput || !loginButton) {
      return {
        success: false,
        error:
          'Could not find all required login form elements. Please check the page structure.',
      };
    }
    await orgNameInput.type(orgName, { delay: 0 });
    await this.humanDelay(30, 50);
    await emailInput.type(email, { delay: 0 });
    await this.humanDelay(30, 50);
    await passwordInput.type(password, { delay: 0 });
    await this.humanDelay(50, 100);
    await loginButton.click();
    await page.waitForNavigation({
      waitUntil: 'domcontentloaded',
      timeout: 8000,
    });
    await this.humanDelay(200, 300);
    return null;
  }

  /**
   * Find Monthly button on the page
   */
  private async findMonthlyButton(
    page: Page,
  ): Promise<Awaited<ReturnType<Page['$']>> | null> {
    const buttonIndex = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        const text = btn.textContent?.trim() || '';
        if (
          text.toLowerCase() === 'monthly' ||
          text.toLowerCase().includes('monthly')
        ) {
          return i;
        }
      }
      return -1;
    });
    if (buttonIndex >= 0) {
      const allButtons = await page.$$('button');
      if (allButtons[buttonIndex]) {
        console.log('Found Monthly button at index:', buttonIndex);
        return allButtons[buttonIndex];
      }
    }
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate((el) => {
        return el.textContent?.trim() || '';
      }, btn);
      if (
        text.toLowerCase() === 'monthly' ||
        text.toLowerCase().includes('monthly')
      ) {
        console.log('Found Monthly button by iterating buttons');
        return btn;
      }
    }
    return null;
  }

  /**
   * Click Monthly button
   */
  private async clickMonthlyButton(
    page: Page,
    monthlyButton: NonNullable<Awaited<ReturnType<Page['$']>>>,
  ): Promise<void> {
    const wasSelected = await page.evaluate((el) => {
      return (el as HTMLElement).getAttribute('aria-pressed') === 'true';
    }, monthlyButton);
    await page.evaluate((el) => {
      const btn = el as HTMLElement;
      const originalStyle = btn.getAttribute('style') || '';
      btn.setAttribute(
        'style',
        `${originalStyle}; border: 3px solid red !important; background: yellow !important; z-index: 9999 !important;`,
      );
      setTimeout(() => {
        btn.setAttribute('style', originalStyle);
      }, 1000);
    }, monthlyButton);
    console.log('Clicking Monthly button...');
    await this.moveMouseToElement(page, monthlyButton);
    await this.humanDelay(100, 200);
    await monthlyButton.click({ delay: 50 });
    console.log('Monthly button clicked successfully');
    if (wasSelected) {
      console.log(
        'Monthly button was already selected, clicked again to ensure state',
      );
    }
    await this.humanDelay(300, 500);
  }

  /**
   * Wait for chart to be visible
   */
  private async waitForChart(page: Page): Promise<FindyScrapeResult | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.waitForSelector('.recharts-layer.recharts-bar', {
          timeout: 2000,
        });
        await this.humanDelay(100, 200);
        return null;
      } catch {
        if (attempt < 2) {
          await this.humanDelay(100, 200);
        }
      }
    }
    return {
      success: false,
      error:
        'Chart not found after waiting. The page might not be fully loaded.',
    };
  }

  /**
   * Interact with chart (hover and click)
   */
  private async interactWithChart(
    page: Page,
  ): Promise<FindyScrapeResult | null> {
    const chartBar = await page.$('.recharts-layer.recharts-bar');
    if (!chartBar) {
      return {
        success: false,
        error: 'Chart bar element not found',
      };
    }
    await chartBar.scrollIntoView();
    await this.humanDelay(50, 100);
    const box = await chartBar.boundingBox();
    if (!box) {
      return {
        success: false,
        error: 'Could not get chart bar position',
      };
    }
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    console.log('Moving mouse to chart bar...');
    await page.mouse.move(centerX, centerY, { steps: 10 });
    await this.humanDelay(100, 200);
    const pageTitle = await page.title();
    if (!pageTitle || pageTitle.trim() === '') {
      return {
        success: false,
        error: 'Page became unresponsive after hovering over chart',
      };
    }
    console.log('Clicking on chart bar...');
    await page.mouse.click(centerX, centerY, { delay: 50 });
    console.log('Chart bar clicked');
    await this.humanDelay(500, 800);
    return null;
  }

  /**
   * Scrape all pages with pagination
   */
  private async scrapeAllPages(
    page: Page,
    firstPageResult: PageScrapeResult,
    paginationInfo: PaginationInfo,
  ): Promise<FindyScrapeResult> {
    const allTableHtmls: string[] = [firstPageResult.tableHtml];
    const allPrNumbers: number[] = [...firstPageResult.prNumbers];
    for (let pageNum = 2; pageNum <= paginationInfo.totalPages; pageNum++) {
      console.log(
        `Scraping page ${pageNum} of ${paginationInfo.totalPages}...`,
      );
      const navigated = await this.navigateToPage(page, pageNum);
      if (!navigated) {
        console.warn(`Failed to navigate to page ${pageNum}, skipping...`);
        continue;
      }
      try {
        const pageResult = await this.scrapeTableFromPage(page);
        allTableHtmls.push(pageResult.tableHtml);
        allPrNumbers.push(...pageResult.prNumbers);
        console.log(
          `Page ${pageNum} scraped successfully. Found ${pageResult.prNumbers.length} PR numbers.`,
        );
      } catch (error) {
        console.error(`Error scraping page ${pageNum}:`, error);
      }
    }
    const mergedTableHtml = this.mergeTableHtmls(allTableHtmls);
    const uniquePrNumbers = [...new Set(allPrNumbers)].sort((a, b) => a - b);
    console.log(
      `Scraping completed. Total PR numbers found: ${uniquePrNumbers.length}`,
    );
    return {
      success: true,
      data: {
        source: 'table',
        html: mergedTableHtml,
        pages: paginationInfo.totalPages,
      },
      prNumbers: uniquePrNumbers,
    };
  }

  /**
   * Scrape Findy Team data
   */
  async scrapeFindyTeam(url: string): Promise<FindyScrapeResult> {
    if (!this.validateFindyUrl(url)) {
      return {
        success: false,
        error:
          'Invalid URL format. Expected:\n• https://findy-team.io/team/analytics/cycletime?monitoring_id=<number>&range=<string>\n• https://findy-team.io/team/analytics/cycletime?monitoring_id=<number>&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD',
      };
    }
    let page: Page | null = null;
    try {
      page = await this.initializePage();
      await this.navigateToUrl(page, url);
      const loginResult = await this.ensureLoggedIn(page);
      if (loginResult) {
        return loginResult;
      }
      await this.selectMonthlyView(page);
      const chartError = await this.waitForChart(page);
      if (chartError) {
        return chartError;
      }
      const chartInteractionError = await this.interactWithChart(page);
      if (chartInteractionError) {
        return chartInteractionError;
      }
      return await this.scrapeTableData(page);
    } catch (error) {
      await this.handleBrowserConnectionError(error);
      return {
        success: false,
        error: `Scraping failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    } finally {
      await this.closePageSafely(page);
    }
  }

  /**
   * Initialize browser page with viewport settings
   * Falls back to creating a fresh browser if singleton fails
   */
  private async initializePage(): Promise<Page> {
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      return page;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        `Failed to get singleton browser (${errorMessage}), attempting fresh browser launch...`,
      );
      try {
        // Fallback: launch a fresh browser just for this request
        const browser = await this.launchFreshBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        // Store reference to close later
        (page as Page & { _tempBrowser?: Browser })._tempBrowser = browser;
        return page;
      } catch (fallbackError) {
        const fallbackMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : 'Unknown error';
        throw new Error(
          `Failed to initialize browser (singleton: ${errorMessage}, fallback: ${fallbackMessage})`,
        );
      }
    }
  }

  /**
   * Launch a fresh browser instance (not stored as singleton)
   */
  private async launchFreshBrowser(): Promise<Browser> {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    const isHeadless = process.env.PUPPETEER_HEADLESS !== 'false';
    const launchOptions = {
      headless: isHeadless,
      executablePath: executablePath || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-default-apps',
        '--disable-sync',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--ignore-certificate-errors',
      ],
      timeout: 30000,
    };
    try {
      return await puppeteer.launch(launchOptions);
    } catch (error) {
      throw new Error(
        `Failed to launch fresh browser: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Navigate to URL
   */
  private async navigateToUrl(page: Page, url: string): Promise<void> {
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
  }

  /**
   * Ensure user is logged in, return error result if login fails
   */
  private async ensureLoggedIn(page: Page): Promise<FindyScrapeResult | null> {
    const isLoggedIn = await this.checkLoginStatus(page);
    if (!isLoggedIn) {
      return await this.handleLogin(page);
    }
    return null;
  }

  /**
   * Select monthly view by clicking Monthly button
   */
  private async selectMonthlyView(page: Page): Promise<void> {
    await this.humanDelay(100, 200);
    console.log('Looking for Monthly button...');
    const monthlyButton = await this.findMonthlyButton(page);
    if (monthlyButton) {
      await this.clickMonthlyButton(page, monthlyButton);
    } else {
      console.warn(
        'Monthly button not found - might already be selected or page structure changed',
      );
    }
  }

  /**
   * Scrape table data from page, handling pagination if needed
   */
  private async scrapeTableData(page: Page): Promise<FindyScrapeResult> {
    try {
      console.log('Waiting for table to appear...');
      const firstPageResult = await this.scrapeTableFromPage(page);
      console.log('Got table HTML from first page');
      console.log('Checking for pagination...');
      const paginationInfo = await this.checkPagination(page);
      console.log(
        `Pagination info: hasPagination=${paginationInfo.hasPagination}, totalPages=${paginationInfo.totalPages}`,
      );
      if (!paginationInfo.hasPagination || paginationInfo.totalPages <= 1) {
        return {
          success: true,
          data: { source: 'table', html: firstPageResult.tableHtml },
          prNumbers: firstPageResult.prNumbers,
        };
      }
      return await this.scrapeAllPages(page, firstPageResult, paginationInfo);
    } catch (error) {
      console.error('Error finding table:', error);
      return {
        success: false,
        error: `Could not find table after clicking chart: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  /**
   * Handle browser connection errors by resetting browser instance
   */
  private async handleBrowserConnectionError(error: unknown): Promise<void> {
    if (
      error instanceof Error &&
      (error.message.includes('Target closed') ||
        error.message.includes('Protocol error') ||
        error.message.includes('Connection closed'))
    ) {
      console.warn('Browser connection lost, resetting browser instance');
      await this.closeBrowserInstance();
    }
  }

  /**
   * Close page safely, handling errors
   * Also closes temporary browser if page was created with fresh browser
   */
  private async closePageSafely(page: Page | null): Promise<void> {
    if (!page) {
      return;
    }
    try {
      // Check if page has a temporary browser attached
      const tempBrowser = (page as Page & { _tempBrowser?: Browser })
        ._tempBrowser;
      if (tempBrowser) {
        // Close the temporary browser (this will also close all pages)
        try {
          await tempBrowser.close();
        } catch (error) {
          console.warn('Error closing temporary browser:', error);
        }
        return;
      }
      // Otherwise just close the page
      if (!page.isClosed()) {
        await page.close();
      }
    } catch (error) {
      console.warn('Error closing page:', error);
    }
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
   * Merge multiple table HTMLs into one
   */
  private mergeTableHtmls(tableHtmls: string[]): string {
    if (tableHtmls.length === 0) {
      return '';
    }
    if (tableHtmls.length === 1) {
      return tableHtmls[0];
    }
    const firstTable = tableHtmls[0];
    const tbodyRegex = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i;
    const tbodyMatches = tbodyRegex.exec(firstTable);
    if (!tbodyMatches) {
      return firstTable;
    }
    const theadRegex = /<thead[^>]*>([\s\S]*?)<\/thead>/i;
    const theadMatch = theadRegex.exec(firstTable);
    const thead = theadMatch ? theadMatch[0] : '';
    const allTbodyRows: string[] = [];
    tableHtmls.forEach((html) => {
      const tbodyRegexInstance = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i;
      const tbodyMatch = tbodyRegexInstance.exec(html);
      if (tbodyMatch) {
        const rows: string[] = [];
        const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
        let rowMatch: RegExpExecArray | null;
        while ((rowMatch = rowRegex.exec(tbodyMatch[1])) !== null) {
          rows.push(rowMatch[0]);
        }
        if (rows.length > 0) {
          allTbodyRows.push(...rows);
        }
      }
    });
    const mergedTbody = `<tbody>${allTbodyRows.join('')}</tbody>`;
    const tableRegex = /<table[^>]*>/i;
    const tableMatch = tableRegex.exec(firstTable);
    const tableOpenTag = tableMatch ? tableMatch[0] : '<table>';
    const tableCloseTag = '</table>';
    return `${tableOpenTag}${thead}${mergedTbody}${tableCloseTag}`;
  }

  /**
   * Extract PR numbers from table HTML
   * Priority:
   * 1. Find first td with class "css-18a3pw2 e38b3j914"
   * 2. If not found, find first td containing an <a> tag with PR link in href
   * 3. Extract PR number from the link
   */
  private extractPrNumbersFromTable(tableHtml: string): number[] {
    const prNumbers: number[] = [];
    const prLinkPattern = /\/pull\/(\d+)/i;
    const rowsPattern = /<tr[^>]*>.*?<\/tr>/gis;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowsPattern.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[0];
      let prNumber: number | null = null;

      // Try to find td with class "css-18a3pw2 e38b3j914" (class order may vary)
      const specificClassPattern =
        /<td[^>]*class="[^"]*(?:css-18a3pw2[^"]*e38b3j914|e38b3j914[^"]*css-18a3pw2)[^"]*"[^>]*>(.*?)<\/td>/is;
      const specificClassMatch = rowHtml.match(specificClassPattern);
      if (specificClassMatch) {
        const cellContent = specificClassMatch[1];
        const linkMatch = cellContent.match(/<a[^>]*href="([^"]*)"[^>]*>/i);
        if (linkMatch && linkMatch[1]) {
          const prMatch = linkMatch[1].match(prLinkPattern);
          if (prMatch && prMatch[1]) {
            prNumber = Number.parseInt(prMatch[1], 10);
          }
        }
      } else {
        // Fallback: find first td containing an <a> tag with PR link
        const tdPattern = /<td[^>]*>(.*?)<\/td>/gis;
        let tdMatch: RegExpExecArray | null;
        while ((tdMatch = tdPattern.exec(rowHtml)) !== null) {
          const tdContent = tdMatch[1];
          const linkMatch = tdContent.match(/<a[^>]*href="([^"]*)"[^>]*>/i);
          if (linkMatch && linkMatch[1]) {
            const prMatch = linkMatch[1].match(prLinkPattern);
            if (prMatch && prMatch[1]) {
              prNumber = Number.parseInt(prMatch[1], 10);
              break;
            }
          }
        }
      }

      if (
        prNumber &&
        !Number.isNaN(prNumber) &&
        !prNumbers.includes(prNumber)
      ) {
        prNumbers.push(prNumber);
      }
    }

    // Fallback to general text extraction if no PRs found
    if (prNumbers.length === 0) {
      return this.extractPrNumbersFromText(tableHtml);
    }

    return prNumbers.sort((a, b) => a - b);
  }

  /**
   * Close browser instance
   */
  async closeBrowser(): Promise<void> {
    await this.closeBrowserInstance();
  }
}
