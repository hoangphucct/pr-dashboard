import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FindyScraperService } from '@scraper/findy-scraper.service';
import { RawDataService, RawDataContent } from '@raw-data/raw-data.service';
import { PrDataHelper } from '@dashboard/pr-data.helper';
import { HtmlParserHelper } from '@raw-data/html-parser.helper';
import { ApiKeyGuard } from '@auth/api-key.guard';
import type { DashboardPrData } from '@shared/dashboard.types';
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '../shared/pagination.constants';

interface RawDataFileInfo {
  fileName: string;
  scrapedAt: string;
  url: string;
  prCount: number;
}

@Controller('raw-data')
@UseGuards(ApiKeyGuard)
export class RawDataController {
  constructor(
    private readonly findyScraperService: FindyScraperService,
    private readonly rawDataService: RawDataService,
  ) {}

  /**
   * Get raw data files list and optionally load a selected file's data with pagination
   */
  @Get()
  async getRawData(
    @Query('selectedFile') selectedFile?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const rawDataFiles = this.rawDataService.listRawDataFiles();
    if (!selectedFile) {
      return this.buildEmptyResponse(rawDataFiles);
    }
    const fileContent = this.rawDataService.loadRawDataFile(selectedFile);
    if (!fileContent) {
      return this.buildEmptyResponse(rawDataFiles, selectedFile);
    }
    const prsData = this.processFileContent(fileContent);
    const pagination = this.parsePaginationParams(page, limit);
    const totalPages = Math.ceil(prsData.length / pagination.limit);
    const normalizedPagination = this.normalizePagination(pagination, totalPages);
    const paginatedPrs = this.applyPagination(prsData, normalizedPagination);
    const selectedFileData = this.buildFileInfo(selectedFile, fileContent, prsData.length);
    return {
      rawDataFiles,
      selectedFile,
      selectedFileData,
      prsData: paginatedPrs,
      hasData: paginatedPrs.length > 0,
      pagination: this.buildPaginationInfo(normalizedPagination, prsData.length),
    };
  }

