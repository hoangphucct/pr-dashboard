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
import { PrService } from '../pr/pr.service';
import { StorageService } from '../storage/storage.service';
import { GitHubService } from '../github/github.service';
import { WorkflowStorageService } from '../workflow/workflow-storage.service';
import {
  WorkflowValidationService,
  type ValidationIssue,
} from '../workflow/workflow-validation.service';
import { TimelineService } from '../timeline/timeline.service';
import { PrDataHelper } from './pr-data.helper';
import type { GetDataDto } from '../types/dashboard.types';
import type { TimelineResult } from '../types/timeline.types';

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
  showDashboard(@Query('date') date?: string) {
    const selectedDate = date || new Date().toISOString().split('T')[0];
    const data = this.storageService.loadDataByDate(selectedDate);
    const availableDates = this.storageService.listAvailableDates();

    const prsArray = data?.prs || [];
    const cleanData = PrDataHelper.processPrDataForDashboard(prsArray);

    return {
      data: cleanData,
      selectedDate,
      availableDates,
      hasData: cleanData.length > 0,
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

      const [prDetails, events, baseCommits] = await Promise.all([
        this.githubService.getPullRequestDetails(prNum),
        this.githubService.getPullRequestEvents(prNum),
        this.githubService.getBaseBranchCommits(prNum),
      ]);

      const timeline = this.timelineService.buildTimeline(
        prDetails,
        events,
        baseCommits,
      );

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

      // Save workflow to JSON
      const workflowData = {
        prNumber: prNum,
        title: prDetails.title || `PR #${prNum}`,
        author: prDetails.user?.login || 'Unknown',
        url: prDetails.html_url || '',
        status,
        changedFiles: prDetails.changed_files,
        additions: prDetails.additions,
        deletions: prDetails.deletions,
        timeline: timeline.timeline || [],
        commitToOpen,
        openToReview,
        reviewToApproval,
        approvalToMerge,
        createdAt: prDetails.created_at,
        updatedAt: new Date().toISOString(),
      };

      this.workflowStorageService.saveWorkflow(workflowData);

      // Validate workflow only if not excluded
      let validationIssues: ValidationIssue[] = [];
      if (hasExcludeLabel || status === 'Draft') {
        validationIssues = [];
      } else {
        validationIssues =
          this.workflowValidationService.validateWorkflow(workflowData);
      }

      return {
        ...timeline,
        validationIssues,
      };
    } catch (error) {
      console.error('Error fetching timeline:', error);
      return { error: 'Failed to fetch timeline' };
    }
  }

  @Get('validation/:prNumber')
  getValidationIssues(@Param('prNumber') prNumber: string) {
    try {
      const prNum = Number.parseInt(prNumber, 10);
      if (Number.isNaN(prNum)) {
        return { error: 'Invalid PR number' };
      }

      const workflowStorage = this.workflowStorageService.loadWorkflow(prNum);
      if (!workflowStorage) {
        return { error: 'Workflow not found for this PR' };
      }

      const validationIssues = this.workflowValidationService.validateWorkflow(
        workflowStorage.workflow,
      );

      return {
        prNumber: prNum,
        workflow: workflowStorage.workflow,
        validationIssues,
      };
    } catch (error) {
      console.error('Error fetching validation issues:', error);
      return { error: 'Failed to fetch validation issues' };
    }
  }

  @Get('validation')
  getAllValidationIssues() {
    try {
      const workflows = this.workflowStorageService.listAllWorkflows();
      const results = workflows.map((storage) => {
        const validationIssues =
          this.workflowValidationService.validateWorkflow(storage.workflow);
        return {
          prNumber: storage.prNumber,
          title: storage.workflow.title,
          author: storage.workflow.author,
          url: storage.workflow.url,
          status: storage.workflow.status,
          validationIssues,
          hasIssues: validationIssues.length > 0,
          errorCount: validationIssues.filter((i) => i.severity === 'error')
            .length,
          warningCount: validationIssues.filter((i) => i.severity === 'warning')
            .length,
        };
      });

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
}
