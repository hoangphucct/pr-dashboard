import {
  Controller,
  Get,
  Post,
  Body,
  Render,
  Query,
  Res,
  Param,
} from '@nestjs/common';
import type { Response } from 'express';
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
    const dataWithTimelineCheck = prsWithForcePushCheck.map(
      (pr, index) => {
        const { cachedPrUpdatedAt, timelineDataChanged } = prsWithCache[index];
        const githubUpdatedAt = githubUpdatedAts[index];

        // If no cache exists, needs update
        if (!cachedPrUpdatedAt) {
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
      },
    );

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

      return res.redirect('/dashboard');
    } catch (error) {
      console.error('Error processing PR data:', error);
      return res.redirect('/dashboard?error=processing-failed');
    }
  }

  @Post('update-all-today')
  async updateAllToday(@Res() res: Response) {
    try {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];

      // Get all PRs created today from GitHub
      const todayPRs = await this.githubService.getPullRequestsByDate(today);

      if (todayPRs.length === 0) {
        return res.redirect('/dashboard?message=no-prs-today');
      }

      // Get existing data to check which PRs are already in the system
      const existingData = this.storageService.loadTodayData();
      const existingPrNumbers = new Set<number>();
      if (existingData?.prs && Array.isArray(existingData.prs)) {
        existingData.prs
          .filter(
            (pr) =>
              pr != null &&
              typeof pr === 'object' &&
              'prNumber' in pr &&
              pr.prNumber != null &&
              typeof pr.prNumber === 'number',
          )
          .forEach((pr) => {
            existingPrNumbers.add(pr.prNumber);
          });
      }

      // Filter out PRs that already exist in the data
      const newPRs = todayPRs.filter((pr) => !existingPrNumbers.has(pr.number));

      if (newPRs.length === 0) {
        return res.redirect('/dashboard?message=all-prs-already-exist');
      }

      // Calculate metrics for new PRs only
      const prNumbers = newPRs.map((pr) => pr.number);
      const metrics = await this.prService.calculateMetrics(prNumbers);

      // Save new PRs (without force update to preserve existing PRs)
      this.storageService.saveTodayData(metrics, false);

      return res.redirect(
        `/dashboard?updated=true&count=${newPRs.length}&total=${todayPRs.length}`,
      );
    } catch (error) {
      console.error('Error updating all PRs for today:', error);
      return res.redirect('/dashboard?error=update-failed');
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
        const [fetchedPrDetails, fetchedEvents] = await Promise.all([
          this.githubService.getPullRequestDetails(prNum),
          this.githubService.getPullRequestEvents(prNum),
        ]);

        prDetails = fetchedPrDetails;
        events = fetchedEvents;

        // Check if PR was updated since cache was created
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
      const todayData = this.storageService.loadTodayData();
      if (todayData?.prs) {
        const prIndex = todayData.prs.findIndex((pr) => pr?.prNumber === prNum);
        if (prIndex !== -1 && todayData.prs[prIndex]) {
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
          validationIssues =
            this.workflowValidationService.validateWorkflow(
              workflowDataForValidation,
              timelineItems,
            );
        } else {
          // If no timeline items, log warning
          console.warn(
            `[PR ${prNum}] No timeline items found for validation`,
          );
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
          const prDetails =
            await this.githubService.getPullRequestDetails(storage.prNumber);
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
        validationIssues =
          this.workflowValidationService.validateWorkflow(
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
      const cachedPrUpdatedAt =
        this.workflowStorageService.getCachedPrUpdatedAt(prNum);
      
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
}
