import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PrService } from '@pr/pr.service';
import { StorageService } from '@storage/storage.service';
import { GitHubService } from '@github/github.service';
import { GitHubGraphQLService } from '@github/github-graphql.service';
import { WorkflowValidationService } from '@workflow/workflow-validation.service';
import type { ValidationIssue } from '@shared/workflow.types';
import { TimelineService } from '@timeline/timeline.service';
import { PrDataHelper } from '@dashboard/pr-data.helper';
import { ScraperService } from '@scraper/scraper.service';
import type { GetDataDto } from '@shared/dashboard.types';
import type { TimelineResult } from '@shared/timeline.types';
import type { GitHubPullRequestDetail } from '@shared/github.types';
import { ApiKeyGuard } from '@auth/api-key.guard';
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '../shared/pagination.constants';

@Controller('dashboard')
@UseGuards(ApiKeyGuard)
export class DashboardController {
  constructor(
    private readonly prService: PrService,
    private readonly storageService: StorageService,
    private readonly githubService: GitHubService,
    private readonly githubGraphQLService: GitHubGraphQLService,
    private readonly workflowValidationService: WorkflowValidationService,
    private readonly timelineService: TimelineService,
    private readonly scraperService: ScraperService,
  ) {}

  /**
   * Get dashboard data for a specific date with pagination
   */
  @Get()
  getDashboard(
    @Query('date') date?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const selectedDate = date || new Date().toISOString().split('T')[0];
    const data = this.storageService.loadDataByDate(selectedDate);
    const availableDates = this.storageService.listAvailableDates();
    const prsArray = data?.prs || [];
    const cleanData = PrDataHelper.processPrDataForDashboard(prsArray);
    const hasData = cleanData.length > 0;
    const prsWithForcePushCheck = cleanData.map((pr) => ({
      ...pr,
      hasForcePushed: pr.hasForcePushed === true,
    }));
    // Pagination
    const pageNum = page ? Number.parseInt(page, 10) : 1;
    const limitNum = limit ? Number.parseInt(limit, 10) : DEFAULT_PAGE_LIMIT;
    const validPage = Number.isNaN(pageNum) || pageNum < 1 ? 1 : pageNum;
    const validLimit =
      Number.isNaN(limitNum) || limitNum < 1 || limitNum > MAX_PAGE_LIMIT
        ? DEFAULT_PAGE_LIMIT
        : limitNum;
    const totalPages = Math.ceil(prsWithForcePushCheck.length / validLimit);
    const normalizedPage = totalPages > 0 && validPage > totalPages ? totalPages : validPage;
    const startIndex = (normalizedPage - 1) * validLimit;
    const endIndex = startIndex + validLimit;
    const paginatedData = prsWithForcePushCheck.slice(startIndex, endIndex);
    return {
      data: paginatedData,
      selectedDate,
      availableDates,
      hasData,
      pagination: {
        page: normalizedPage,
        limit: validLimit,
        total: prsWithForcePushCheck.length,
        totalPages,
        hasNextPage: normalizedPage < totalPages,
        hasPreviousPage: normalizedPage > 1,
      },
    };
  }

