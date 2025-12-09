import { Injectable } from '@nestjs/common';
import { CommitService } from '@commit/commit.service';
import type {
  GitHubEvent,
  GitHubPullRequestDetail,
  GitHubComment,
} from '@shared/github.types';
import type {
  CommentWithType,
  TimelineItem,
  TimelineResult,
} from '@shared/timeline.types';

/**
 * Comment node for building comment tree structure
 */
interface CommentNode {
  id: number;
  parentId?: number | null;
  created_at: string;
  userLogin?: string;
  html_url?: string;
  raw: GitHubComment;
  children: CommentNode[];
}

/**
 * Refactored TimelineService
 * - Keeps original public API
 * - Merges inline review comments handling into addReviews
 * - Improves URL helpers, validation and parent-child mapping
 */
@Injectable()
export class TimelineService {
  constructor(private readonly commitService: CommitService) {}

  /* ----------------------------- Helpers ----------------------------- */
  private buildEventUrl(prUrl: string, eventId?: string | number): string {
    return eventId ? `${prUrl}#event-${eventId}` : prUrl;
  }

  private buildReviewUrl(
    prUrl: string,
    reviewId: number,
    htmlUrl?: string,
  ): string | undefined {
    if (htmlUrl) return htmlUrl;
    return prUrl ? `${prUrl}#pullrequestreview-${reviewId}` : undefined;
  }

  private extractDiscussionIdFromUrl(url?: string): number | null {
    if (!url) return null;
    const m = /#discussion_r(\d+)/.exec(url);
    return m ? Number.parseInt(m[1], 10) : null;
  }

