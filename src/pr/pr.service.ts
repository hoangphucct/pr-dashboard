import { Injectable } from '@nestjs/common';
import { GitHubService } from '../github/github.service';
import type { PrMetrics } from '../storage/storage.service';
import type { GitHubPullRequestDetail } from '../github/github.service';

interface GitHubEvent {
  event: string;
  created_at: string;
}

interface GitHubReview {
  state: string;
  submitted_at: string;
  created_at: string;
}

interface GitHubComment {
  submitted_at?: string;
  created_at?: string;
}

@Injectable()
export class PrService {
  constructor(private readonly githubService: GitHubService) {}

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
    const [prDetails, events] = await Promise.all([
      this.githubService.getPullRequestDetails(prNumber),
      this.githubService.getPullRequestEvents(prNumber),
    ]);

    const commitToOpen = this.calculateCommitToOpen(prDetails, events);
    const openToReview = this.calculateOpenToReview(prDetails);
    const reviewToApproval = this.calculateReviewToApproval(prDetails);
    const approvalToMerge = this.calculateApprovalToMerge(prDetails);

    const status = this.getPrStatus(prDetails);

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
    };
  }

  /**
   * Calculate time from first commit to when PR was opened/ready for review
   */
  private calculateCommitToOpen(
    prDetails: GitHubPullRequestDetail,
    events: unknown[],
  ): number {
    if (!prDetails.commits || prDetails.commits.length === 0) {
      return 0;
    }

    const sortedCommits = [...prDetails.commits].sort(
      (a, b) =>
        new Date(a.commit.author.date).getTime() -
        new Date(b.commit.author.date).getTime(),
    );

    const firstCommit = sortedCommits[0];
    const firstCommitDate = new Date(firstCommit.commit.author.date).getTime();

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

    const diffMs = readyForReviewDate - firstCommitDate;
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  }

  /**
   * Calculate time from PR open to first review comment
   */
  private calculateOpenToReview(prDetails: GitHubPullRequestDetail): number {
    const prOpenedDate = new Date(prDetails.created_at).getTime();

    const reviews = (prDetails.reviews || []) as unknown as GitHubReview[];
    const reviewComments = (prDetails.review_comments || []) as GitHubComment[];

    const allReviewComments: Array<GitHubReview | GitHubComment> = [
      ...reviews.filter(
        (review) => review.state !== 'APPROVED' && review.submitted_at,
      ),
      ...reviewComments,
    ].filter((item) => item.submitted_at || item.created_at);

    if (allReviewComments.length === 0) {
      return 0;
    }

    const firstReviewDate = Math.min(
      ...allReviewComments.map((comment) => {
        const dateStr =
          'submitted_at' in comment && comment.submitted_at
            ? comment.submitted_at
            : comment.created_at || '';
        return new Date(dateStr).getTime();
      }),
    );

    const diffMs = firstReviewDate - prOpenedDate;
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  }

  /**
   * Calculate time from first review comment to last approval
   */
  private calculateReviewToApproval(
    prDetails: GitHubPullRequestDetail,
  ): number {
    const reviews = (prDetails.reviews || []) as unknown as GitHubReview[];
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

    const diffMs = lastApprovalDate - firstReviewDate;
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  }

  /**
   * Calculate time from last approval to merge
   */
  private calculateApprovalToMerge(prDetails: GitHubPullRequestDetail): number {
    const reviews = (prDetails.reviews || []) as unknown as GitHubReview[];
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

    const diffMs = mergedDate - lastApprovalDate;
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  }

  /**
   * Get PR status based on state and merged_at
   */
  private getPrStatus(prDetails: GitHubPullRequestDetail): string {
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
