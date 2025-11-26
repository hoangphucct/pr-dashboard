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

interface GetDataDto {
  prIds: string;
}

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly prService: PrService,
    private readonly storageService: StorageService,
    private readonly githubService: GitHubService,
  ) {}

  @Get()
  @Render('dashboard')
  showDashboard(@Query('date') date?: string) {
    const selectedDate = date || new Date().toISOString().split('T')[0];
    const data = this.storageService.loadDataByDate(selectedDate);
    const availableDates = this.storageService.listAvailableDates();

    return {
      data: data?.prs || [],
      selectedDate,
      availableDates,
      hasData: !!data,
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
      this.storageService.saveTodayData(metrics);

      return res.redirect('/dashboard');
    } catch (error) {
      console.error('Error processing PR data:', error);
      return res.redirect('/dashboard?error=processing-failed');
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
      console.log(prDetails);
      console.log(events);
      console.log(baseCommits);
      const timeline = this.buildTimeline(prDetails, events, baseCommits);
      return timeline;
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
    const timelineItems: Array<{
      type: string;
      title: string;
      time: string;
      actor?: string;
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

        const firstCommit =
          nonMergeCommits.length > 0
            ? nonMergeCommits[0]
            : sortedUniqueCommits[0];

        const commitMessage = firstCommit.commit.message
          .split('\n')[0]
          .trim()
          .substring(0, 100);
        timelineItems.push({
          type: 'commit',
          title: commitMessage || 'Commit đầu tiên',
          time: firstCommit.commit.author.date,
        });
      }
    } else if (prDetails.commits && prDetails.commits.length > 0) {
      // Fallback: use time-based filtering if compare API fails
      const prCreatedAt = new Date(prDetails.created_at).getTime();
      const sortedCommits = [...prDetails.commits].sort(
        (a: any, b: any) =>
          new Date(a.commit.author.date).getTime() -
          new Date(b.commit.author.date).getTime(),
      );

      const validCommits = sortedCommits.filter((commit: any) => {
        const commitDate = new Date(commit.commit.author.date).getTime();
        const message = commit.commit.message.toLowerCase();
        const isMergeCommit =
          message.startsWith('merge pull request') ||
          message.startsWith('merge branch') ||
          message.startsWith('merge ') ||
          (commit.parents && commit.parents.length > 1);

        const timeDiff = prCreatedAt - commitDate;
        const isAfterPrCreation = timeDiff <= 60 * 60 * 1000;

        return !isMergeCommit && isAfterPrCreation;
      });

      const firstCommit =
        validCommits.length > 0 ? validCommits[0] : sortedCommits[0];

      const commitMessage = firstCommit.commit.message
        .split('\n')[0]
        .trim()
        .substring(0, 100);
      timelineItems.push({
        type: 'commit',
        title: commitMessage || 'Commit đầu tiên',
        time: firstCommit.commit.author.date,
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
      });
    }

    // Get first comment
    const allComments = [
      ...(prDetails.comments || []),
      ...(prDetails.review_comments || []),
    ];
    if (allComments.length > 0) {
      const firstComment = [...allComments].sort(
        (a: any, b: any) =>
          new Date(a.created_at || a.submitted_at).getTime() -
          new Date(b.created_at || b.submitted_at).getTime(),
      )[0];
      timelineItems.push({
        type: 'comment',
        title: 'Comment đầu tiên',
        time: firstComment.created_at || firstComment.submitted_at,
        actor: firstComment.user?.login,
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
      });
    });

    // Get reviews
    const reviews = (prDetails.reviews || []).sort(
      (a: any, b: any) =>
        new Date(a.submitted_at).getTime() -
        new Date(b.submitted_at).getTime(),
    );
    let hasFirstApproval = false;
    reviews.forEach((review: any) => {
      if (review.state === 'APPROVED') {
        const isFirstApproval = !hasFirstApproval;
        hasFirstApproval = true;
        const isCopilot =
          review.user?.login === 'github-actions[bot]' ||
          review.user?.login?.includes('copilot');
        
        let approvalTitle: string;
        if (isFirstApproval) {
          approvalTitle = 'Approved đầu tiên';
        } else if (isCopilot) {
          approvalTitle = 'Copilot AI reviewed';
        } else {
          approvalTitle = 'Approved';
        }
        
        timelineItems.push({
          type: 'approved',
          title: approvalTitle,
          time: review.submitted_at,
          actor: review.user?.login,
        });
      } else if (review.state === 'COMMENTED') {
        const isCopilot =
          review.user?.login === 'github-actions[bot]' ||
          review.user?.login?.includes('copilot');
        timelineItems.push({
          type: 'review_comment',
          title: isCopilot ? 'Copilot AI reviewed' : 'Review comment',
          time: review.submitted_at,
          actor: review.user?.login,
        });
      }
    });

    // Sort all timeline items by time
    timelineItems.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );

    return { timeline: timelineItems };
  }
}