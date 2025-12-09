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
    // GraphQL response already includes events
    const prDetails = await this.githubService.getPullRequestDetails(prNumber);

    // Extract events from GraphQL response
    const events =
      (prDetails as GitHubPullRequestDetail & { _events?: unknown[] })
        ._events || [];

    const status = this.getPrStatus(prDetails);

    // If PR is Draft, return 0 for all metrics (only start calculating when opened or merged)
    if (status === 'Draft') {
      // Check if PR has force-pushed events (even for Draft)
      const allEvents = (events || []) as GitHubEvent[];
      const hasForcePushed = allEvents.some(
        (event) => event.event === 'head_ref_force_pushed',
      );

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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        labels: prDetails.labels?.map((label) => ({
          name: label.name,
          color: label.color,
        })),
        hasForcePushed,
        baseBranch: prDetails.base?.ref,
        headBranch: prDetails.head?.ref,
      };
    }

    const commitToOpen = this.calculateCommitToOpen(prDetails, events);
    const openToReview = this.calculateOpenToReview(prDetails, events);
    const reviewToApproval = this.calculateReviewToApproval(prDetails);
    const approvalToMerge = this.calculateApprovalToMerge(prDetails);

    // Check if PR has force-pushed events
    const allEvents = (events || []) as GitHubEvent[];
    const hasForcePushed = allEvents.some(
      (event) => event.event === 'head_ref_force_pushed',
    );

    return {
      prNumber,
      title: prDetails.title || `PR #${prNumber}`,
      author: prDetails.user?.login || 'Unknown',
      url: prDetails.html_url || '',
      status,
      commitToOpen,
      openToReview,
      reviewToApproval,
      approvalToMerge,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      labels: prDetails.labels?.map((label) => ({
        name: label.name,
        color: label.color,
      })),
      hasForcePushed,
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

    const allEvents = (events || []) as GitHubEvent[];

    const readyForReviewEvent = allEvents.find(
      (event) => event.event === 'ready_for_review',
    );

    const openedEvents = allEvents.filter(
      (event) => event.event === 'opened' || event.event === 'reopened',
    );

    let readyForReviewDate: number;

    if (readyForReviewEvent) {
      readyForReviewDate = new Date(readyForReviewEvent.created_at).getTime();
    } else if (openedEvents.length > 0) {
      const sortedOpenedEvents = [...openedEvents].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      readyForReviewDate = new Date(sortedOpenedEvents[0].created_at).getTime();
    } else {
      readyForReviewDate = new Date(prDetails.created_at).getTime();
    }

    // Calculate business hours between specific timestamps
    const startDate = new Date(firstCommitDate);
    const endDate = new Date(readyForReviewDate);
    const businessHours = this.businessDaysService.calculateBusinessHours(
      startDate,
      endDate,
    );

    // Round to 2 decimal places
    return Math.round(businessHours * 100) / 100;
  }

  /**
   * Calculate time from "ready for review" to first review comment
   * Priority: review comments (reviews with state COMMENTED) > review_comments > issue comments
   */
  calculateOpenToReview(
    prDetails: GitHubPullRequestDetail,
    events: unknown[],
  ): number {
    const allEvents = (events || []) as GitHubEvent[];

    // Find ready_for_review event (or fallback to PR created_at)
    const readyForReviewEvent = allEvents.find(
      (event) => event.event === 'ready_for_review',
    );

    const openedEvents = allEvents.filter(
      (event) => event.event === 'opened' || event.event === 'reopened',
    );

    let readyForReviewDate: number;

    if (readyForReviewEvent) {
      readyForReviewDate = new Date(readyForReviewEvent.created_at).getTime();
    } else if (openedEvents.length > 0) {
      const sortedOpenedEvents = [...openedEvents].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      readyForReviewDate = new Date(sortedOpenedEvents[0].created_at).getTime();
    } else {
      readyForReviewDate = new Date(prDetails.created_at).getTime();
    }

    const reviews = prDetails.reviews || [];
    const reviewComments = prDetails.review_comments || [];

    // Priority 1: Reviews with state COMMENTED (overall review comments)
    const reviewCommentsWithState = reviews.filter(
      (review) =>
        review.state === 'COMMENTED' &&
        review.submitted_at &&
        review.body &&
        review.body.trim().length > 0,
    );

    // Priority 2: Review comments (inline comments on code)
    const inlineReviewComments = reviewComments.filter(
      (comment) => comment.created_at,
    );

    // Collect all review dates
    const reviewDates: number[] = [];

    // Add review comments with state dates
    reviewCommentsWithState.forEach((review) => {
      if (review.submitted_at) {
        reviewDates.push(new Date(review.submitted_at).getTime());
      }
    });

    // Add inline review comments dates
    inlineReviewComments.forEach((comment) => {
      if (comment.created_at) {
        reviewDates.push(new Date(comment.created_at).getTime());
      }
    });

    if (reviewDates.length === 0) {
      return 0;
    }

    // Find first review date that occurs AFTER ready_for_review
    // If all reviews are before ready_for_review, return 0
    const reviewsAfterReady = reviewDates.filter(
      (date) => date >= readyForReviewDate,
    );

    if (reviewsAfterReady.length === 0) {
      // All reviews happened before ready_for_review, so openToReview = 0
      // This means reviews were done before PR was marked as ready
      return 0;
    }

    const firstReviewDate = Math.min(...reviewsAfterReady);

    // Calculate business hours between specific timestamps
    const startDate = new Date(readyForReviewDate);
    const endDate = new Date(firstReviewDate);

    // Ensure endDate is after startDate
    if (endDate <= startDate) {
      return 0;
    }

    const businessHours = this.businessDaysService.calculateBusinessHours(
      startDate,
      endDate,
    );

    return Math.round(businessHours * 100) / 100;
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

    // Calculate business hours between specific timestamps
    const startDate = new Date(firstReviewDate);
    const endDate = new Date(lastApprovalDate);
    const businessHours = this.businessDaysService.calculateBusinessHours(
      startDate,
      endDate,
    );

    // Round to 2 decimal places
    const rounded = Math.round(businessHours * 100) / 100;
    return rounded;
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

    // Calculate business hours between specific timestamps
    const startDate = new Date(lastApprovalDate);
    const endDate = new Date(mergedDate);
    const businessHours = this.businessDaysService.calculateBusinessHours(
      startDate,
      endDate,
    );

    // Round to 2 decimal places
    const rounded = Math.round(businessHours * 100) / 100;
    return rounded;
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
}
