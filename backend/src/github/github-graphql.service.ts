import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type {
  GitHubPullRequestDetail,
  GraphQLResponse,
  GitHubGraphQLPRTimelineResponse,
} from '@shared/github.types';
import { PR_TIMELINE_QUERY } from './queries';

@Injectable()
export class GitHubGraphQLService {
  private readonly apiClient: AxiosInstance;
  private readonly owner: string;
  private readonly repo: string;

  constructor(private readonly configService: ConfigService) {
    this.owner = this.configService.get<string>('GITHUB_OWNER', 'owner');
    this.repo = this.configService.get<string>('GITHUB_REPO', 'repo');
    const token = this.configService.get<string>('GITHUB_TOKEN', '');

    this.apiClient = axios.create({
      baseURL: 'https://api.github.com/graphql',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch pull request timeline data using GraphQL
   */
  async getPullRequestTimeline(
    prNumber: number,
  ): Promise<GitHubPullRequestDetail | null> {
    try {
      const response = await this.apiClient.post<
        GraphQLResponse<GitHubGraphQLPRTimelineResponse>
      >('', {
        query: PR_TIMELINE_QUERY,
        variables: {
          owner: this.owner,
          repo: this.repo,
          prNumber,
        },
      });

      if (response.data.errors) {
        console.error('GraphQL errors:', response.data.errors);
        return null;
      }

      const pr = response.data.data.repository?.pullRequest;
      if (!pr) {
        return null;
      }

      // Transform GraphQL response to match GitHubPullRequestDetail interface
      return this.transformGraphQLResponse(pr);
    } catch (error) {
      console.error('Error fetching PR timeline via GraphQL:', error);
      return null;
    }
  }

  /**
   * Transform GraphQL response to GitHubPullRequestDetail format
   */
  private transformGraphQLResponse(
    pr: NonNullable<
      GitHubGraphQLPRTimelineResponse['repository']['pullRequest']
    >,
  ): GitHubPullRequestDetail {
    // Transform commits - filter out nodes with missing commit data
    const commits = pr.commits.nodes
      .filter((node) => node?.commit)
      .map((node) => {
        const commit = node.commit;
        const commitDate =
          commit.committer?.date ||
          commit.committedDate ||
          new Date().toISOString();
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
      user: node.author
        ? {
            login: node.author.login,
          }
        : undefined,
    }));

    // Transform issue comments
    const comments = pr.comments.nodes.map((node) => ({
      id: Number.parseInt(node.id, 10),
      created_at: node.createdAt,
      body: node.body,
      html_url: node.url,
      user: node.author
        ? {
            login: node.author.login,
          }
        : undefined,
    }));

    // Transform review comments (from reviewThreads)
    const review_comments: Array<{
      id: number;
      created_at: string;
      body: string;
      html_url: string;
      user?: { login: string };
      in_reply_to_id?: number;
    }> = [];

    pr.reviewThreads.nodes.forEach((thread) => {
      thread.comments.nodes.forEach((comment) => {
        if (comment.isMinimized) return; // Skip minimized comments

        review_comments.push({
          id: Number.parseInt(comment.id, 10),
          created_at: comment.createdAt,
          body: comment.body,
          html_url: comment.url,
          user: comment.author
            ? {
                login: comment.author.login,
              }
            : undefined,
          in_reply_to_id: comment.replyTo
            ? Number.parseInt(comment.replyTo.id, 10)
            : undefined,
        });
      });
    });

    // Transform timeline events
    const events = pr.timelineItems.nodes
      .map((node) => {
        const baseEvent = {
          id: node.id ? Number.parseInt(node.id, 10) : 0,
          created_at: node.createdAt || '',
          actor: node.actor
            ? {
                login: node.actor.login || '',
              }
            : undefined,
        };

        if (node.__typename === 'ReadyForReviewEvent') {
          return {
            ...baseEvent,
            event: 'ready_for_review',
          };
        }

        if (node.__typename === 'ReviewRequestedEvent') {
          return {
            ...baseEvent,
            event: 'review_requested',
          };
        }

        if (node.__typename === 'HeadRefForcePushedEvent') {
          return {
            ...baseEvent,
            event: 'head_ref_force_pushed',
            before: node.beforeCommit?.oid || null,
            after: node.afterCommit?.oid || null,
            commit_id: node.afterCommit?.oid || null,
            ref: node.ref?.name || null,
          };
        }

        return null;
      })
      .filter((event) => event !== null);

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
      merged_by: pr.mergedBy
        ? {
            login: pr.mergedBy.login,
          }
        : undefined,
      labels: pr.labels.nodes.map((label) => ({
        name: label.name,
        color: label.color,
      })),
      base: {
        sha: pr.baseRef.target.oid,
        ref: pr.baseRef.name,
        repo: {
          owner: {
            login: pr.baseRef.repository.owner.login,
          },
          name: pr.baseRef.repository.name,
        },
      },
      head: {
        sha: pr.headRef.target.oid,
        ref: '',
      },
      user: pr.author
        ? {
            login: pr.author.login,
          }
        : undefined,
      commits,
      reviews,
      comments,
      review_comments,
      changed_files: pr.changedFiles,
      additions: pr.additions,
      deletions: pr.deletions,
      // Store events in a custom property for now
      _events: events,
    } as GitHubPullRequestDetail & { _events?: unknown[] };
  }

  /**
   * Get PR events from GraphQL response
   */
  getEventsFromPRDetails(
    prDetails: GitHubPullRequestDetail & { _events?: unknown[] },
  ): unknown[] {
    return prDetails._events || [];
  }

  /**
   * Get base branch commits (for comparison)
   */
  async getBaseBranchCommits(prNumber: number): Promise<string[]> {
    const prData = await this.getPullRequestTimeline(prNumber);
    if (!prData) {
      return [];
    }

    // For GraphQL, we can get base SHA and compare
    // This is a simplified version - you might need to fetch base commits separately
    return [];
  }
}