  /**
   * Build empty response when no file is selected or file not found
   */
  private buildEmptyResponse(
    rawDataFiles: unknown[],
    selectedFile?: string,
  ): {
    rawDataFiles: unknown[];
    selectedFile?: string;
    selectedFileData: null;
    prsData: unknown[];
    hasData: boolean;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  } {
    return {
      rawDataFiles,
      selectedFile,
      selectedFileData: null,
      prsData: [],
      hasData: false,
      pagination: {
        page: 1,
        limit: DEFAULT_PAGE_LIMIT,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }

  /**
   * Process file content and return PRs data with open dates
   */
  private processFileContent(fileContent: RawDataContent): DashboardPrData[] {
    const prsArray = this.loadPrsArrayFromFile(fileContent);
    let prsData = PrDataHelper.processPrDataForDashboard(prsArray);
    prsData = this.enrichPrsWithOpenDates(prsData, fileContent);
    return this.sortByOpenDate(prsData);
  }

  /**
   * Load PRs array from file content
   */
  private loadPrsArrayFromFile(fileContent: RawDataContent): unknown[] {
    const dataPrs = fileContent.data?.prs;
    if (Array.isArray(dataPrs)) {
      return dataPrs;
    }
    const htmlData = fileContent.data as { html?: string } | null;
    if (htmlData?.html && typeof htmlData.html === 'string') {
      return HtmlParserHelper.parsePrsFromHtml(htmlData.html);
    }
    return [];
  }

  /**
   * Enrich PRs with open dates from HTML or fallback to scrapedAt
   */
  private enrichPrsWithOpenDates(
    prsData: DashboardPrData[],
    fileContent: RawDataContent,
  ): DashboardPrData[] {
    const htmlData = fileContent.data as { html?: string } | null;
    if (htmlData?.html && typeof htmlData.html === 'string') {
      const openDatesMap = HtmlParserHelper.extractOpenDatesFromHtml(fileContent.data);
      return prsData.map((pr) => {
        const openDate =
          pr.openDate ||
          (pr.prNumber && openDatesMap.has(pr.prNumber)
            ? openDatesMap.get(pr.prNumber)
            : fileContent.scrapedAt);
        return {
          ...pr,
          openDate,
        };
      });
    }
    return prsData.map((pr) => ({
      ...pr,
      openDate: pr.openDate || fileContent.scrapedAt,
    }));
  }

  /**
   * Parse and validate pagination parameters
   */
  private parsePaginationParams(
    page?: string,
    limit?: string,
  ): { page: number; limit: number } {
    const pageNum = page ? Number.parseInt(page, 10) : 1;
    const limitNum = limit ? Number.parseInt(limit, 10) : DEFAULT_PAGE_LIMIT;
    return {
      page: Number.isNaN(pageNum) || pageNum < 1 ? 1 : pageNum,
      limit:
        Number.isNaN(limitNum) || limitNum < 1 || limitNum > MAX_PAGE_LIMIT
          ? DEFAULT_PAGE_LIMIT
          : limitNum,
    };
  }

  /**
   * Normalize pagination to ensure page is within valid range
   */
  private normalizePagination(
    pagination: { page: number; limit: number },
    totalPages: number,
  ): { page: number; limit: number } {
    if (totalPages === 0) {
      return { page: 1, limit: pagination.limit };
    }
    const normalizedPage = Math.min(pagination.page, totalPages);
    return { page: normalizedPage, limit: pagination.limit };
  }

  /**
   * Apply pagination to data array
   */
  private applyPagination(
    data: DashboardPrData[],
    pagination: { page: number; limit: number },
  ): DashboardPrData[] {
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    return data.slice(startIndex, endIndex);
  }

  /**
   * Build file info object
   */
  private buildFileInfo(
    fileName: string,
    fileContent: { scrapedAt: string; url: string },
    prCount: number,
  ): RawDataFileInfo {
    return {
      fileName,
      scrapedAt: fileContent.scrapedAt,
      url: fileContent.url,
      prCount,
    };
  }

  /**
   * Build pagination info object
   */
  private buildPaginationInfo(
    pagination: { page: number; limit: number },
    total: number,
  ): {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  } {
    const totalPages = Math.ceil(total / pagination.limit);
    return {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPreviousPage: pagination.page > 1,
    };
  }

  /**
   * Sort PRs by openDate descending (newest first)
   * PRs without openDate are placed at the end
   */
  private sortByOpenDate(prsData: DashboardPrData[]): DashboardPrData[] {
    return [...prsData].sort((a, b) => {
      const aHasDate = Boolean(a.openDate);
      const bHasDate = Boolean(b.openDate);
      // If one has date and the other doesn't, prioritize the one with date
      if (aHasDate && !bHasDate) {
        return -1;
      }
      if (!aHasDate && bHasDate) {
        return 1;
      }
      // If both have dates, sort descending (newest first)
      if (aHasDate && bHasDate && a.openDate && b.openDate) {
        const aDate = new Date(a.openDate).getTime();
        const bDate = new Date(b.openDate).getTime();
        return bDate - aDate;
      }
      // If neither has date, maintain original order
      return 0;
    });
  }

  /**
   * Process raw data from Findy Team URL
   */
  @Post()
  async processRawData(@Body() body: { findyUrl?: string }) {
    const findyUrl = body.findyUrl?.trim();
    if (!findyUrl) {
      throw new HttpException('URL is required', HttpStatus.BAD_REQUEST);
    }
    if (!this.findyScraperService.validateFindyUrl(findyUrl)) {
      throw new HttpException('Invalid Findy Team URL', HttpStatus.BAD_REQUEST);
    }
    try {
      const scrapeResult =
        await this.findyScraperService.scrapeFindyTeam(findyUrl);
      if (!scrapeResult.success) {
        throw new HttpException(
          scrapeResult.error || 'Failed to scrape data from Findy Team',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      const fsModule = await import('node:fs');
      const pathModule = await import('node:path');
      const { writeFileSync, existsSync, mkdirSync } = fsModule;
      const rawDataDir = pathModule.join(process.cwd(), 'data', 'raw');
      if (!existsSync(rawDataDir)) {
        mkdirSync(rawDataDir, { recursive: true });
      }
      const timestamp = new Date()
        .toISOString()
        .replaceAll(':', '-')
        .replaceAll('.', '-');
      const fileName = `raw-data-${timestamp}.json`;
      const filePath = pathModule.join(rawDataDir, fileName);
      const rawDataToSave = {
        url: findyUrl,
        scrapedAt: new Date().toISOString(),
        success: scrapeResult.success,
        data: scrapeResult.data,
        prNumbers: scrapeResult.prNumbers || [],
        error: scrapeResult.error,
      };
      writeFileSync(filePath, JSON.stringify(rawDataToSave, null, 2), 'utf-8');
      const prNumbers = scrapeResult.prNumbers || [];
      return {
        success: true,
        message: 'Raw data saved successfully',
        fileName,
        prCount: prNumbers.length,
        prNumbers,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('Error processing raw data:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to process raw data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
