import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type {
  GitHubPullRequest,
  GitHubPullRequestDetail,
  GitHubGraphQLPullRequestResponse,
  GraphQLResponse,
  GitHubGraphQLPRDetailsResponse,
  GitHubGraphQLReviewThreads,
  GitHubGraphQLReviewThread,
  GitHubGraphQLReviewThreadCommentNode,
  GitHubGraphQLReviewThreadCommentsResponse,
  GitHubGraphQLReviewThreadsResponse,
  GitHubGraphQLPRListResponse,
  GitHubGraphQLPRListItem,
  TransformedReviewComment,
  GitHubGraphQLPageInfo,
} from '@shared/github.types';
import {
  PR_DETAILS_QUERY,
  PRS_BY_DATE_QUERY,
  GET_THREAD_COMMENTS_QUERY,
  GET_REVIEW_THREADS_QUERY,
} from './queries';

@Injectable()
export class GitHubService {
  private readonly graphQLClient: AxiosInstance;
  private readonly owner: string;
  private readonly repo: string;

  constructor(private readonly configService: ConfigService) {
    this.owner = this.configService.get<string>('GITHUB_OWNER', 'owner');
    this.repo = this.configService.get<string>('GITHUB_REPO', 'repo');
    const token = this.configService.get<string>('GITHUB_TOKEN', '');

    this.graphQLClient = axios.create({
      baseURL: 'https://api.github.com/graphql',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch pull request details including commits, reviews, and comments
   * Uses GraphQL API
   */
  async getPullRequestDetails(
    prNumber: number,
  ): Promise<GitHubPullRequestDetail> {
    try {
      const response = await this.graphQLClient.post<
        GraphQLResponse<GitHubGraphQLPRDetailsResponse>
      >('', {
        query: PR_DETAILS_QUERY,
        variables: {
          owner: this.owner,
          repo: this.repo,
          prNumber,
        },
      });

      if (response.data.errors) {
        console.error('GraphQL errors:', response.data.errors);
        throw new Error(
          `GraphQL errors: ${response.data.errors.map((e) => e.message).join(', ')}`,
        );
      }
      console.log(response.data.data);
      const pr = response.data.data.repository?.pullRequest;
      if (!pr) {
        throw new Error(`PR #${prNumber} not found`);
      }

      // Fetch all review comments with pagination
      const allReviewComments = await this.fetchAllReviewComments(
        prNumber,
        pr.reviewThreads,
      );

      // Merge paginated review comments into pr object
      const prWithAllComments = {
        ...pr,
        reviewThreads: {
          ...pr.reviewThreads,
          nodes: allReviewComments,
        },
      };

      return this.transformGraphQLPRResponse(prWithAllComments);
    } catch (error) {
      console.error('Error fetching PR details via GraphQL:', error);
      throw error;
    }
  }

  /**
   * Fetch all review comments with pagination
   */
  private async fetchAllReviewComments(
    prNumber: number,
    initialThreads: GitHubGraphQLReviewThreads,
  ): Promise<Array<GitHubGraphQLReviewThread>> {
    const allThreads: Array<GitHubGraphQLReviewThread> = [];

    // Process initial threads
    for (const thread of initialThreads.nodes) {
      const processedThread = await this.processThreadWithComments(
        prNumber,
        thread,
      );
      allThreads.push(processedThread);
    }

    // Fetch paginated threads if needed
    await this.fetchPaginatedThreads(prNumber, initialThreads, allThreads);

    return allThreads;
  }

  private async processThreadWithComments(
    prNumber: number,
    thread: GitHubGraphQLReviewThread,
  ): Promise<GitHubGraphQLReviewThread> {
    const allComments: Array<GitHubGraphQLReviewThreadCommentNode> = [
      ...thread.comments.nodes,
    ];

    const paginatedComments = await this.fetchPaginatedComments(
      prNumber,
      thread.id,
      thread.comments.pageInfo,
    );
    allComments.push(...paginatedComments);

    return {
      id: thread.id,
      comments: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: allComments,
      },
    };
  }

  private async fetchPaginatedComments(
    prNumber: number,
    threadId: string,
    pageInfo: GitHubGraphQLPageInfo,
  ): Promise<Array<GitHubGraphQLReviewThreadCommentNode>> {
    const allComments: Array<GitHubGraphQLReviewThreadCommentNode> = [];
    let commentCursor: string | null = pageInfo.endCursor;

    while (pageInfo.hasNextPage && commentCursor) {
      try {
        const response = await this.fetchThreadCommentsPage(
          prNumber,
          threadId,
          commentCursor,
        );

        if (!response) {
          break;
        }

        allComments.push(...response.nodes);
        commentCursor = response.pageInfo.endCursor;
        if (!response.pageInfo.hasNextPage) {
          break;
        }
      } catch (error) {
        console.error('Error fetching thread comments:', error);
        break;
      }
    }

    return allComments;
  }

  private async fetchThreadCommentsPage(
    prNumber: number,
    threadId: string,
    after: string,
  ): Promise<{
    pageInfo: GitHubGraphQLPageInfo;
    nodes: Array<GitHubGraphQLReviewThreadCommentNode>;
  } | null> {
    const commentResponse = await this.graphQLClient.post<
      GraphQLResponse<GitHubGraphQLReviewThreadCommentsResponse>
    >('', {
      query: GET_THREAD_COMMENTS_QUERY,
      variables: {
        owner: this.owner,
        repo: this.repo,
        prNumber,
        threadId,
        after,
      },
    });

    if (
      commentResponse.data.errors ||
      !commentResponse.data.data.repository?.pullRequest?.reviewThread
    ) {
      return null;
    }

    const threadData =
      commentResponse.data.data.repository.pullRequest.reviewThread;
    return threadData.comments;
  }

  private async fetchPaginatedThreads(
    prNumber: number,
    initialThreads: GitHubGraphQLReviewThreads,
    allThreads: Array<GitHubGraphQLReviewThread>,
  ): Promise<void> {
    let threadCursor: string | null = initialThreads.pageInfo.endCursor;

    while (initialThreads.pageInfo.hasNextPage && threadCursor) {
      try {
        const threadsData = await this.fetchThreadsPage(prNumber, threadCursor);

        if (!threadsData) {
          break;
        }

        for (const thread of threadsData.nodes) {
          const processedThread = await this.processThreadWithComments(
            prNumber,
            thread,
          );
          allThreads.push(processedThread);
        }

        threadCursor = threadsData.pageInfo.endCursor;
        if (!threadsData.pageInfo.hasNextPage) {
          break;
        }
      } catch (error) {
        console.error('Error fetching review threads:', error);
        break;
      }
    }
  }

  private async fetchThreadsPage(
    prNumber: number,
    after: string,
  ): Promise<GitHubGraphQLReviewThreads | null> {
    const threadResponse = await this.graphQLClient.post<
      GraphQLResponse<GitHubGraphQLReviewThreadsResponse>
    >('', {
      query: GET_REVIEW_THREADS_QUERY,
      variables: {
        owner: this.owner,
        repo: this.repo,
        prNumber,
        after,
      },
    });

    if (
      threadResponse.data.errors ||
      !threadResponse.data.data.repository?.pullRequest?.reviewThreads
    ) {
      return null;
    }

    return threadResponse.data.data.repository.pullRequest.reviewThreads;
  }

  /**
   * Transform GraphQL PR response to GitHubPullRequestDetail format
   */
  private transformGraphQLPRResponse(
    pr: GitHubGraphQLPullRequestResponse,
  ): GitHubPullRequestDetail {
    // Transform commits - filter out nodes with missing commit data
    const commits = pr.commits.nodes
      .filter((node) => node?.commit)
      .map((node) => {
        const commit = node.commit;
        const commitDate =
          commit.committer?.date || commit.committedDate || new Date().toISOString();
        return {
          sha: commit.oid,
          commit: {
            committer: {
              date: commitDate,
              name: commit.committer?.name,
              user: commit.committer?.user,
            },
            author: {
              date: commitDate,
            },
            message: commit.message,
          },
          parents: commit.parents?.nodes?.map((p) => ({ sha: p.oid })) || [],
        };
      });

    // Transform reviews
    const reviews = pr.reviews.nodes.map((node) => ({
      id: Number.parseInt(node.id, 10),
      state: node.state,
      submitted_at: node.submittedAt,
      body: node.body || undefined,
      html_url: node.url,
      user: node.author ? { login: node.author.login } : undefined,
    }));

    // Transform issue comments
    const comments = pr.comments.nodes.map((node) => ({
      id: Number.parseInt(node.id, 10),
      created_at: node.createdAt,
      body: node.body,
      html_url: node.url,
      user: node.author ? { login: node.author.login } : undefined,
    }));

    // Transform review comments (from reviewThreads)
    const review_comments: Array<TransformedReviewComment> = [];

    pr.reviewThreads.nodes.forEach((thread) => {
      thread.comments.nodes.forEach((comment) => {
        // Handle missing or invalid ID - generate a temporary ID based on URL or use a hash
        const commentId: number = Number.parseInt(comment.id, 10);

        // Use current timestamp if createdAt is missing instead of skipping
        const createdAt = comment.createdAt || new Date().toISOString();
        if (!comment.createdAt) {
          console.warn(
            `Comment ${commentId} missing createdAt, using current timestamp: ${createdAt}`,
          );
        }

        review_comments.push({
          id: commentId,
          created_at: createdAt,
          body: comment.body || '',
          html_url: comment.url || '',
          user: comment.author ? { login: comment.author.login } : undefined,
          in_reply_to_id: comment.replyTo
            ? Number.parseInt(comment.replyTo.id, 10)
            : undefined,
        });
      });
    });

    return {
      number: pr.number,
      title: pr.title,
      state: pr.state.toLowerCase(),
      draft: pr.isDraft,
      html_url: pr.url,
      created_at: pr.createdAt,
      updated_at: pr.updatedAt,
      merged_at: pr.mergedAt,
      merge_commit_sha: pr.mergeCommit?.oid,
      merged_by: pr.mergedBy ? { login: pr.mergedBy.login } : undefined,
      labels: pr.labels.nodes.map((label) => ({
        name: label.name,
        color: label.color,
      })),
      base: {
        sha: pr.baseRef.target.oid,
        ref: pr.baseRef.name,
        repo: {
          owner: { login: pr.baseRef.repository.owner.login },
          name: this.repo, // Use repo name from config
        },
      },
      head: {
        sha: pr.headRef.target.oid,
        ref: pr.headRef.name,
      },
      user: pr.author ? { login: pr.author.login } : undefined,
      commits,
      reviews,
      comments,
      review_comments,
      changed_files: pr.changedFiles,
      additions: pr.additions,
      deletions: pr.deletions,
      _events: pr.timelineItems.nodes
        .map((node) => {
          const baseEvent = {
            id: node.id ? Number.parseInt(node.id, 10) : 0,
            created_at: node.createdAt || '',
            actor: node.actor ? { login: node.actor.login || '' } : undefined,
          };

          if (node.__typename === 'ReadyForReviewEvent') {
            return { ...baseEvent, event: 'ready_for_review' };
          }
          if (node.__typename === 'ReviewRequestedEvent') {
            return { ...baseEvent, event: 'review_requested' };
          }
          if (node.__typename === 'HeadRefForcePushedEvent') {
            return {
              ...baseEvent,
              event: 'head_ref_force_pushed',
              before: node.beforeCommit?.oid || null,
              after: node.afterCommit?.oid || null,
              commit_id: node.afterCommit?.oid || null,
              ref: null, // Branch name not available without read:org scope
            };
          }
          if (node.__typename === 'BaseRefChangedEvent') {
            return {
              ...baseEvent,
              event: 'base_ref_changed',
              previousRefName: node.previousRefName || null,
              currentRefName: node.currentRefName || null,
            };
          }
          return null;
        })
        .filter((e) => e !== null),
    } as GitHubPullRequestDetail & { _events?: unknown[] };
  }

  /**
   * Get PR events to track state changes (draft to open, etc.)
   * Uses GraphQL API - events are included in getPullRequestDetails response
   */
  async getPullRequestEvents(prNumber: number): Promise<unknown[]> {
    const prDetails = await this.getPullRequestDetails(prNumber);
    return (
      (prDetails as GitHubPullRequestDetail & { _events?: unknown[] })
        ._events || []
    );
  }

  /**
   * Get commits from base branch to compare with PR commits
   * Uses GraphQL API - commits are already included in getPullRequestDetails response
   * @param _prNumber - PR number (unused, kept for interface compatibility)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getBaseBranchCommits(_prNumber: number): Promise<string[]> {
    // For GraphQL, we already have commits in the response
    // Return empty array as base commits comparison is handled differently
    // The commits from PR details are already the PR-specific commits
    return Promise.resolve([]);
  }

  /**
   * Get all pull requests created on a specific date
   * Uses GraphQL API
   */
  async getPullRequestsByDate(date: string): Promise<GitHubPullRequest[]> {
    try {
      const { startDate, endDate } = this.parseDateRange(date);
      const allPRs: GitHubPullRequest[] = [];
      let cursor: string | null = null;
      let hasMore = true;

      while (hasMore) {
        const response = await this.fetchPRsPage(cursor);

        if (!response) {
          break;
        }

        const { prs, pageInfo } = response;
        if (prs.length === 0) {
          break;
        }

        const { filteredPRs, shouldStop } = this.filterPRsByDate(
          prs,
          startDate,
          endDate,
        );
        allPRs.push(...filteredPRs);

        if (shouldStop) {
          break;
        }

        if (pageInfo?.hasNextPage && pageInfo.endCursor) {
          cursor = pageInfo.endCursor;
        } else {
          hasMore = false;
        }
      }

      return allPRs;
    } catch (error) {
      console.error('Error fetching PRs by date via GraphQL:', error);
      return [];
    }
  }

  private parseDateRange(date: string): { startDate: string; endDate: string } {
    return {
      startDate: `${date}T00:00:00Z`,
      endDate: `${date}T23:59:59Z`,
    };
  }

  private async fetchPRsPage(cursor: string | null): Promise<{
    prs: Array<GitHubGraphQLPRListItem>;
    pageInfo: GitHubGraphQLPageInfo | undefined;
  } | null> {
    const response = await this.graphQLClient.post<
      GraphQLResponse<GitHubGraphQLPRListResponse>
    >('', {
      query: PRS_BY_DATE_QUERY,
      variables: {
        owner: this.owner,
        repo: this.repo,
        after: cursor,
      },
    });

    if (response.data.errors) {
      console.error('GraphQL errors:', response.data.errors);
      return null;
    }

    const prs = response.data.data.repository?.pullRequests.nodes || [];
    const pageInfo = response.data.data.repository?.pullRequests.pageInfo;

    return { prs, pageInfo };
  }

  private filterPRsByDate(
    prs: Array<GitHubGraphQLPRListItem>,
    startDate: string,
    endDate: string,
  ): {
    filteredPRs: GitHubPullRequest[];
    shouldStop: boolean;
  } {
    const filteredPRs: GitHubPullRequest[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    let shouldStop = false;

    for (const pr of prs) {
      const prCreatedAt = new Date(pr.createdAt);

      if (prCreatedAt >= start && prCreatedAt <= end) {
        filteredPRs.push(this.transformPRListItem(pr));
      } else if (prCreatedAt < start) {
        // Since PRs are sorted by created date desc, if we find one before our date, we can stop
        shouldStop = true;
        break;
      }
    }

    return { filteredPRs, shouldStop };
  }

  private transformPRListItem(pr: GitHubGraphQLPRListItem): GitHubPullRequest {
    return {
      number: pr.number,
      title: pr.title,
      state: pr.state.toLowerCase(),
      draft: pr.isDraft,
      html_url: pr.url,
      created_at: pr.createdAt,
      updated_at: pr.updatedAt,
      merged_at: pr.mergedAt,
      merge_commit_sha: pr.mergeCommit?.oid,
      merged_by: pr.mergedBy ? { login: pr.mergedBy.login } : undefined,
      labels: pr.labels.nodes.map((label) => ({
        name: label.name,
        color: label.color,
      })),
      base: {
        sha: pr.baseRef.target.oid,
        ref: pr.baseRef.name,
        repo: {
          owner: { login: pr.baseRef.repository.owner.login },
          name: this.repo, // Use repo name from config
        },
      },
      head: {
        sha: pr.headRef.target.oid,
        ref: pr.headRef.name,
      },
      user: pr.author ? { login: pr.author.login } : undefined,
    };
  }
}
