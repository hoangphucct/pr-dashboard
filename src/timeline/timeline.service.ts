import { Injectable } from '@nestjs/common';
import { CommitService } from '@commit/commit.service';
import type {
  GitHubEvent,
  GitHubPullRequestDetail,
} from '@shared/github.types';
import type {
  CommentWithType,
  TimelineItem,
  TimelineResult,
} from '@shared/timeline.types';

/**
 * Service for building PR timeline
 */
@Injectable()
export class TimelineService {
  constructor(private readonly commitService: CommitService) {}

  /**
   * Build event URL from PR URL and event ID
   */
  private buildEventUrl(prUrl: string, eventId?: string | number): string {
    return eventId ? `${prUrl}#event-${eventId}` : prUrl;
  }

  /**
   * Build review URL from PR URL and review ID
   */
  private buildReviewUrl(
    prUrl: string,
    reviewId: number,
    htmlUrl?: string,
  ): string | undefined {
    return (
      htmlUrl || (prUrl ? `${prUrl}#pullrequestreview-${reviewId}` : undefined)
    );
  }

  /**
   * Check if a user is Copilot bot
   */
  private isCopilotUser(login?: string): boolean {
    return (
      login === 'github-actions[bot]' || (login?.includes('copilot') ?? false)
    );
  }

  /**
   * Build timeline for a PR
   */
  buildTimeline(
    prDetails: GitHubPullRequestDetail,
    events: unknown[],
    baseCommits: string[] = [],
  ): TimelineResult {
    const prUrl = prDetails.html_url || '';
    const owner = prDetails.base?.repo?.owner?.login || '';
    const repo = prDetails.base?.repo?.name || '';

    const timelineItems: TimelineItem[] = [];
    const allEvents = (events || []) as GitHubEvent[];

    // Sort events by time
    const sortedEvents = [...allEvents].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    // Add first commit to timeline
    this.addFirstCommitToTimeline(
      prDetails,
      baseCommits,
      owner,
      repo,
      timelineItems,
    );

    // Add ready_for_review event
    this.addReadyForReviewEvent(sortedEvents, prUrl, timelineItems);

    // Add first comment
    this.addFirstComment(prDetails, prUrl, timelineItems);

    // Add Devin review comments as review_requested events
    this.addDevinReviewComments(prDetails, prUrl, timelineItems);

    // Add review_requested events
    this.addReviewRequestedEvents(sortedEvents, prUrl, timelineItems);

    // Add force-pushed events
    this.addForcePushedEvents(sortedEvents, owner, repo, prUrl, timelineItems);

    // Add reviews
    this.addReviews(prDetails, prUrl, timelineItems);

    // Add merge event
    this.addMergeEvent(prDetails, owner, repo, prUrl, timelineItems);

    // Sort all timeline items by time
    timelineItems.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );

