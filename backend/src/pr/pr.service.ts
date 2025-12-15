import { Injectable } from '@nestjs/common';
import { GitHubService } from '@github/github.service';
import { CommitService } from '@commit/commit.service';
import { BusinessDaysService } from '@utils/business-days.service';
import type { PrMetrics } from '@shared/storage.types';
import type {
  GitHubPullRequestDetail,
  GitHubEvent,
} from '@shared/github.types';

@Injectable()
export class PrService {
  constructor(
    private readonly githubService: GitHubService,
    private readonly commitService: CommitService,
    private readonly businessDaysService: BusinessDaysService,
  ) {}

  /**
   * Calculate cycle time metrics for multiple PRs
   */
  async calculateMetrics(prNumbers: number[]): Promise<PrMetrics[]> {
    const results: PrMetrics[] = [];

    for (const prNumber of prNumbers) {
      try {
        const metrics = await this.calculateSinglePrMetrics(prNumber);
        results.push(metrics);
      } catch (error) {
        console.error(`Error calculating metrics for PR ${prNumber}:`, error);
      }
    }

    return results;
  }

  /**
   * Calculate metrics for a single PR
   */
  private async calculateSinglePrMetrics(prNumber: number): Promise<PrMetrics> {
    const prDetails = await this.githubService.getPullRequestDetails(prNumber);
    const events =
      (prDetails as GitHubPullRequestDetail & { _events?: unknown[] })
        ._events || [];
    const status = this.getPrStatus(prDetails);
    const allEvents = (events || []) as GitHubEvent[];
    const hasForcePushed = allEvents.some(
      (event) => event.event === 'head_ref_force_pushed',
    );
    // Check if PR was created as Draft (has ready_for_review event means it was Draft before)
    const wasCreatedAsDraft = allEvents.some(
      (event) => event.event === 'ready_for_review',
    );
    const baseMetrics = this.buildBaseMetrics(
      prDetails,
      prNumber,
      status,
      hasForcePushed,
      wasCreatedAsDraft,
    );
    if (status === 'Draft') {
      return {
        ...baseMetrics,
        commitToOpen: 0,
        openToReview: 0,
        reviewToApproval: 0,
        approvalToMerge: 0,
      };
    }
    return {
      ...baseMetrics,
      commitToOpen: this.calculateCommitToOpen(prDetails, events),
      openToReview: this.calculateOpenToReview(prDetails, events),
      reviewToApproval: this.calculateReviewToApproval(prDetails),
      approvalToMerge: this.calculateApprovalToMerge(prDetails),
    };
  }

  /**
   * Build base metrics object shared between Draft and non-Draft PRs
   */
  private buildBaseMetrics(
    prDetails: GitHubPullRequestDetail,
    prNumber: number,
    status: string,
    hasForcePushed: boolean,
    wasCreatedAsDraft: boolean,
  ): PrMetrics {
    return {
      prNumber,
      title: prDetails.title || `PR #${prNumber}`,
      author: prDetails.user?.login || 'Unknown',
      url: prDetails.html_url || '',
      status,
      commitToOpen: 0,
      openToReview: 0,
      reviewToApproval: 0,
      approvalToMerge: 0,
      createdAt: prDetails.created_at || new Date().toISOString(),
      updatedAt: prDetails.updated_at || new Date().toISOString(),
      labels: prDetails.labels?.map((label) => ({
        name: label.name,
        color: label.color,
      })),
      hasForcePushed,
      isDraft: prDetails.draft || false,
      wasCreatedAsDraft,
      baseBranch: prDetails.base?.ref,
      headBranch: prDetails.head?.ref,
    };
  }

  /**
   * Calculate time from first commit to when PR was opened/ready for review
   */
  calculateCommitToOpen(
    prDetails: GitHubPullRequestDetail,
    events: unknown[],
  ): number {
    if (!prDetails.commits || prDetails.commits.length === 0) {
      return 0;
    }
    const firstCommit = this.commitService.getFirstCommit(prDetails.commits);
    if (!firstCommit) {
      return 0;
    }
    const workStartedCommit = this.commitService.findWorkStartedCommit(
      this.commitService.filterNonMergeCommits(
        this.commitService.sortCommitsByDate(prDetails.commits),
      ),
    );
    if (!workStartedCommit) {
      console.warn(
        `WARNING - No "Work has started on the" commit found in calculateCommitToOpen!`,
      );
    }
    const firstCommitDate = new Date(
      firstCommit.commit.committer.date,
    ).getTime();
    const readyForReviewDate = this.getReadyForReviewDate(prDetails, events);
    return this.calculateBusinessHours(firstCommitDate, readyForReviewDate);
  }

