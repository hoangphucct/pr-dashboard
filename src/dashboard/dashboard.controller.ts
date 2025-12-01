import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Render,
  Query,
  Res,
  Param,
} from '@nestjs/common';
import type { Response } from 'express';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { PrService } from '@pr/pr.service';
import { StorageService } from '@storage/storage.service';
import { GitHubService } from '@github/github.service';
import { WorkflowStorageService } from '@workflow/workflow-storage.service';
import {
  WorkflowValidationService,
  type ValidationIssue,
} from '@workflow/workflow-validation.service';
import { TimelineService } from '@timeline/timeline.service';
import { PrDataHelper } from '@dashboard/pr-data.helper';
import { ScraperService } from '@scraper/scraper.service';
import { FindyScraperService } from '@scraper/findy-scraper.service';
import type { GetDataDto } from '@shared/dashboard.types';
import type { TimelineResult } from '@shared/timeline.types';
import type { GitHubEvent } from '@shared/github.types';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly prService: PrService,
    private readonly storageService: StorageService,
    private readonly githubService: GitHubService,
    private readonly workflowStorageService: WorkflowStorageService,
    private readonly workflowValidationService: WorkflowValidationService,
    private readonly timelineService: TimelineService,
    private readonly scraperService: ScraperService,
    private readonly findyScraperService: FindyScraperService,
  ) {}

  @Get()
  @Render('dashboard')
  async showDashboard(@Query('date') date?: string) {
    const selectedDate = date || new Date().toISOString().split('T')[0];
    const data = this.storageService.loadDataByDate(selectedDate);
    const availableDates = this.storageService.listAvailableDates();

    const prsArray = data?.prs || [];
    const cleanData = PrDataHelper.processPrDataForDashboard(prsArray);

    // Check if there is any data first (independent check)
    const hasData = cleanData.length > 0;

    // Check if timeline needs update for each PR (only if there is data)
    // Check both: GitHub updatedAt vs cache AND timeline data hash vs cache
    // First, get all cached values
    const prsWithCache = cleanData.map((pr) => ({
      pr,
      cachedPrUpdatedAt: this.workflowStorageService.getCachedPrUpdatedAt(
        pr.prNumber,
      ),
      timelineDataChanged: this.workflowStorageService.checkTimelineDataChanged(
        pr.prNumber,
      ),
    }));

    // Fetch updatedAt from GitHub API for all PRs in parallel
    const githubUpdatedAts = await Promise.all(
      prsWithCache.map(({ pr }) =>
        this.githubService.getPullRequestUpdatedAt(pr.prNumber),
      ),
    );

    // hasForcePushed is now stored in PrMetrics (data-{date}.json)
    // So we can use it directly from pr object
    const prsWithForcePushCheck = prsWithCache.map(({ pr }) => ({
      ...pr,
      hasForcePushed: pr.hasForcePushed === true,
    }));

    // Compare GitHub updatedAt with cached prUpdatedAt AND check timeline data hash
    const dataWithTimelineCheck = prsWithForcePushCheck.map((pr, index) => {
      const { cachedPrUpdatedAt, timelineDataChanged } = prsWithCache[index];
      const githubUpdatedAt = githubUpdatedAts[index];

      // If no cache exists, check if PR was just added (compare with data file updatedAt)
      // If PR's updatedAt in data file matches GitHub updatedAt, it means data is fresh
      // and we just need to create the cache, not show update button
      if (!cachedPrUpdatedAt) {
        // If GitHub API call failed, don't show update button
        if (!githubUpdatedAt) {
          return {
            ...pr,
            needsTimelineUpdate: false,
          };
        }

        // If PR's updatedAt in data file matches GitHub updatedAt, data is fresh
        // This means PR was just fetched, so we should create cache but not show update button
        // Compare timestamps more precisely (within same day or very close)
        const prUpdatedAtTime = pr.updatedAt
          ? new Date(pr.updatedAt).getTime()
          : null;
        const githubUpdatedAtTime = githubUpdatedAt
          ? new Date(githubUpdatedAt).getTime()
          : null;

        // If timestamps are very close (within 1 hour), data is fresh (just fetched)
        // This handles cases where PR was just fetched but workflow cache wasn't created
        if (
          prUpdatedAtTime &&
          githubUpdatedAtTime &&
          Math.abs(prUpdatedAtTime - githubUpdatedAtTime) < 3600000
        ) {
          // Data is fresh, don't show update button
          return {
            ...pr,
            needsTimelineUpdate: false,
          };
        }

        // Also check if dates match (same day)
        const prUpdatedAtDate = pr.updatedAt
          ? new Date(pr.updatedAt).toISOString().split('T')[0]
          : null;
        const githubUpdatedAtDate = githubUpdatedAt
          ? new Date(githubUpdatedAt).toISOString().split('T')[0]
          : null;

        // If dates match, data is fresh (just fetched), don't show update button
        if (
          prUpdatedAtDate &&
          githubUpdatedAtDate &&
          prUpdatedAtDate === githubUpdatedAtDate
        ) {
          return {
            ...pr,
            needsTimelineUpdate: false,
          };
        }

        // Otherwise, needs update (cache doesn't exist and data might be stale)
        return {
          ...pr,
          needsTimelineUpdate: true,
        };
      }

      // If timeline data changed (hash mismatch), needs update
      if (timelineDataChanged) {
        return {
          ...pr,
          needsTimelineUpdate: true,
        };
      }

      // If GitHub API call failed (empty string), don't show update button
      // to avoid false positives
      if (!githubUpdatedAt) {
        return {
          ...pr,
          needsTimelineUpdate: false,
        };
      }

      // If GitHub updatedAt differs from cached prUpdatedAt, needs update
      const needsUpdate = githubUpdatedAt !== cachedPrUpdatedAt;

      return {
        ...pr,
        needsTimelineUpdate: needsUpdate,
      };
    });

    // Check if there are any PRs that need timeline update (independent check, only meaningful when hasData is true)
    const hasTimelineUpdate = hasData
      ? dataWithTimelineCheck.some((pr) => pr.needsTimelineUpdate === true)
      : false;

    return {
      data: dataWithTimelineCheck,
      selectedDate,
      availableDates,
      hasData,
      hasTimelineUpdate,
    };
  }

  @Post('get-data')
  async getData(@Body() body: GetDataDto, @Res() res: Response) {
    try {
      const prIdsString = body.prIds || '';
      const prNumbers = prIdsString
        .split(',')
        .map((id) => Number.parseInt(id.trim(), 10))
        .filter((id) => !Number.isNaN(id) && id > 0);

      if (prNumbers.length === 0) {
        return res.redirect('/dashboard?error=invalid-ids');
      }

      const metrics = await this.prService.calculateMetrics(prNumbers);
      this.storageService.saveTodayData(metrics, true);

      // Also build and cache timeline for each PR to avoid false "needs update" status
      // This ensures that after redirect, dashboard won't show update button unnecessarily
      for (const prNumber of prNumbers) {
        try {
          const [prDetails, events, baseCommits] = await Promise.all([
            this.githubService.getPullRequestDetails(prNumber),
            this.githubService.getPullRequestEvents(prNumber),
            this.githubService.getBaseBranchCommits(prNumber),
          ]);

          const timeline = this.timelineService.buildTimeline(
            prDetails,
            events,
            baseCommits,
          );

          // Save timeline to workflow storage with prUpdatedAt
          const prUpdatedAt =
            prDetails.updated_at || prDetails.created_at || '';
          this.workflowStorageService.saveWorkflow(prNumber, {
            timeline: timeline.timeline,
            prUpdatedAt,
          });
        } catch (prError) {
          // Log error but continue with other PRs
          console.error(`Error building timeline for PR ${prNumber}:`, prError);
        }
      }

      return res.redirect('/dashboard');
    } catch (error) {
      console.error('Error processing PR data:', error);
      return res.redirect('/dashboard?error=processing-failed');
    }
  }

  @Post('raw-data')
  async rawData(@Body() body: { findyUrl?: string }, @Res() res: Response) {
    try {
      const findyUrl = body.findyUrl?.trim();

      if (!findyUrl) {
        return res.redirect('/dashboard?error=url-required');
      }

      // Validate URL
      if (!this.findyScraperService.validateFindyUrl(findyUrl)) {
        return res.redirect(
          '/dashboard?error=invalid-url&message=URL must match pattern: https://findy-team.io/team/analytics/cycletime?monitoring_id=<number>&range=<string>',
        );
      }

      // Show loading message
      // In a real app, you might want to use WebSocket or polling for progress updates

      // Scrape data from Findy Team
      const scrapeResult =
        await this.findyScraperService.scrapeFindyTeam(findyUrl);

      if (!scrapeResult.success) {
        return res.redirect(
          `/dashboard?error=scrape-failed&message=${encodeURIComponent(
            scrapeResult.error || 'Unknown error',
          )}`,
        );
      }

      // Extract PR numbers from scraped data
      const prNumbers = scrapeResult.prNumbers || [];

      if (prNumbers.length === 0) {
        return res.redirect(
          '/dashboard?error=no-pr-numbers&message=No PR numbers found in scraped data',
        );
      }

      // Calculate metrics for PRs
      const metrics = await this.prService.calculateMetrics(prNumbers);
      this.storageService.saveTodayData(metrics, true);

      // Build and cache timeline for each PR
      for (const prNumber of prNumbers) {
        try {
          const [prDetails, events, baseCommits] = await Promise.all([
            this.githubService.getPullRequestDetails(prNumber),
            this.githubService.getPullRequestEvents(prNumber),
            this.githubService.getBaseBranchCommits(prNumber),
          ]);

          const timeline = this.timelineService.buildTimeline(
            prDetails,
            events,
            baseCommits,
          );

          const prUpdatedAt =
            prDetails.updated_at || prDetails.created_at || '';
          this.workflowStorageService.saveWorkflow(prNumber, {
            timeline: timeline.timeline,
            prUpdatedAt,
          });
        } catch (prError) {
          console.error(`Error building timeline for PR ${prNumber}:`, prError);
        }
      }

      return res.redirect(
        `/dashboard?success=raw-data&count=${prNumbers.length}`,
      );
    } catch (error) {
      console.error('Error processing raw data:', error);
      return res.redirect(
        `/dashboard?error=raw-data-failed&message=${encodeURIComponent(
          error instanceof Error ? error.message : 'Unknown error',
        )}`,
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

      // Try to load timeline from workflow cache first (fast path)
      const cachedWorkflow = this.workflowStorageService.loadWorkflow(prNum);
      let timeline: TimelineResult;
      let events: unknown[];
      let prDetails: Awaited<
        ReturnType<typeof this.githubService.getPullRequestDetails>
      >;
      let prUpdatedAt: string;

      // Check if we have cached workflow with timeline (even if empty array)
      if (
        cachedWorkflow?.workflow &&
        Array.isArray(cachedWorkflow.workflow.timeline)
      ) {
        // Use cached timeline immediately (fast path - return cache first)
        timeline = { timeline: cachedWorkflow.workflow.timeline };
        prUpdatedAt = cachedWorkflow.workflow.prUpdatedAt || '';

        // Fetch PR details and events in parallel for metrics and validation
        // But return timeline immediately, validation can be done async
        try {
          const [fetchedPrDetails, fetchedEvents] = await Promise.all([
            this.githubService.getPullRequestDetails(prNum),
            this.githubService.getPullRequestEvents(prNum),
          ]);

          prDetails = fetchedPrDetails;
          events = fetchedEvents;
        } catch (fetchError) {
          console.error(
            `Error fetching PR ${prNum} data from GitHub (with cache):`,
            fetchError,
          );
          // If fetch fails but we have cache, still return cached timeline
          // but validation will be skipped
          prDetails = null as unknown as typeof prDetails;
          events = [];
        }

        // Check if PR was updated since cache was created
        // Only check if prDetails is available (fetch succeeded)
        if (prDetails) {
          const currentPrUpdatedAt =
            prDetails.updated_at || prDetails.created_at || '';
          if (currentPrUpdatedAt !== prUpdatedAt) {
            // PR was updated, rebuild timeline
            const baseCommits =
              await this.githubService.getBaseBranchCommits(prNum);

            timeline = this.timelineService.buildTimeline(
              prDetails,
              events,
              baseCommits,
            );

            // Save updated timeline to workflow cache
            this.workflowStorageService.saveWorkflow(prNum, {
              timeline: timeline.timeline,
              prUpdatedAt: currentPrUpdatedAt,
            });
            prUpdatedAt = currentPrUpdatedAt;
          }
        }
      } else {
        // No cache, fetch everything from GitHub
        try {
          const [fetchedPrDetails, fetchedEvents, baseCommits] =
            await Promise.all([
              this.githubService.getPullRequestDetails(prNum),
              this.githubService.getPullRequestEvents(prNum),
              this.githubService.getBaseBranchCommits(prNum),
            ]);

          prDetails = fetchedPrDetails;
          events = fetchedEvents;
          prUpdatedAt = prDetails.updated_at || prDetails.created_at || '';

          if (!prDetails) {
            throw new Error('Failed to fetch PR details from GitHub');
          }

          timeline = this.timelineService.buildTimeline(
            prDetails,
            events,
            baseCommits,
          );

          // Save timeline to workflow cache
          this.workflowStorageService.saveWorkflow(prNum, {
            timeline: timeline.timeline,
            prUpdatedAt,
          });

          // Also update updatedAt in PrMetrics to keep them in sync
          // This ensures that after creating cache, button update won't show unnecessarily
          const todayData = this.storageService.loadTodayData();
          if (todayData?.prs) {
            const prIndex = todayData.prs.findIndex(
              (pr) => pr?.prNumber === prNum,
            );
            if (prIndex !== -1 && todayData.prs[prIndex]) {
              todayData.prs[prIndex].updatedAt =
                prDetails.updated_at || prDetails.created_at || '';
              this.storageService.saveTodayData(todayData.prs, true);
            }
          }
        } catch (fetchError) {
          console.error(
            `Error fetching PR ${prNum} data from GitHub:`,
            fetchError,
          );
          throw new Error(
            `Failed to fetch PR data from GitHub: ${
              fetchError instanceof Error ? fetchError.message : 'Unknown error'
            }`,
          );
        }
      }

      // Calculate metrics for workflow
      // If PR is Draft, return 0 for all metrics
      // Check if prDetails is available (might be null if fetch failed with cache)
      if (!prDetails) {
        // Return cached timeline without validation if fetch failed
        return {
          ...timeline,
          validationIssues: [],
        };
      }

      const status = this.prService.getPrStatus(prDetails);

      // Check if PR has "exclude in FindyTeam" label
      const hasExcludeLabel =
        prDetails.labels?.some(
          (label) => label.name === 'exclude in FindyTeam',
        ) || false;

      // Check if PR has force-pushed events
      const allEvents = (events || []) as GitHubEvent[];
      const hasForcePushed = allEvents.some(
        (event) => event.event === 'head_ref_force_pushed',
      );

      // Update hasForcePushed and labels in PrMetrics (data-{date}.json)
      // Only update if not already updated above (when creating cache)
      const todayData = this.storageService.loadTodayData();
      if (todayData?.prs) {
        const prIndex = todayData.prs.findIndex((pr) => pr?.prNumber === prNum);
        if (prIndex !== -1 && todayData.prs[prIndex]) {
          // Only update if not already updated (when creating cache from no cache)
          if (cachedWorkflow?.workflow) {
            // Cache existed, update hasForcePushed and labels
            todayData.prs[prIndex].hasForcePushed = hasForcePushed;

            // Update labels from GitHub PR details
            if (prDetails.labels) {
              todayData.prs[prIndex].labels = prDetails.labels.map((label) => ({
                name: label.name,
                color: label.color,
              }));
            }

            this.storageService.saveTodayData(todayData.prs, true);
          }
          // If cache didn't exist, we already updated updatedAt above
        }
      }

      // Timeline is already saved above, no need to save workflow data separately
      // Workflow now only contains timeline, all other data is in PrMetrics

      // Validate workflow only if not excluded
      // Timeline is loaded from workflow storage
      let validationIssues: ValidationIssue[] = [];
      if (hasExcludeLabel || status === 'Draft') {
        validationIssues = [];
      } else {
        const timelineItems = timeline.timeline || [];

        // Create workflow data for validation (only needs status)
        const workflowDataForValidation = {
          prNumber: prNum,
          status,
          createdAt: prDetails.created_at,
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

      const workflowStorage = this.workflowStorageService.loadWorkflow(prNum);
      if (!workflowStorage) {
        return { error: 'Workflow not found for this PR' };
      }

      // Load timeline from workflow storage
      const timelineItems = workflowStorage.workflow.timeline || [];

      // Get PR details for status and createdAt
      const prDetails = await this.githubService.getPullRequestDetails(prNum);
      const status = this.prService.getPrStatus(prDetails);

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
      const workflows = this.workflowStorageService.listAllWorkflows();
      const results = await Promise.all(
        workflows.map(async (storage) => {
          // Load timeline from workflow storage
          const timelineItems = storage.workflow.timeline || [];

          // Get PR details for status and createdAt
          const prDetails = await this.githubService.getPullRequestDetails(
            storage.prNumber,
          );
          const status = this.prService.getPrStatus(prDetails);

          const workflowDataForValidation = {
            status,
            createdAt: prDetails.created_at || '',
          };

          const validationIssues =
            this.workflowValidationService.validateWorkflow(
              workflowDataForValidation,
              timelineItems,
            );

          // Get PR data from storage for title, author, url
          const todayData = this.storageService.loadTodayData();
          const prData = todayData?.prs?.find(
            (pr) => pr?.prNumber === storage.prNumber,
          );

          return {
            prNumber: storage.prNumber,
            title: prData?.title || `PR #${storage.prNumber}`,
            author: prData?.author || 'Unknown',
            url: prData?.url || '',
            status: prData?.status || status,
            validationIssues,
            hasIssues: validationIssues.length > 0,
            errorCount: validationIssues.filter((i) => i.severity === 'error')
              .length,
            warningCount: validationIssues.filter(
              (i) => i.severity === 'warning',
            ).length,
          };
        }),
      );

      return {
        total: results.length,
        withIssues: results.filter((r) => r.hasIssues).length,
        results,
      };
    } catch (error) {
      console.error('Error fetching all validation issues:', error);
      return { error: 'Failed to fetch validation issues' };
    }
  }

  @Post('timeline/:prNumber/update')
  async updateTimeline(
    @Param('prNumber') prNumber: string,
    @Res() res: Response,
  ) {
    try {
      const prNum = Number.parseInt(prNumber, 10);
      if (Number.isNaN(prNum)) {
        return res.status(400).json({ error: 'Invalid PR number' });
      }

      // Force fetch fresh data from GitHub API
      const [prDetails, events, baseCommits] = await Promise.all([
        this.githubService.getPullRequestDetails(prNum),
        this.githubService.getPullRequestEvents(prNum),
        this.githubService.getBaseBranchCommits(prNum),
      ]);

      const prUpdatedAt = prDetails.updated_at || prDetails.created_at || '';

      // 1. Rebuild timeline with fresh data
      const timeline = this.timelineService.buildTimeline(
        prDetails,
        events,
        baseCommits,
      );

      // 2. Calculate workflow metrics
      const status = this.prService.getPrStatus(prDetails);
      const commitToOpen =
        status === 'Draft'
          ? 0
          : this.prService.calculateCommitToOpen(prDetails, events);
      const openToReview =
        status === 'Draft'
          ? 0
          : this.prService.calculateOpenToReview(prDetails, events);
      const reviewToApproval =
        status === 'Draft'
          ? 0
          : this.prService.calculateReviewToApproval(prDetails);
      const approvalToMerge =
        status === 'Draft'
          ? 0
          : this.prService.calculateApprovalToMerge(prDetails);

      // 3. Check if PR has "exclude in FindyTeam" label
      const hasExcludeLabel =
        prDetails.labels?.some(
          (label) => label.name === 'exclude in FindyTeam',
        ) || false;

      // 4. Check if PR has force-pushed events
      const allEvents = (events || []) as GitHubEvent[];
      const hasForcePushed = allEvents.some(
        (event) => event.event === 'head_ref_force_pushed',
      );

      // 5. Save timeline to workflow storage (update workflow)
      this.workflowStorageService.saveWorkflow(prNum, {
        timeline: timeline.timeline,
        prUpdatedAt,
      });

      // 6. Run validation (check validate)
      const timelineItems = timeline.timeline || [];
      let validationIssues: ValidationIssue[] = [];
      if (!hasExcludeLabel && status !== 'Draft' && timelineItems.length > 0) {
        const workflowDataForValidation = {
          status,
          createdAt: prDetails.created_at || '',
        };
        validationIssues = this.workflowValidationService.validateWorkflow(
          workflowDataForValidation,
          timelineItems,
        );
      }

      // 7. Update PrMetrics in storage (update metrics, hasForcePushed, and labels)
      const todayData = this.storageService.loadTodayData();
      if (todayData?.prs) {
        const prIndex = todayData.prs.findIndex((pr) => pr?.prNumber === prNum);
        if (prIndex !== -1 && todayData.prs[prIndex]) {
          todayData.prs[prIndex].updatedAt = prUpdatedAt;
          todayData.prs[prIndex].hasForcePushed = hasForcePushed;
          todayData.prs[prIndex].commitToOpen = commitToOpen;
          todayData.prs[prIndex].openToReview = openToReview;
          todayData.prs[prIndex].reviewToApproval = reviewToApproval;
          todayData.prs[prIndex].approvalToMerge = approvalToMerge;

          // Update labels from GitHub PR details
          if (prDetails.labels) {
            todayData.prs[prIndex].labels = prDetails.labels.map((label) => ({
              name: label.name,
              color: label.color,
            }));
          }

          this.storageService.saveTodayData(todayData.prs, true);
        }
      }

      // 8. Check if PR still needs update (compare with GitHub)
      // After update, we just saved the timeline with prUpdatedAt
      // So cachedPrUpdatedAt should now equal prUpdatedAt
      // We check again with GitHub to see if there are any new changes
      const githubUpdatedAt =
        await this.githubService.getPullRequestUpdatedAt(prNum);

      // After saving, timeline data should not be changed (we just saved it)
      // So we only check if GitHub has newer updates
      // needsTimelineUpdate = true if GitHub has newer data than what we just saved
      const needsTimelineUpdate =
        githubUpdatedAt && githubUpdatedAt !== prUpdatedAt;

      return res.json({
        success: true,
        message: 'Timeline, workflow, and validation updated successfully',
        prNumber: prNum,
        needsTimelineUpdate,
        validationIssuesCount: validationIssues.length,
      });
    } catch (error) {
      console.error('Error updating timeline:', error);
      return res.status(500).json({ error: 'Failed to update timeline' });
    }
  }

  @Delete('pr/:prNumber')
  deletePr(
    @Param('prNumber') prNumber: string,
    @Query('date') date: string | undefined,
    @Res() res: Response,
  ): void {
    try {
      const prNum = Number.parseInt(prNumber, 10);
      if (Number.isNaN(prNum)) {
        res.status(400).json({ error: 'Invalid PR number' });
        return;
      }

      // Use provided date or default to today
      const targetDate = date || new Date().toISOString().split('T')[0];
      const deleted = this.storageService.deletePrFromDate(prNum, targetDate);
      if (!deleted) {
        res.status(404).json({
          error: `PR not found in data for date ${targetDate}`,
        });
        return;
      }

      // Also delete workflow cache if exists
      const workflowFile = this.workflowStorageService.loadWorkflow(prNum);
      if (workflowFile) {
        const workflowFilePath = join(
          process.cwd(),
          'data',
          'workflows',
          `workflow-${prNum}.json`,
        );
        if (existsSync(workflowFilePath)) {
          unlinkSync(workflowFilePath);
        }
      }

      res.json({
        success: true,
        message: `PR #${prNum} deleted successfully`,
      });
    } catch (error) {
      console.error('Error deleting PR:', error);
      res.status(500).json({
        error: 'Failed to delete PR',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
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
