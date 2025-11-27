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
  body?: string;
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

    const status = this.getPrStatus(prDetails);

    // If PR is Draft, return 0 for all metrics (only start calculating when opened or merged)
    if (status === 'Draft') {
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
      };
    }

    const commitToOpen = this.calculateCommitToOpen(prDetails, events);
    const openToReview = this.calculateOpenToReview(prDetails);
    const reviewToApproval = this.calculateReviewToApproval(prDetails);
    const approvalToMerge = this.calculateApprovalToMerge(prDetails);

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
  calculateCommitToOpen(
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

    // Filter out merge commits to get the actual first work commit
    const nonMergeCommits = sortedCommits.filter((commit) => {
      const message = commit.commit.message.toLowerCase();
      return (
        !message.startsWith('merge pull request') &&
        !message.startsWith('merge branch') &&
        !message.startsWith('merge ') &&
        (!commit.parents || commit.parents.length <= 1)
      );
    });

    // Priority 1: Find commit with "Work has started on the" message
    const workStartedCommit = nonMergeCommits.find((commit) =>
      commit.commit.message.toLowerCase().startsWith('work has started on the'),
    );

    // Priority 2: Use first non-merge commit, or first commit if all are merge commits
    const firstCommit = workStartedCommit ||
      (nonMergeCommits.length > 0 ? nonMergeCommits[0] : sortedCommits[0]);
    
    const firstCommitDate = new Date(firstCommit.commit.author.date).getTime();
    
    if (!workStartedCommit) {
      console.warn(`WARNING - No "Work has started on the" commit found in calculateCommitToOpen!`);
    }

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
   * Priority: review comments (reviews with state COMMENTED) > review_comments > issue comments
   */
  calculateOpenToReview(prDetails: GitHubPullRequestDetail): number {
    const prOpenedDate = new Date(prDetails.created_at).getTime();

    const reviews = (prDetails.reviews || []) as unknown as GitHubReview[];
    const reviewComments = (prDetails.review_comments || []) as GitHubComment[];

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
      (comment) => comment.created_at || comment.submitted_at,
    );

    // Combine with priority: review comments first, then inline review comments
    const allReviewComments: Array<GitHubReview | GitHubComment> = [
      ...reviewCommentsWithState,
      ...inlineReviewComments,
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
  calculateReviewToApproval(prDetails: GitHubPullRequestDetail): number {
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
  calculateApprovalToMerge(prDetails: GitHubPullRequestDetail): number {
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