  /**
   * Calculate time from "ready for review" to first review comment
   * Priority: review comments (reviews with state COMMENTED) > review_comments > issue comments
   */
  calculateOpenToReview(
    prDetails: GitHubPullRequestDetail,
    events: unknown[],
  ): number {
    const readyForReviewDate = this.getReadyForReviewDate(prDetails, events);
    const reviews = prDetails.reviews || [];
    const reviewComments = prDetails.review_comments || [];
    const reviewCommentsWithState = reviews.filter(
      (review) =>
        review.state === 'COMMENTED' &&
        review.submitted_at &&
        review.body &&
        review.body.trim().length > 0,
    );
    const inlineReviewComments = reviewComments.filter(
      (comment) => comment.created_at,
    );
    const reviewDates: number[] = [
      ...reviewCommentsWithState.map((r) => new Date(r.submitted_at).getTime()),
      ...inlineReviewComments.map((c) => new Date(c.created_at).getTime()),
    ];
    if (reviewDates.length === 0) {
      return 0;
    }
    const reviewsAfterReady = reviewDates.filter(
      (date) => date >= readyForReviewDate,
    );
    if (reviewsAfterReady.length === 0) {
      return 0;
    }
    const firstReviewDate = Math.min(...reviewsAfterReady);
    if (firstReviewDate <= readyForReviewDate) {
      return 0;
    }
    return this.calculateBusinessHours(readyForReviewDate, firstReviewDate);
  }

  /**
   * Calculate time from first review comment to last approval
   */
  calculateReviewToApproval(prDetails: GitHubPullRequestDetail): number {
    const reviews = prDetails.reviews || [];
    const allReviews = reviews.filter((review) => review.submitted_at);
    if (allReviews.length === 0) {
      return 0;
    }
    const firstReviewDate = Math.min(
      ...allReviews.map((review) => new Date(review.submitted_at).getTime()),
    );
    const approvals = allReviews.filter(
      (review) => review.state === 'APPROVED',
    );
    if (approvals.length === 0) {
      return 0;
    }
    const lastApprovalDate = Math.max(
      ...approvals.map((review) => new Date(review.submitted_at).getTime()),
    );
    return this.calculateBusinessHours(firstReviewDate, lastApprovalDate);
  }

  /**
   * Calculate time from last approval to merge
   */
  calculateApprovalToMerge(prDetails: GitHubPullRequestDetail): number {
    const reviews = prDetails.reviews || [];
    const approvals = reviews.filter(
      (review) => review.state === 'APPROVED' && review.submitted_at,
    );
    if (approvals.length === 0 || !prDetails.merged_at) {
      return 0;
    }
    const lastApprovalDate = Math.max(
      ...approvals.map((review) => new Date(review.submitted_at).getTime()),
    );
    const mergedDate = new Date(prDetails.merged_at).getTime();
    return this.calculateBusinessHours(lastApprovalDate, mergedDate);
  }

  /**
   * Get PR status based on state and merged_at
   */
  getPrStatus(prDetails: GitHubPullRequestDetail): string {
    if (prDetails.merged_at) {
      return 'Merged';
    }
    if (prDetails.draft) {
      return 'Draft';
    }
    if (prDetails.state === 'closed') {
      return 'Closed';
    }
    if (prDetails.state === 'open') {
      return 'Open';
    }
    return prDetails.state || 'Unknown';
  }

  /**
   * Get ready for review date from events or fallback to PR created_at
   */
  private getReadyForReviewDate(
    prDetails: GitHubPullRequestDetail,
    events: unknown[],
  ): number {
    const allEvents = (events || []) as GitHubEvent[];
    const readyForReviewEvent = allEvents.find(
      (event) => event.event === 'ready_for_review',
    );
    if (readyForReviewEvent) {
      return new Date(readyForReviewEvent.created_at).getTime();
    }
    const openedEvents = allEvents.filter(
      (event) => event.event === 'opened' || event.event === 'reopened',
    );
    if (openedEvents.length > 0) {
      const sortedOpenedEvents = [...openedEvents].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      return new Date(sortedOpenedEvents[0].created_at).getTime();
    }
    return new Date(prDetails.created_at).getTime();
  }

  /**
   * Calculate business hours between two timestamps and round to 2 decimal places
   */
  private calculateBusinessHours(startTime: number, endTime: number): number {
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const businessHours = this.businessDaysService.calculateBusinessHours(
      startDate,
      endDate,
    );
    return Math.round(businessHours * 100) / 100;
  }
}
