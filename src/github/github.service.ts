import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type {
  GitHubCommit,
  GitHubLabel,
  GitHubPullRequest,
  GitHubPullRequestDetail,
} from '@shared/github.types';

@Injectable()
export class GitHubService {
  private readonly apiClient: AxiosInstance;
  private readonly owner: string;
  private readonly repo: string;

  constructor(private readonly configService: ConfigService) {
    this.owner = this.configService.get<string>('GITHUB_OWNER', 'owner');
    this.repo = this.configService.get<string>('GITHUB_REPO', 'repo');
    const token = this.configService.get<string>('GITHUB_TOKEN', '');

    this.apiClient = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: 'application/vnd.github.v3+json',
      },
    });
  }

  /**
   * Fetch pull request details including commits, reviews, and comments
   */
  async getPullRequestDetails(
    prNumber: number,
  ): Promise<GitHubPullRequestDetail> {
    const [pr, commits, reviews, comments, reviewComments, issue] =
      await Promise.all([
        this.apiClient.get<
          GitHubPullRequest & {
            changed_files?: number;
            additions?: number;
            deletions?: number;
          }
        >(`/repos/${this.owner}/${this.repo}/pulls/${prNumber}`),
        this.apiClient.get<GitHubCommit[]>(
          `/repos/${this.owner}/${this.repo}/pulls/${prNumber}/commits`,
        ),
        this.apiClient.get<GitHubPullRequestDetail['reviews']>(
          `/repos/${this.owner}/${this.repo}/pulls/${prNumber}/reviews`,
        ),
        this.apiClient.get<GitHubPullRequestDetail['comments']>(
          `/repos/${this.owner}/${this.repo}/issues/${prNumber}/comments`,
        ),
        this.apiClient.get<GitHubPullRequestDetail['review_comments']>(
          `/repos/${this.owner}/${this.repo}/pulls/${prNumber}/comments`,
        ),
        this.apiClient.get<{ labels?: GitHubLabel[] }>(
          `/repos/${this.owner}/${this.repo}/issues/${prNumber}`,
        ),
      ]);

    return {
      ...pr.data,
      commits: commits.data,
      reviews: reviews.data,
      comments: comments.data,
      review_comments: reviewComments.data,
      changed_files: pr.data.changed_files,
      additions: pr.data.additions,
      deletions: pr.data.deletions,
      labels: issue.data.labels || pr.data.labels || [],
    };
  }

  /**
   * Get PR events to track state changes (draft to open, etc.)
   */
  async getPullRequestEvents(prNumber: number): Promise<unknown[]> {
    const response = await this.apiClient.get<unknown[]>(
      `/repos/${this.owner}/${this.repo}/issues/${prNumber}/events`,
    );
    return response.data;
  }

  /**
   * Get commits from base branch to compare with PR commits
   */
  async getBaseBranchCommits(prNumber: number): Promise<string[]> {
    try {
      const pr = await this.apiClient.get<GitHubPullRequest>(
        `/repos/${this.owner}/${this.repo}/pulls/${prNumber}`,
      );
      const baseSha = pr.data.base.sha;
      const headSha = pr.data.head.sha;

      // Get commits from base to head (commits unique to this PR)
      const response = await this.apiClient.get<{ commits: GitHubCommit[] }>(
        `/repos/${this.owner}/${this.repo}/compare/${baseSha}...${headSha}`,
      );
      return response.data.commits?.map((commit) => commit.sha) || [];
    } catch (error) {
      console.error('Error fetching base branch commits:', error);
      return [];
    }
  }

  /**
   * Get PR updated_at timestamp from GitHub API (lightweight call)
   */
  async getPullRequestUpdatedAt(prNumber: number): Promise<string> {
    try {
      const response = await this.apiClient.get<{ updated_at: string }>(
        `/repos/${this.owner}/${this.repo}/pulls/${prNumber}`,
      );
      return response.data.updated_at || '';
    } catch (error) {
      console.error(`Error fetching PR updated_at for PR ${prNumber}:`, error);
      return '';
    }
  }

  /**
   * Get all pull requests created on a specific date
   */
  async getPullRequestsByDate(date: string): Promise<GitHubPullRequest[]> {
    try {
      // Format date as YYYY-MM-DD
      const startDate = `${date}T00:00:00Z`;
      const endDate = `${date}T23:59:59Z`;

      const allPRs: GitHubPullRequest[] = [];
      let page = 1;
      const perPage = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await this.apiClient.get<GitHubPullRequest[]>(
          `/repos/${this.owner}/${this.repo}/pulls`,
          {
            params: {
              state: 'all', // Get all PRs (open, closed, merged)
              sort: 'created',
              direction: 'desc',
              per_page: perPage,
              page,
            },
          },
        );

        const prs = response.data;
        if (prs.length === 0) {
          break;
        }

        // Filter PRs created on the specified date
        for (const pr of prs) {
          const prCreatedAt = new Date(pr.created_at);
          const start = new Date(startDate);
          const end = new Date(endDate);

          if (prCreatedAt >= start && prCreatedAt <= end) {
            allPRs.push(pr);
          } else if (prCreatedAt < start) {
            // Since PRs are sorted by created date desc, if we find one before our date, we can stop
            hasMore = false;
            break;
          }
        }

        // If we got less than perPage results, we've reached the end
        if (prs.length < perPage) {
          hasMore = false;
        } else {
          page++;
        }
      }

      return allPRs;
    } catch (error) {
      console.error('Error fetching PRs by date:', error);
      return [];
    }
  }
}
