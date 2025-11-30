import { Injectable } from '@nestjs/common';
import { CommitService } from '../commit/commit.service';
import type {
  GitHubEvent,
  GitHubPullRequestDetail,
} from '../types/github.types';
import type {
  CommentWithType,
  TimelineItem,
  TimelineResult,
} from '../types/timeline.types';

/**
 * Service for building PR timeline
 */
@Injectable()
export class TimelineService {
  constructor(private readonly commitService: CommitService) {}

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
      const eventUrl = readyForReviewEvent.id
        ? `${prUrl}#event-${readyForReviewEvent.id}`
        : prUrl;
      timelineItems.push({
        type: 'ready_for_review',
        title: 'Marked this pull request as ready for review',
        time: readyForReviewEvent.created_at,
        actor: readyForReviewEvent.actor?.login,
        url: eventUrl,
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

    // Find first comment - prioritize "Everything looks good!" comment
    let firstComment: CommentWithType | null = null;
    let commentTitle: string;

    const everythingLooksGoodComment = allComments.find((comment) => {
      const body = (comment.body || '').trim().toLowerCase();
      return body.includes('everything looks good');
    });

    if (everythingLooksGoodComment) {
      firstComment = everythingLooksGoodComment;
      commentTitle = 'First Review comment';
    } else if (allComments.length > 0) {
      firstComment = allComments[0];
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
      const eventUrl = event.id ? `${prUrl}#event-${event.id}` : prUrl;
      timelineItems.push({
        type: 'review_requested',
        title: 'Requested a review',
        time: event.created_at,
        actor: event.actor?.login,
        url: eventUrl,
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
    sortedReviews.forEach((review) => {
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
        eventUrl = `${prUrl}#event-${event.id}`;
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