  private buildReviewCommentUrl(
    prUrl: string,
    commentId: number,
    htmlUrl?: string,
  ): string | undefined {
    if (htmlUrl) {
      if (/#discussion_r\d+/.test(htmlUrl)) return htmlUrl;
      try {
        const u = new URL(htmlUrl);
        return `${u.origin}${u.pathname}#discussion_r${commentId}`;
      } catch {
        return `${prUrl}#discussion_r${commentId}`;
      }
    }
    if (prUrl && commentId) return `${prUrl}#discussion_r${commentId}`;
    return undefined;
  }

  private isCopilotUser(login?: string): boolean {
    if (!login) return false;
    const l = login.toLowerCase();
    return l === 'github-actions[bot]' || l.includes('copilot');
  }

  private getApprovalTitle(isFirst: boolean, isCopilot: boolean): string {
    if (isFirst) return 'First approval';
    if (isCopilot) return 'Copilot AI reviewed';
    return 'Approved';
  }

  private getReviewCommentTitle(isFirst: boolean, isCopilot: boolean): string {
    if (isFirst) return 'First review comment';
    if (isCopilot) return 'Copilot AI reviewed';
    return 'Review comment';
  }

  /* ----------------------------- Public API ----------------------------- */
  buildTimeline(
    prDetails: GitHubPullRequestDetail,
    events: unknown[],
  ): TimelineResult {
    const prUrl = prDetails.html_url || '';
    const owner = prDetails.base?.repo?.owner?.login || '';
    const repo = prDetails.base?.repo?.name || '';

    const timelineItems: TimelineItem[] = [];
    const allEvents = (events || []) as GitHubEvent[];

    // Sort events once
    const sortedEvents = [...allEvents].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    // Track first review comment across all review comment types
    const firstReviewCommentTracker: {
      hasFirstReviewComment: boolean;
      firstReviewCommentTime: number | null;
    } = {
      hasFirstReviewComment: false,
      firstReviewCommentTime: null,
    };

    // Build timeline pieces
    this.addFirstCommitToTimeline(prDetails, owner, repo, timelineItems);
    this.addReadyForReviewEvent(sortedEvents, prUrl, timelineItems);
    this.addFirstComment(prDetails, prUrl, timelineItems);
    this.addDevinReviewComments(prDetails, prUrl, timelineItems);
    this.addReviewRequestedEvents(sortedEvents, prUrl, timelineItems);
    this.addForcePushedEvents(sortedEvents, owner, repo, prUrl, timelineItems);
    this.addBaseRefChangedEvents(sortedEvents, prUrl, timelineItems);
    this.addReviews(prDetails, prUrl, timelineItems, firstReviewCommentTracker); // now handles approvals + overall reviews + inline threaded comments
    this.addMergeEvent(prDetails, owner, repo, prUrl, timelineItems);

    // Sort timeline while preserving parent-child relationships
    // Comments with parentId must appear immediately after their parent
    this.sortTimelineWithParentChildPreservation(timelineItems);
    return { timeline: timelineItems };
  }

  /* ----------------------------- Commits ----------------------------- */
  private addFirstCommitToTimeline(
    prDetails: GitHubPullRequestDetail,
    owner: string,
    repo: string,
    timelineItems: TimelineItem[],
  ): void {
    if (!prDetails.commits || prDetails.commits.length === 0) return;

    const firstCommit = this.commitService.getFirstCommit(prDetails.commits);

    if (!firstCommit) return;

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

    // Get committer - prefer GitHub user login, fallback to git committer name
    const commitAuthor =
      firstCommit.commit?.committer?.user?.login ||
      firstCommit.commit?.committer?.name;

    timelineItems.push({
      type: 'commit',
      title: commitMessage || 'First commit',
      time: firstCommit.commit.committer.date,
      actor: commitAuthor,
      url: commitUrl,
    });
  }

  /* ----------------------------- Ready for review ----------------------------- */
  private addReadyForReviewEvent(
    sortedEvents: GitHubEvent[],
    prUrl: string,
    timelineItems: TimelineItem[],
  ): void {
    const readyForReviewEvent = sortedEvents.find(
      (e) => e.event === 'ready_for_review',
    );
    if (!readyForReviewEvent) return;

    timelineItems.push({
      type: 'ready_for_review',
      title: 'Marked this pull request as ready for review',
      time: readyForReviewEvent.created_at,
      actor: readyForReviewEvent.actor?.login,
      url: this.buildEventUrl(prUrl, readyForReviewEvent.id),
    });
  }

  /* ----------------------------- First comment ----------------------------- */
  private addFirstComment(
    prDetails: GitHubPullRequestDetail,
    prUrl: string,
    timelineItems: TimelineItem[],
  ): void {
    // Only handle issue comments here
    // Review comments (both overall and inline) are handled in addReviews
    const issueComments = prDetails.comments || [];

    const allIssueComments: CommentWithType[] = issueComments
      .filter((c) => c.created_at && c.body)
      .map((c) => ({
        id: c.id,
        created_at: c.created_at,
        body: c.body,
        html_url: c.html_url,
        user: c.user,
        commentType: 'issue' as const,
        timestamp: new Date(c.created_at).getTime(),
      }));

    if (allIssueComments.length === 0) return;

    const commentsExcludingDevinReview = allIssueComments.filter((comment) => {
      const body = (comment.body || '').trim().toLowerCase();
      return !body.includes('devin review');
    });

    if (commentsExcludingDevinReview.length === 0) return;

    const firstComment = commentsExcludingDevinReview[0];
    let commentUrl: string | undefined;
    if (firstComment.html_url) {
      commentUrl = firstComment.html_url;
    } else if (prUrl && firstComment.id) {
      commentUrl = `${prUrl}#issuecomment-${firstComment.id}`;
    }

    const commentTime = firstComment.created_at || '';
    timelineItems.push({
      type: 'comment',
      title: 'First comment',
      time: commentTime,
      actor: firstComment.user?.login,
      url: commentUrl,
    });
  }

  /* ----------------------------- Devin review comments ----------------------------- */
  private addDevinReviewComments(
    prDetails: GitHubPullRequestDetail,
    prUrl: string,
    timelineItems: TimelineItem[],
  ): void {
    const reviews = prDetails.reviews || [];
    const issueComments = prDetails.comments || [];

    const devinReviewComments: CommentWithType[] = reviews
      .filter(
        (r) =>
          r.submitted_at &&
          r.body &&
          r.body.trim().length > 0 &&
          r.body.trim().toLowerCase().includes('devin review'),
      )
      .map((r) => ({
        id: r.id,
        submitted_at: r.submitted_at,
        body: r.body,
        html_url: r.html_url,
        user: r.user,
        commentType: 'review' as const,
        timestamp: new Date(r.submitted_at).getTime(),
      }));

    const devinIssueComments: CommentWithType[] = issueComments
      .filter(
        (c) =>
          c.created_at && c.body?.trim().toLowerCase().includes('devin review'),
      )
      .map((c) => ({
        id: c.id,
        created_at: c.created_at,
        body: c.body,
        html_url: c.html_url,
        user: c.user,
        commentType: 'issue' as const,
        timestamp: new Date(c.created_at).getTime(),
      }));

    const allDevinComments = [
      ...devinReviewComments,
      ...devinIssueComments,
    ].sort((a, b) => a.timestamp - b.timestamp);

    allDevinComments.forEach((comment) => {
      let commentUrl: string | undefined;
      if (comment.commentType === 'review' && comment.html_url)
        commentUrl = comment.html_url;
      else if (comment.html_url) commentUrl = comment.html_url;
      else if (prUrl && comment.id)
        commentUrl = `${prUrl}#issuecomment-${comment.id}`;

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

  /* ----------------------------- Review requested events ----------------------------- */
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

  /* ----------------------------- Reviews (approvals, overall reviews, + threaded inline comments) ----------------------------- */
  private addReviews(
    prDetails: GitHubPullRequestDetail,
    prUrl: string,
    timelineItems: TimelineItem[],
    firstReviewCommentTracker: {
      hasFirstReviewComment: boolean;
      firstReviewCommentTime: number | null;
    },
  ): void {
    // Find the first review comment timestamp across all review comment types
    const firstReviewCommentTime = this.findFirstReviewCommentTime(prDetails);
    firstReviewCommentTracker.firstReviewCommentTime = firstReviewCommentTime;

    this.processOverallReviews(
      prDetails,
      prUrl,
      timelineItems,
      firstReviewCommentTracker,
    );
    this.processInlineReviewComments(
      prDetails,
      prUrl,
      timelineItems,
      firstReviewCommentTracker,
    );
  }

  private findFirstReviewCommentTime(
    prDetails: GitHubPullRequestDetail,
  ): number | null {
    const reviewCommentTimes: number[] = [];

    // Collect overall review comments with body
    const reviews = prDetails.reviews || [];
    reviews.forEach((review) => {
      if (
        review.state === 'COMMENTED' &&
        review.body &&
        review.body.trim().length > 0 &&
        review.submitted_at
      ) {
        reviewCommentTimes.push(new Date(review.submitted_at).getTime());
      }
    });

    // Collect inline review comments
    const inlineComments = prDetails.review_comments || [];
    inlineComments.forEach((comment) => {
      if (comment.created_at) {
        reviewCommentTimes.push(new Date(comment.created_at).getTime());
      }
    });

    if (reviewCommentTimes.length === 0) {
      return null;
    }

    return Math.min(...reviewCommentTimes);
  }

  private processOverallReviews(
    prDetails: GitHubPullRequestDetail,
    prUrl: string,
    timelineItems: TimelineItem[],
    firstReviewCommentTracker: {
      hasFirstReviewComment: boolean;
      firstReviewCommentTime: number | null;
    },
  ): void {
    const reviews = [...(prDetails.reviews || [])].sort(
      (a, b) =>
        new Date(a.submitted_at || 0).getTime() -
        new Date(b.submitted_at || 0).getTime(),
    );

    let hasFirstApproval = false;

    for (const review of reviews) {
      if (!review.submitted_at) continue;
      const isCopilot = this.isCopilotUser(review.user?.login);
      const reviewUrl = this.buildReviewUrl(prUrl, review.id, review.html_url);

      if (review.state === 'APPROVED') {
        const title = this.getApprovalTitle(!hasFirstApproval, isCopilot);
        hasFirstApproval = true;
        timelineItems.push({
          type: 'approved',
          title,
          time: review.submitted_at,
          actor: review.user?.login,
          url: reviewUrl,
        });
      } else if (
        review.state === 'COMMENTED' &&
        review.body &&
        review.body.trim().length > 0
      ) {
        const reviewTime = new Date(review.submitted_at).getTime();
        const isFirstReviewComment =
          firstReviewCommentTracker.firstReviewCommentTime !== null &&
          reviewTime === firstReviewCommentTracker.firstReviewCommentTime &&
          !firstReviewCommentTracker.hasFirstReviewComment;
        if (isFirstReviewComment) {
          firstReviewCommentTracker.hasFirstReviewComment = true;
        }
        const title = this.getReviewCommentTitle(
          isFirstReviewComment,
          isCopilot,
        );
        timelineItems.push({
          type: 'review_comment',
          title,
          time: review.submitted_at,
          actor: review.user?.login,
          url: reviewUrl,
        });
      }
    }
  }

  private processInlineReviewComments(
    prDetails: GitHubPullRequestDetail,
    prUrl: string,
    timelineItems: TimelineItem[],
    firstReviewCommentTracker: {
      hasFirstReviewComment: boolean;
      firstReviewCommentTime: number | null;
    },
  ): void {
    const inlineComments = prDetails.review_comments || [];
    if (inlineComments.length === 0) return;

    const { nodeMap, discussionMap } = this.createCommentNodes(inlineComments);
    const linkedNodes = this.linkCommentNodes(nodeMap, discussionMap);
    const roots = this.collectRootNodes(nodeMap, linkedNodes);
    this.sortCommentNodes(roots, nodeMap);
    this.flattenCommentTree(
      roots,
      prUrl,
      timelineItems,
      firstReviewCommentTracker,
    );
  }

  private validateOrGenerateCommentId(
    comment: GitHubComment | null | undefined,
  ): number {
    if (!comment?.id) {
      return this.generateCommentIdFromUrl(comment?.html_url, null);
    }
    if (typeof comment.id !== 'number' || Number.isNaN(comment.id)) {
      return this.generateCommentIdFromUrl(comment?.html_url, comment.id);
    }
    return comment.id;
  }

  private generateCommentIdFromUrl(
    htmlUrl: string | undefined,
    originalId: string | number | null,
  ): number {
    const urlHash = htmlUrl
      ? htmlUrl.split('/').pop()?.replaceAll(/\D/g, '') || ''
      : '';
    const commentId = urlHash
      ? Number.parseInt(urlHash, 10) || Date.now()
      : Date.now();
    const idLabel = originalId === null ? 'missing' : `"${originalId}"`;
    console.warn(
      `Comment has ${idLabel} ID, using generated ID ${commentId} from URL: ${htmlUrl}`,
    );
    return commentId;
  }

  private createCommentNodes(inlineComments: GitHubComment[]): {
    nodeMap: Map<number, CommentNode>;
    discussionMap: Map<number, number>;
  } {
    const nodeMap = new Map<number, CommentNode>();
    const discussionMap = new Map<number, number>();

    for (const c of inlineComments) {
      const commentId = this.validateOrGenerateCommentId(c);
      const created_at = c?.created_at || new Date().toISOString();
      if (!c?.created_at) {
        console.warn(
          `Comment ${commentId} missing created_at, using current timestamp`,
        );
      }

      const node: CommentNode = {
        id: commentId,
        parentId: c?.in_reply_to_id ?? null,
        created_at,
        userLogin: c?.user?.login,
        html_url: c?.html_url || '',
        raw: c,
        children: [],
      };
      nodeMap.set(node.id, node);

      const discId = this.extractDiscussionIdFromUrl(c?.html_url);
      if (discId && !c?.in_reply_to_id) {
        if (!discussionMap.has(discId)) {
          discussionMap.set(discId, node.id);
        }
      }
    }

    return { nodeMap, discussionMap };
  }

  private linkCommentNodes(
    nodeMap: Map<number, CommentNode>,
    discussionMap: Map<number, number>,
  ): Set<number> {
    const linkedNodes = new Set<number>();

    for (const node of nodeMap.values()) {
      const rawParentId = node.parentId;
      if (!rawParentId) continue;

      if (nodeMap.has(rawParentId)) {
        this.linkDirectParent(nodeMap, node, rawParentId, linkedNodes);
      } else if (
        discussionMap.has(rawParentId) &&
        discussionMap.get(rawParentId) !== node.id
      ) {
        this.linkDiscussionParent(
          nodeMap,
          discussionMap,
          node,
          rawParentId,
          linkedNodes,
        );
      }
    }

    return linkedNodes;
  }

  private linkDirectParent(
    nodeMap: Map<number, CommentNode>,
    node: CommentNode,
    rawParentId: number,
    linkedNodes: Set<number>,
  ): void {
    const parent = nodeMap.get(rawParentId)!;
    parent.children.push(node);
    linkedNodes.add(node.id);
    console.log(
      `[TimelineService] Linked comment ${node.id} as child of comment ${rawParentId}`,
    );
  }

  private linkDiscussionParent(
    nodeMap: Map<number, CommentNode>,
    discussionMap: Map<number, number>,
    node: CommentNode,
    rawParentId: number,
    linkedNodes: Set<number>,
  ): void {
    const rootId = discussionMap.get(rawParentId)!;
    const parent = nodeMap.get(rootId);
    if (parent) {
      parent.children.push(node);
      linkedNodes.add(node.id);
    }
  }

  private collectRootNodes(
    nodeMap: Map<number, CommentNode>,
    linkedNodes: Set<number>,
  ): CommentNode[] {
    const roots: CommentNode[] = [];
    for (const node of nodeMap.values()) {
      if (!linkedNodes.has(node.id)) {
        roots.push(node);
      }
    }
    return roots;
  }

  private sortCommentNodes(
    roots: CommentNode[],
    nodeMap: Map<number, CommentNode>,
  ): void {
    const sortNodes = (arr: CommentNode[]) => {
      const sorted = arr.toSorted(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      arr.length = 0;
      arr.push(...sorted);
    };
    sortNodes(roots);
    for (const n of nodeMap.values()) {
      sortNodes(n.children);
    }
  }

  private flattenCommentTree(
    roots: CommentNode[],
    prUrl: string,
    timelineItems: TimelineItem[],
    firstReviewCommentTracker: {
      hasFirstReviewComment: boolean;
      firstReviewCommentTime: number | null;
    },
  ): void {
    const dfs = (n: CommentNode, indent = 0) => {
      const commentTime = new Date(n.created_at).getTime();
      // Only mark as first if it's a root comment (indent === 0),
      // matches the first review comment time, and no first review comment has been found yet
      const isFirstReviewComment =
        indent === 0 &&
        firstReviewCommentTracker.firstReviewCommentTime !== null &&
        commentTime === firstReviewCommentTracker.firstReviewCommentTime &&
        !firstReviewCommentTracker.hasFirstReviewComment;
      if (isFirstReviewComment) {
        firstReviewCommentTracker.hasFirstReviewComment = true;
      }

      const isCopilot = this.isCopilotUser(n.userLogin);
      const title = this.getReviewCommentTitle(isFirstReviewComment, isCopilot);

      timelineItems.push({
        type: 'review_comment',
        title,
        time: n.created_at,
        actor: n.userLogin,
        url: this.buildReviewCommentUrl(prUrl, n.id, n.html_url),
        parentId: n.raw?.in_reply_to_id ?? undefined,
        indentLevel: indent,
      });

      for (const c of n.children) {
        dfs(c, indent + 1);
      }
    };

    roots.forEach((r) => dfs(r, 0));
  }

  /**
   * Sort timeline items chronologically while preserving parent-child relationships.
   * Comments with parentId must appear immediately after their parent.
   */
  private sortTimelineWithParentChildPreservation(
    timelineItems: TimelineItem[],
  ): void {
    // Create maps: comment ID (from URL) -> timeline item, and parentId -> children array
    const parentIdToChildren = new Map<number, TimelineItem[]>();

    timelineItems.forEach((item) => {
      if (item.type === 'review_comment' && item.url) {
        const match = item.url.match(/discussion_r(\d+)/);
        if (match) {
          const commentId = Number.parseInt(match[1], 10);
          if (!Number.isNaN(commentId)) {
            // If this item has a parent, add it to parent's children
            if (item.parentId) {
              if (!parentIdToChildren.has(item.parentId)) {
                parentIdToChildren.set(item.parentId, []);
              }
              parentIdToChildren.get(item.parentId)!.push(item);
            }
          }
        }
      }
    });

    // Separate items: review comments without parents (roots), and other items
    const reviewCommentRoots: TimelineItem[] = [];
    const otherItems: TimelineItem[] = [];

    timelineItems.forEach((item) => {
      if (item.type === 'review_comment') {
        if (!item.parentId) {
          reviewCommentRoots.push(item);
        }
        // Items with parents are handled via parentIdToChildren
      } else {
        otherItems.push(item);
      }
    });

    // Build sorted array: process items chronologically, but keep children with parents
    const sorted: TimelineItem[] = [];
    const processed = new Set<TimelineItem>();

    // Helper to add a review comment and all its descendants
    const addCommentAndChildren = (item: TimelineItem) => {
      if (processed.has(item)) return;

      sorted.push(item);
      processed.add(item);

      // Find comment ID from URL
      const match = item.url?.match(/discussion_r(\d+)/);
      if (match) {
        const commentId = Number.parseInt(match[1], 10);
        if (!Number.isNaN(commentId)) {
          // Find all direct children
          const children = parentIdToChildren.get(commentId) || [];

          // Sort children by time
          const sortedChildren = [...children].sort(
            (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
          );

          // Add children recursively
          sortedChildren.forEach((child) => {
            if (!processed.has(child)) {
              addCommentAndChildren(child);
            }
          });
        }
      }
    };

    // Combine all root items and sort by time
    const allRootItems = [...reviewCommentRoots, ...otherItems];
    allRootItems.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );

    // Process items in chronological order
    for (const item of allRootItems) {
      if (item.type === 'review_comment') {
        addCommentAndChildren(item);
      } else {
        sorted.push(item);
        processed.add(item);
      }
    }

    // Add any remaining review comments with parents that weren't processed
    // (shouldn't happen if parent-child relationships are correct, but just in case)
    timelineItems.forEach((item) => {
      if (item.type === 'review_comment' && !processed.has(item)) {
        sorted.push(item);
      }
    });

    // Replace original array
    timelineItems.length = 0;
    timelineItems.push(...sorted);
  }

  /* ----------------------------- Force-pushed events ----------------------------- */
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
      const commitSha = event.commit_id || event.after || null;
      const beforeSha = event.before || null;
      const title = this.buildForcePushTitle(
        commitSha,
        index,
        forcePushedEvents.length,
      );
      const description = this.buildForcePushDescription(
        commitSha,
        beforeSha,
        event.ref,
      );
      const eventUrl = this.buildForcePushUrl(
        commitSha,
        owner,
        repo,
        prUrl,
        event.id,
      );

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

  private buildForcePushTitle(
    commitSha: string | null,
    index: number,
    totalEvents: number,
  ): string {
    if (commitSha) {
      const shortSha = commitSha.substring(0, 7);
      return `Force pushed to ${shortSha}`;
    }
    if (totalEvents > 1) {
      return `Force pushed (${index + 1})`;
    }
    return 'Force pushed';
  }

  private buildForcePushDescription(
    commitSha: string | null,
    beforeSha: string | null,
    ref: string | null | undefined,
  ): string | undefined {
    if (!commitSha) return undefined;

    const shortSha = commitSha.substring(0, 7);
    const details: string[] = [];
    if (beforeSha) {
      details.push(`Before: ${beforeSha.substring(0, 7)}`);
    }
    details.push(`After: ${shortSha}`);
    if (ref) {
      details.push(`Branch: ${ref}`);
    }
    return details.join(' • ');
  }

  private buildForcePushUrl(
    commitSha: string | null,
    owner: string,
    repo: string,
    prUrl: string,
    eventId?: number,
  ): string | undefined {
    if (commitSha && owner && repo) {
      return this.commitService.buildCommitUrl(owner, repo, commitSha);
    }
    if (eventId) {
      return this.buildEventUrl(prUrl, eventId);
    }
    return prUrl;
  }

  /* ----------------------------- Base ref changed events ----------------------------- */
  private addBaseRefChangedEvents(
    sortedEvents: GitHubEvent[],
    prUrl: string,
    timelineItems: TimelineItem[],
  ): void {
    const baseRefChangedEvents = sortedEvents.filter(
      (e) => e.event === 'base_ref_changed',
    );
    baseRefChangedEvents.forEach((event) => {
      const previousRef = event.previousRefName || 'unknown';
      const currentRef = event.currentRefName || 'unknown';
      const title = `Base branch changed from ${previousRef} to ${currentRef}`;
      const description = `Previous: ${previousRef} → Current: ${currentRef}`;
      const eventUrl = this.buildEventUrl(prUrl, event.id);

      timelineItems.push({
        type: 'base_ref_changed',
        title,
        time: event.created_at,
        actor: event.actor?.login,
        url: eventUrl,
        description,
      });
    });
  }

  /* ----------------------------- Merge ----------------------------- */
  private addMergeEvent(
    prDetails: GitHubPullRequestDetail,
    owner: string,
    repo: string,
    prUrl: string,
    timelineItems: TimelineItem[],
  ): void {
    if (!prDetails.merged_at) return;

    const mergeCommitSha = prDetails.merge_commit_sha;
    let mergeUrl: string | undefined;
    if (mergeCommitSha && owner && repo)
      mergeUrl = this.commitService.buildCommitUrl(owner, repo, mergeCommitSha);
    else if (prUrl) mergeUrl = prUrl;

    timelineItems.push({
      type: 'merged',
      title: 'Merged',
      time: prDetails.merged_at,
      actor: prDetails.merged_by?.login,
      url: mergeUrl,
    });
  }
}