    return { timeline: timelineItems };
  }

  /**
   * Add first commit to timeline
   */
  private addFirstCommitToTimeline(
    prDetails: GitHubPullRequestDetail,
    baseCommits: string[],
    owner: string,
    repo: string,
    timelineItems: TimelineItem[],
  ): void {
    if (!prDetails.commits || prDetails.commits.length === 0) {
      return;
    }

    const firstCommit = this.commitService.getFirstCommit(
      prDetails.commits,
      baseCommits.length > 0 ? baseCommits : undefined,
    );

    if (!firstCommit) {
      return;
    }

    // Log warning if "Work has started on the" commit is not found
    const workStartedCommit = this.commitService.findWorkStartedCommit(
      this.commitService.filterNonMergeCommits(
        this.commitService.sortCommitsByDate(prDetails.commits),
      ),
    );
    if (!workStartedCommit) {
      console.warn(
        `PR #${prDetails.number}: WARNING - No "Work has started on the" commit found!`,
      );
    }

    const commitMessage = this.commitService.getCommitMessage(firstCommit);
    const commitUrl =
      owner && repo && firstCommit.sha
        ? this.commitService.buildCommitUrl(owner, repo, firstCommit.sha)
        : undefined;

    timelineItems.push({
      type: 'commit',
      title: commitMessage || 'First commit',
      time: firstCommit.commit.committer.date,
      url: commitUrl,
    });
  }

  /**
   * Add ready_for_review event to timeline
   */
  private addReadyForReviewEvent(
    sortedEvents: GitHubEvent[],
    prUrl: string,
    timelineItems: TimelineItem[],
  ): void {
    const readyForReviewEvent = sortedEvents.find(
      (e) => e.event === 'ready_for_review',
    );
    if (readyForReviewEvent) {
      timelineItems.push({
        type: 'ready_for_review',
        title: 'Marked this pull request as ready for review',
        time: readyForReviewEvent.created_at,
        actor: readyForReviewEvent.actor?.login,
        url: this.buildEventUrl(prUrl, readyForReviewEvent.id),
      });
    }
  }

  /**
   * Add first comment to timeline
   */
  private addFirstComment(
    prDetails: GitHubPullRequestDetail,
    prUrl: string,
    timelineItems: TimelineItem[],
  ): void {
    const reviews = prDetails.reviews || [];
    const issueComments = prDetails.comments || [];

    // Collect all reviews with body
    const reviewsWithBody: CommentWithType[] = reviews
      .filter(
        (review) =>
          review.submitted_at && review.body && review.body.trim().length > 0,
      )
      .map((review) => ({
        id: review.id,
        submitted_at: review.submitted_at,
        body: review.body,
        html_url: review.html_url,
        user: review.user,
        commentType: 'review' as const,
        timestamp: new Date(review.submitted_at).getTime(),
      }));

    // Collect all issue comments
    const allIssueComments: CommentWithType[] = issueComments
      .filter((comment) => comment.created_at && comment.body)
      .map((comment) => ({
        id: comment.id,
        created_at: comment.created_at,
        body: comment.body,
        html_url: comment.html_url,
        user: comment.user,
        commentType: 'issue' as const,
        timestamp: new Date(comment.created_at).getTime(),
      }));

    // Combine and sort by timestamp
    const allComments = [...reviewsWithBody, ...allIssueComments].sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    // Filter out "Devin review" comments from first comment selection
    const commentsExcludingDevinReview = allComments.filter((comment) => {
      const body = (comment.body || '').trim().toLowerCase();
      return !body.includes('devin review');
    });

    // Find first comment - prioritize "Everything looks good!" comment
    let firstComment: CommentWithType | null = null;
    let commentTitle: string;

    const everythingLooksGoodComment = commentsExcludingDevinReview.find(
      (comment) => {
        const body = (comment.body || '').trim().toLowerCase();
        return body.includes('everything looks good');
      },
    );

    if (everythingLooksGoodComment) {
      firstComment = everythingLooksGoodComment;
      commentTitle = 'First Review comment';
    } else if (commentsExcludingDevinReview.length > 0) {
      firstComment = commentsExcludingDevinReview[0];
      commentTitle =
        firstComment.commentType === 'review'
          ? 'First review comment'
          : 'First comment';
    } else {
      commentTitle = 'First comment';
    }

    if (firstComment) {
      let commentUrl: string | undefined;
      if (firstComment.commentType === 'review' && firstComment.html_url) {
        commentUrl = firstComment.html_url;
      } else if (firstComment.html_url) {
        commentUrl = firstComment.html_url;
      } else if (prUrl && firstComment.id) {
        commentUrl = `${prUrl}#issuecomment-${firstComment.id}`;
      }

      const commentTime =
        firstComment.created_at || firstComment.submitted_at || '';
      timelineItems.push({
        type: 'comment',
        title: commentTitle,
        time: commentTime,
        actor: firstComment.user?.login,
        url: commentUrl,
      });
    }
  }

  /**
   * Add Devin review comments as review_requested events
   */
  private addDevinReviewComments(
    prDetails: GitHubPullRequestDetail,
    prUrl: string,
    timelineItems: TimelineItem[],
  ): void {
    const reviews = prDetails.reviews || [];
    const issueComments = prDetails.comments || [];

    // Collect all reviews with "Devin review" in body
    const devinReviewComments: CommentWithType[] = reviews
      .filter(
        (review) =>
          review.submitted_at &&
          review.body &&
          review.body.trim().length > 0 &&
          review.body.trim().toLowerCase().includes('devin review'),
      )
      .map((review) => ({
        id: review.id,
        submitted_at: review.submitted_at,
        body: review.body,
        html_url: review.html_url,
        user: review.user,
        commentType: 'review' as const,
        timestamp: new Date(review.submitted_at).getTime(),
      }));

    // Collect all issue comments with "Devin review" in body
    const devinIssueComments: CommentWithType[] = issueComments
      .filter(
        (comment) =>
          comment.created_at &&
          comment.body &&
          comment.body.trim().toLowerCase().includes('devin review'),
      )
      .map((comment) => ({
        id: comment.id,
        created_at: comment.created_at,
        body: comment.body,
        html_url: comment.html_url,
        user: comment.user,
        commentType: 'issue' as const,
        timestamp: new Date(comment.created_at).getTime(),
      }));

    // Combine and sort by timestamp
    const allDevinComments = [
      ...devinReviewComments,
      ...devinIssueComments,
    ].sort((a, b) => a.timestamp - b.timestamp);

    // Add each Devin review comment as review_requested event
    allDevinComments.forEach((comment) => {
      let commentUrl: string | undefined;
      if (comment.commentType === 'review' && comment.html_url) {
        commentUrl = comment.html_url;
      } else if (comment.html_url) {
        commentUrl = comment.html_url;
      } else if (prUrl && comment.id) {
        commentUrl = `${prUrl}#issuecomment-${comment.id}`;
      }

      const commentTime = comment.created_at || comment.submitted_at || '';
      timelineItems.push({
        type: 'review_requested',
        title: 'Requested a review Devin review',
        time: commentTime,
        actor: comment.user?.login,
        url: commentUrl,
      });
    });
  }

  /**
   * Add review_requested events to timeline
   */
  private addReviewRequestedEvents(
    sortedEvents: GitHubEvent[],
    prUrl: string,
    timelineItems: TimelineItem[],
  ): void {
    const reviewRequestedEvents = sortedEvents.filter(
      (e) => e.event === 'review_requested',
    );
    reviewRequestedEvents.forEach((event) => {
      timelineItems.push({
        type: 'review_requested',
        title: 'Requested a review',
        time: event.created_at,
        actor: event.actor?.login,
        url: this.buildEventUrl(prUrl, event.id),
      });
    });
  }

  /**
   * Add reviews to timeline
   */
  private addReviews(
    prDetails: GitHubPullRequestDetail,
    prUrl: string,
    timelineItems: TimelineItem[],
  ): void {
    const sortedReviews = (prDetails.reviews || []).sort(
      (a, b) =>
        new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime(),
    );

    let hasFirstApproval = false;
    let hasFirstReviewComment = false;
    sortedReviews.forEach((review) => {
      const isCopilot = this.isCopilotUser(review.user?.login);
      const reviewUrl = this.buildReviewUrl(prUrl, review.id, review.html_url);

      if (review.state === 'APPROVED') {
        const isFirstApproval = !hasFirstApproval;
        hasFirstApproval = true;

        let approvalTitle: string;
        if (isFirstApproval) {
          approvalTitle = 'First approval';
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
          url: reviewUrl,
        });
      } else if (review.state === 'COMMENTED') {
        const isFirstReviewComment = !hasFirstReviewComment;
        hasFirstReviewComment = true;

        let reviewCommentTitle: string;
        if (isFirstReviewComment) {
          reviewCommentTitle = 'First review comment';
        } else if (isCopilot) {
          reviewCommentTitle = 'Copilot AI reviewed';
        } else {
          reviewCommentTitle = 'Review comment';
        }

        timelineItems.push({
          type: 'review_comment',
          title: reviewCommentTitle,
          time: review.submitted_at,
          actor: review.user?.login,
          url: reviewUrl,
        });
      }
    });
  }

  /**
   * Add force-pushed events to timeline with detailed information
   */
  private addForcePushedEvents(
    sortedEvents: GitHubEvent[],
    owner: string,
    repo: string,
    prUrl: string,
    timelineItems: TimelineItem[],
  ): void {
    const forcePushedEvents = sortedEvents.filter(
      (e) => e.event === 'head_ref_force_pushed',
    );
    forcePushedEvents.forEach((event, index) => {
      // Build detailed title with commit information
      const commitSha = event.commit_id || event.after || null;
      const beforeSha = event.before || null;
      let title = 'Force pushed';
      let description: string | undefined;

      // Add commit SHA information if available
      if (commitSha) {
        const shortSha = commitSha.substring(0, 7);
        title = `Force pushed to ${shortSha}`;

        // Build description with before/after information
        const details: string[] = [];
        if (beforeSha) {
          const shortBeforeSha = beforeSha.substring(0, 7);
          details.push(`Before: ${shortBeforeSha}`);
        }
        details.push(`After: ${shortSha}`);
        if (event.ref) {
          details.push(`Branch: ${event.ref}`);
        }
        description = details.join(' • ');
      } else if (forcePushedEvents.length > 1) {
        // If multiple force pushes, number them
        title = `Force pushed (${index + 1})`;
      }

      // Build URL - prefer commit URL, then event URL
      let eventUrl: string | undefined = prUrl;
      if (commitSha && owner && repo) {
        eventUrl = this.commitService.buildCommitUrl(owner, repo, commitSha);
      } else if (event.id) {
        eventUrl = this.buildEventUrl(prUrl, event.id);
      }

      timelineItems.push({
        type: 'force_pushed',
        title,
        time: event.created_at,
        actor: event.actor?.login,
        url: eventUrl,
        description,
      });
    });
  }

  /**
   * Add merge event to timeline
   */
  private addMergeEvent(
    prDetails: GitHubPullRequestDetail,
    owner: string,
    repo: string,
    prUrl: string,
    timelineItems: TimelineItem[],
  ): void {
    if (!prDetails.merged_at) {
      return;
    }

    const mergeCommitSha = prDetails.merge_commit_sha;
    let mergeUrl: string | undefined;
    if (mergeCommitSha && owner && repo) {
      mergeUrl = this.commitService.buildCommitUrl(owner, repo, mergeCommitSha);
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
}
