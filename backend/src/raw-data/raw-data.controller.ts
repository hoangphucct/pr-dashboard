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
import { RawDataService } from '@raw-data/raw-data.service';
import { StorageService } from '@storage/storage.service';
import { PrDataHelper } from '@dashboard/pr-data.helper';
import { ApiKeyGuard } from '@auth/api-key.guard';

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
    private readonly storageService: StorageService,
  ) {}

  /**
   * Get raw data files list and optionally load a selected file's data
   */
  @Get()
  getRawData(@Query('selectedFile') selectedFile?: string) {
    const rawDataFiles = this.rawDataService.listRawDataFiles();
    let prsData: unknown[] = [];
    let selectedFileData: RawDataFileInfo | null = null;
    if (selectedFile) {
      const fileContent = this.rawDataService.loadRawDataFile(selectedFile);
      if (fileContent) {
        let prsArray: unknown[] = [];
        const dataPrs = fileContent.data?.prs;
        if (Array.isArray(dataPrs)) {
          prsArray = dataPrs;
        } else if (fileContent.prNumbers && fileContent.prNumbers.length > 0) {
          prsArray = this.loadPrsFromStorage(fileContent.prNumbers);
        }
        prsData = PrDataHelper.processPrDataForDashboard(prsArray);
        selectedFileData = {
          fileName: selectedFile,
          scrapedAt: fileContent.scrapedAt,
          url: fileContent.url,
          prCount: prsData.length,
        };
      }
    }
    return {
      rawDataFiles,
      selectedFile,
      selectedFileData,
      prsData,
      hasData: prsData.length > 0,
    };
  }

  /**
   * Load PRs from storage by PR numbers
   */
  private loadPrsFromStorage(prNumbers: number[]): unknown[] {
    const prsArray: unknown[] = [];
    const availableDates = this.storageService.listAvailableDates();
    for (const date of availableDates) {
      const dateData = this.storageService.loadDataByDate(date);
      if (dateData?.prs) {
        const matchingPrs = dateData.prs.filter((pr) =>
          prNumbers.includes(pr.prNumber),
        );
        if (matchingPrs.length > 0) {
          prsArray.push(...matchingPrs);
        }
      }
    }
    return prsArray;
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
