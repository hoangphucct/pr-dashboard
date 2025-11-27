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
import { WorkflowValidationService } from '../workflow/workflow-validation.service';

interface GetDataDto {
  prIds: string;
}

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly prService: PrService,
    private readonly storageService: StorageService,
    private readonly githubService: GitHubService,
    private readonly workflowStorageService: WorkflowStorageService,
    private readonly workflowValidationService: WorkflowValidationService,
  ) {}

  @Get()
  @Render('dashboard')
  showDashboard(@Query('date') date?: string) {
    const selectedDate = date || new Date().toISOString().split('T')[0];
    const data = this.storageService.loadDataByDate(selectedDate);
    const availableDates = this.storageService.listAvailableDates();

    // Filter out null/undefined values and ensure valid PR data
    // Use strict filtering to remove all null, undefined, and invalid entries
    const prsArray = data?.prs || [];
    const validPrs = prsArray
      .filter((pr) => {
        // Strict check: must be an object with prNumber property
        return (
          pr !== null &&
          pr !== undefined &&
          typeof pr === 'object' &&
          'prNumber' in pr &&
          pr.prNumber != null &&
          typeof pr.prNumber === 'number'
        );
      })
      .map((pr) => {
        // Ensure all required fields exist with defaults
        return {
          prNumber: pr.prNumber,
          title: pr.title || `PR #${pr.prNumber}`,
          author: pr.author || 'Unknown',
          url: pr.url || '',
          status: pr.status || 'Unknown',
          commitToOpen: pr.commitToOpen ?? 0,
          openToReview: pr.openToReview ?? 0,
          reviewToApproval: pr.reviewToApproval ?? 0,
          approvalToMerge: pr.approvalToMerge ?? 0,
          createdAt: pr.createdAt || new Date().toISOString(),
          updatedAt: pr.updatedAt || new Date().toISOString(),
        };
      });

    // Final safety check: remove any remaining null/undefined values
    const finalValidPrs = validPrs.filter(
      (pr) => pr != null && pr.prNumber != null,
    );

    // Debug: Check if finalValidPrs contains any null
    const hasNull = finalValidPrs.some((pr) => pr === null || pr === undefined);
    if (hasNull) {
      console.error('WARNING: finalValidPrs contains null/undefined values!');
      console.error('finalValidPrs:', finalValidPrs);
    }

    // Final check: ensure no null values
    const cleanData = finalValidPrs.filter((pr) => pr != null);
    
    console.log('=== Dashboard Controller Return ===');
    console.log('cleanData type:', Array.isArray(cleanData) ? 'array' : typeof cleanData);
    console.log('cleanData length:', cleanData.length);
    console.log('cleanData sample:', cleanData[0]);
    console.log('cleanData contains null:', cleanData.some((pr) => pr === null || pr === undefined));
    
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
  async getTimeline(@Param('prNumber') prNumber: string) {
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

      const timeline = this.buildTimeline(prDetails, events, baseCommits);

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
          : this.prService.calculateOpenToReview(prDetails);
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
      let validationIssues: any[] = [];
      if (hasExcludeLabel) {
        validationIssues = [];
      } else if (status === 'Draft') {
        validationIssues = [];
      } else {
        validationIssues = this.workflowValidationService.validateWorkflow(workflowData);
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

  private buildTimeline(
    prDetails: any,
    events: unknown[],
    baseCommits: string[] = [],
  ): any {
    const prUrl = prDetails.html_url || '';
    const owner = prDetails.base?.repo?.owner?.login || '';
    const repo = prDetails.base?.repo?.name || '';

    const timelineItems: Array<{
      type: string;
      title: string;
      time: string;
      actor?: string;
      url?: string;
    }> = [];

    const allEvents = (events || []) as Array<{
      event: string;
      created_at: string;
      actor?: { login: string };
      label?: { name: string };
    }>;

    // Sort events by time
    const sortedEvents = [...allEvents].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    // Get first commit unique to this PR (from base...head comparison)
    // baseCommits contains SHAs of commits unique to this PR
    if (baseCommits.length > 0 && prDetails.commits) {
      // Find commits in PR that match the unique commits
      const uniqueCommits = prDetails.commits.filter((commit: any) =>
        baseCommits.includes(commit.sha),
      );

      console.log(`PR #${prDetails.number}: Found ${uniqueCommits.length} unique commits out of ${prDetails.commits.length} total commits`);

      if (uniqueCommits.length > 0) {
        // Sort by date and filter out merge commits
        const sortedUniqueCommits = [...uniqueCommits].sort(
          (a: any, b: any) =>
            new Date(a.commit.author.date).getTime() -
            new Date(b.commit.author.date).getTime(),
        );

        // Filter out merge commits
        const nonMergeCommits = sortedUniqueCommits.filter((commit: any) => {
          const message = commit.commit.message.toLowerCase();
          return (
            !message.startsWith('merge pull request') &&
            !message.startsWith('merge branch') &&
            !message.startsWith('merge ') &&
            (!commit.parents || commit.parents.length <= 1)
          );
        });

        // Priority 1: Find commit with "Work has started on the" message
        const workStartedCommit = nonMergeCommits.find((commit: any) =>
          commit.commit.message.toLowerCase().startsWith('work has started on the'),
        );

        // Priority 2: Use first non-merge commit, or first commit if all are merge commits
        const firstCommit = workStartedCommit ||
          (nonMergeCommits.length > 0
            ? nonMergeCommits[0]
            : sortedUniqueCommits[0]);

        console.log(`PR #${prDetails.number}: First commit date: ${firstCommit.commit.author.date}, Message: ${firstCommit.commit.message.substring(0, 50)}`);
        console.log(`PR #${prDetails.number}: First commit SHA: ${firstCommit.sha}`);
        console.log(`PR #${prDetails.number}: Is "Work has started" commit: ${!!workStartedCommit}`);
        if (!workStartedCommit) {
          console.warn(`PR #${prDetails.number}: WARNING - No "Work has started on the" commit found!`);
          console.warn(`PR #${prDetails.number}: Available commits:`, nonMergeCommits.map((c: any) => ({
            sha: c.sha.substring(0, 7),
            date: c.commit.author.date,
            message: c.commit.message.substring(0, 50),
          })));
        }

        const commitMessage = firstCommit.commit.message
          .split('\n')[0]
          .trim()
          .substring(0, 100);
        const commitUrl =
          owner && repo && firstCommit.sha
            ? `https://github.com/${owner}/${repo}/commit/${firstCommit.sha}`
            : undefined;
        timelineItems.push({
          type: 'commit',
          title: commitMessage || 'First commit',
          time: firstCommit.commit.author.date,
          url: commitUrl,
        });
      }
    } else if (prDetails.commits && prDetails.commits.length > 0) {
      // Fallback: use time-based filtering if compare API fails
      console.log(`PR #${prDetails.number}: Using fallback logic (no baseCommits or compare API failed)`);
      // Get the first commit (earliest by date) that is not a merge commit
      const sortedCommits = [...prDetails.commits].sort(
        (a: any, b: any) =>
          new Date(a.commit.author.date).getTime() -
          new Date(b.commit.author.date).getTime(),
      );

      // Filter out merge commits and get the first valid commit
      const nonMergeCommits = sortedCommits.filter((commit: any) => {
        const message = commit.commit.message.toLowerCase();
        return (
          !message.startsWith('merge pull request') &&
          !message.startsWith('merge branch') &&
          !message.startsWith('merge ') &&
          (!commit.parents || commit.parents.length <= 1)
        );
      });

      // Priority 1: Find commit with "Work has started on the" message
      const workStartedCommit = nonMergeCommits.find((commit: any) =>
        commit.commit.message.toLowerCase().startsWith('work has started on the'),
      );

      // Priority 2: Use first non-merge commit, or first commit if all are merge commits
      const firstCommit = workStartedCommit ||
        (nonMergeCommits.length > 0 ? nonMergeCommits[0] : sortedCommits[0]);

      console.log(`PR #${prDetails.number}: Fallback - First commit date: ${firstCommit.commit.author.date}, Message: ${firstCommit.commit.message.substring(0, 50)}`);
      if (!workStartedCommit) {
        console.warn(`PR #${prDetails.number}: WARNING - No "Work has started on the" commit found in fallback!`);
      }

      const commitMessage = firstCommit.commit.message
        .split('\n')[0]
        .trim()
        .substring(0, 100);
      const commitUrl =
        owner && repo && firstCommit.sha
          ? `https://github.com/${owner}/${repo}/commit/${firstCommit.sha}`
          : undefined;
      timelineItems.push({
        type: 'commit',
        title: commitMessage || 'First commit',
        time: firstCommit.commit.author.date,
        url: commitUrl,
      });
    }

    // Find ready_for_review event
    const readyForReviewEvent = sortedEvents.find(
      (e) => e.event === 'ready_for_review',
    );
    if (readyForReviewEvent) {
      timelineItems.push({
        type: 'ready_for_review',
        title: 'Marked this pull request as ready for review',
        time: readyForReviewEvent.created_at,
        actor: readyForReviewEvent.actor?.login,
        url: prUrl,
      });
    }

    // Get first review comment (priority: reviews with body > issue comments containing "Everything looks good!" > other comments)
    const reviews = prDetails.reviews || [];
    const issueComments = prDetails.comments || [];

    // Collect all reviews with body (COMMENTED or APPROVED state)
    const reviewsWithBody = reviews
      .filter(
        (review: any) =>
          review.submitted_at && review.body && review.body.trim().length > 0,
      )
      .map((review: any) => ({
        ...review,
        commentType: 'review' as const,
        timestamp: new Date(review.submitted_at).getTime(),
      }));

    // Collect all issue comments
    const allIssueComments = issueComments
      .filter((comment: any) => comment.created_at && comment.body)
      .map((comment: any) => ({
        ...comment,
        commentType: 'issue' as const,
        timestamp: new Date(comment.created_at).getTime(),
      }));

    // Combine all comments and sort by timestamp
    const allComments = [...reviewsWithBody, ...allIssueComments].sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    // Find first comment - prioritize "Everything looks good!" comment
    let firstComment: any = null;
    let commentTitle = 'First comment';

    // First, try to find a comment containing "Everything looks good!"
    const everythingLooksGoodComment = allComments.find((comment: any) => {
      const body = (comment.body || '').trim().toLowerCase();
      return body.includes('everything looks good');
    });

    if (everythingLooksGoodComment) {
      firstComment = everythingLooksGoodComment;
      commentTitle = 'First Review comment';
    } else if (allComments.length > 0) {
      // If no "Everything looks good!" comment, get the first comment
      firstComment = allComments[0];
      if (firstComment.commentType === 'review') {
        commentTitle = 'First review comment';
      } else {
        commentTitle = 'First comment';
      }
    }

    if (firstComment) {
      let commentUrl: string | undefined;
      if (firstComment.commentType === 'review' && firstComment.html_url) {
        commentUrl = firstComment.html_url;
      } else if (firstComment.html_url) {
        commentUrl = firstComment.html_url;
      } else if (prUrl && firstComment.id) {
        // Fallback: construct URL from PR URL and comment ID
        commentUrl = `${prUrl}#issuecomment-${firstComment.id}`;
      }
      timelineItems.push({
        type: 'comment',
        title: commentTitle,
        time: firstComment.created_at || firstComment.submitted_at,
        actor: firstComment.user?.login,
        url: commentUrl,
      });
    }

    // Find review_requested events
    const reviewRequestedEvents = sortedEvents.filter(
      (e) => e.event === 'review_requested',
    );
    reviewRequestedEvents.forEach((event) => {
      timelineItems.push({
        type: 'review_requested',
        title: 'Requested a review',
        time: event.created_at,
        actor: event.actor?.login,
        url: prUrl,
      });
    });

    // Get reviews (sorted by submission time)
    const sortedReviews = (prDetails.reviews || []).sort(
      (a: any, b: any) =>
        new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime(),
    );
    let hasFirstApproval = false;
    sortedReviews.forEach((review: any) => {
      if (review.state === 'APPROVED') {
        const isFirstApproval = !hasFirstApproval;
        hasFirstApproval = true;
        const isCopilot =
          review.user?.login === 'github-actions[bot]' ||
          review.user?.login?.includes('copilot');

        let approvalTitle: string;
        if (isFirstApproval) {
          approvalTitle = 'First approval';
        } else if (isCopilot) {
          approvalTitle = 'Copilot AI reviewed';
        } else {
          approvalTitle = 'Approved';
        }

        const reviewUrl =
          review.html_url ||
          (prUrl ? `${prUrl}#pullrequestreview-${review.id}` : undefined);
        timelineItems.push({
          type: 'approved',
          title: approvalTitle,
          time: review.submitted_at,
          actor: review.user?.login,
          url: reviewUrl,
        });
      } else if (review.state === 'COMMENTED') {
        const isCopilot =
          review.user?.login === 'github-actions[bot]' ||
          review.user?.login?.includes('copilot');
        const reviewUrl =
          review.html_url ||
          (prUrl ? `${prUrl}#pullrequestreview-${review.id}` : undefined);
        timelineItems.push({
          type: 'review_comment',
          title: isCopilot ? 'Copilot AI reviewed' : 'Review comment',
          time: review.submitted_at,
          actor: review.user?.login,
          url: reviewUrl,
        });
      }
    });

    // Add merge event if PR is merged
    if (prDetails.merged_at) {
      const mergeCommitSha = prDetails.merge_commit_sha;
      let mergeUrl: string | undefined;
      if (mergeCommitSha && owner && repo) {
        mergeUrl = `https://github.com/${owner}/${repo}/commit/${mergeCommitSha}`;
      } else if (prUrl) {
        mergeUrl = prUrl;
      }
      timelineItems.push({
        type: 'merged',
        title: 'Merged',
        time: prDetails.merged_at,
        actor: prDetails.merged_by?.login,
        url: mergeUrl,
      });
    }

    // Sort all timeline items by time
    timelineItems.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );

    return { timeline: timelineItems };
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
  async getAllValidationIssues() {
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