  /**
   * Fetch PR data from GitHub and save to storage
   */
  @Post('get-data')
  async getData(@Body() body: GetDataDto) {
    const prIdsString = body.prIds || '';
    const prNumbers = prIdsString
      .split(',')
      .map((id) => Number.parseInt(id.trim(), 10))
      .filter((id) => !Number.isNaN(id) && id > 0);
    if (prNumbers.length === 0) {
      throw new HttpException(
        'Invalid PR IDs provided',
        HttpStatus.BAD_REQUEST,
      );
    }
    const selectedDate =
      body.selectedDate || new Date().toISOString().split('T')[0];
    try {
      const metrics = await this.prService.calculateMetrics(prNumbers);
      this.storageService.saveDataByDate(metrics, selectedDate, true);
      return {
        success: true,
        message: `Successfully fetched data for ${prNumbers.length} PR(s)`,
        date: selectedDate,
        prNumbers,
      };
    } catch (error) {
      console.error('Error processing PR data:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to process PR data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('timeline/:prNumber')
  async getTimeline(
    @Param('prNumber') prNumber: string,
  ): Promise<
    | (TimelineResult & { validationIssues: ValidationIssue[] })
    | { error: string }
  > {
    try {
      const prNum = Number.parseInt(prNumber, 10);
      if (Number.isNaN(prNum)) {
        return { error: 'Invalid PR number' };
      }

      // Use GraphQL API - single call gets all data
      const prDetails = await this.githubService.getPullRequestDetails(prNum);
      if (!prDetails) {
        throw new Error('Failed to fetch PR details from GitHub');
      }
      // Extract events from GraphQL response (already included in prDetails)
      const events =
        (prDetails as GitHubPullRequestDetail & { _events?: unknown[] })
          ._events || [];

      const timeline = this.timelineService.buildTimeline(prDetails, events);

      const status = this.prService.getPrStatus(prDetails);

      // Check if PR has "exclude in FindyTeam" label
      const hasExcludeLabel =
        prDetails.labels?.some(
          (label) => label.name === 'exclude in FindyTeam',
        ) || false;

      // Validate workflow only if not excluded
      let validationIssues: ValidationIssue[] = [];
      if (hasExcludeLabel || status === 'Draft') {
        validationIssues = [];
      } else {
        const timelineItems = timeline.timeline || [];

        // Create workflow data for validation
        const workflowDataForValidation = {
          prNumber: prNum,
          status,
          createdAt: prDetails.created_at || '',
          updatedAt: prDetails.updated_at || prDetails.created_at || '',
        };

        // Ensure timeline items are passed correctly
        if (timelineItems.length > 0) {
          validationIssues = this.workflowValidationService.validateWorkflow(
            workflowDataForValidation,
            timelineItems,
          );
        } else {
          // If no timeline items, log warning
          console.warn(`[PR ${prNum}] No timeline items found for validation`);
        }
      }

      return {
        ...timeline,
        validationIssues,
      };
    } catch (error) {
      console.error('Error fetching timeline:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        error: `Failed to fetch timeline: ${errorMessage}`,
      };
    }
  }

  @Get('validation/:prNumber')
  async getValidationIssues(@Param('prNumber') prNumber: string) {
    try {
      const prNum = Number.parseInt(prNumber, 10);
      if (Number.isNaN(prNum)) {
        return { error: 'Invalid PR number' };
      }

      // Build timeline from GitHub API
      // GraphQL response already includes events and commits
      const prDetails = await this.githubService.getPullRequestDetails(prNum);

      if (!prDetails) {
        return { error: 'Failed to fetch PR details from GitHub' };
      }

      // Extract events from GraphQL response
      const events =
        (prDetails as GitHubPullRequestDetail & { _events?: unknown[] })
          ._events || [];
      const timeline = this.timelineService.buildTimeline(prDetails, events);

      const status = this.prService.getPrStatus(prDetails);
      const timelineItems = timeline.timeline || [];

      const workflowDataForValidation = {
        status,
        createdAt: prDetails.created_at || '',
      };

      const validationIssues = this.workflowValidationService.validateWorkflow(
        workflowDataForValidation,
        timelineItems,
      );

      return {
        prNumber: prNum,
        validationIssues,
      };
    } catch (error) {
      console.error('Error fetching validation issues:', error);
      return { error: 'Failed to fetch validation issues' };
    }
  }

  @Get('validation')
  async getAllValidationIssues() {
    try {
      // Get all PRs from today's data
      const todayData = this.storageService.loadTodayData();
      if (!todayData?.prs || todayData.prs.length === 0) {
        return {
          total: 0,
          withIssues: 0,
          results: [],
        };
      }

      const results = await Promise.all(
        todayData.prs.map(async (pr) => {
          if (!pr?.prNumber) {
            return null;
          }

          try {
            // Build timeline from GitHub API
            // GraphQL response already includes events and commits
            const prDetails = await this.githubService.getPullRequestDetails(
              pr.prNumber,
            );

            if (!prDetails) {
              return null;
            }

            // Extract events from GraphQL response
            const events =
              (prDetails as GitHubPullRequestDetail & { _events?: unknown[] })
                ._events || [];
            const timeline = this.timelineService.buildTimeline(
              prDetails,
              events,
            );

            const status = this.prService.getPrStatus(prDetails);
            const timelineItems = timeline.timeline || [];

            const workflowDataForValidation = {
              status,
              createdAt: prDetails.created_at || '',
            };

            const validationIssues =
              this.workflowValidationService.validateWorkflow(
                workflowDataForValidation,
                timelineItems,
              );

            return {
              prNumber: pr.prNumber,
              title: pr.title || `PR #${pr.prNumber}`,
              author: pr.author || 'Unknown',
              url: pr.url || '',
              status: pr.status || status,
              validationIssues,
              hasIssues: validationIssues.length > 0,
              errorCount: validationIssues.filter((i) => i.severity === 'error')
                .length,
              warningCount: validationIssues.filter(
                (i) => i.severity === 'warning',
              ).length,
            };
          } catch (error) {
            console.error(
              `Error processing validation for PR ${pr.prNumber}:`,
              error,
            );
            return null;
          }
        }),
      );

      const validResults = results.filter((r) => r !== null);

      return {
        total: validResults.length,
        withIssues: validResults.filter((r) => r?.hasIssues).length,
        results: validResults,
      };
    } catch (error) {
      console.error('Error fetching all validation issues:', error);
      return { error: 'Failed to fetch validation issues' };
    }
  }

  /**
   * Delete a PR from storage for a specific date
   */
  @Delete('pr/:prNumber')
  deletePr(@Param('prNumber') prNumber: string, @Query('date') date?: string) {
    const prNum = Number.parseInt(prNumber, 10);
    if (Number.isNaN(prNum)) {
      throw new HttpException('Invalid PR number', HttpStatus.BAD_REQUEST);
    }
    const targetDate = date || new Date().toISOString().split('T')[0];
    const deleted = this.storageService.deletePrFromDate(prNum, targetDate);
    if (!deleted) {
      throw new HttpException(
        `PR not found in data for date ${targetDate}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      success: true,
      message: `PR #${prNum} deleted successfully`,
    };
  }

  @Get('scrape')
  async scrapeUrl(@Query('url') url?: string, @Query('type') type?: string) {
    if (!url) {
      return { error: 'URL parameter is required' };
    }

    try {
      switch (type) {
        case 'html':
          return await this.scraperService.scrapeHtml(url);
        case 'text':
          return await this.scraperService.scrapeText(url);
        case 'json':
          return await this.scraperService.scrapeJson(url);
        case 'screenshot': {
          const result = await this.scraperService.takeScreenshot(url, {
            fullPage: true,
          });
          return {
            url: result.url,
            title: result.title,
            screenshot: result.screenshot?.toString('base64'),
          };
        }
        default:
          return await this.scraperService.scrapeHtml(url);
      }
    } catch (error) {
      console.error('Error scraping URL:', error);
      return {
        error: 'Failed to scrape URL',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
