import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

interface GitHubCommit {
  sha: string;
  parents: Array<{ sha: string }>;
  commit: {
    author: {
      date: string;
    };
    message: string;
  };
}

interface GitHubReview {
  id: number;
  state: string;
  submitted_at: string;
  user: {
    login: string;
  };
}

interface GitHubComment {
  id: number;
  created_at: string;
  user: {
    login: string;
  };
}

interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  html_url: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  base: {
    sha: string;
    ref: string;
  };
  head: {
    sha: string;
    ref: string;
  };
  user: {
    login: string;
  };
}

export interface GitHubPullRequestDetail extends GitHubPullRequest {
  reviews: GitHubReview[];
  comments: GitHubComment[];
  review_comments: GitHubComment[];
  commits: GitHubCommit[];
}

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
    const [pr, commits, reviews, comments, reviewComments] = await Promise.all([
      this.apiClient.get<GitHubPullRequest>(
        `/repos/${this.owner}/${this.repo}/pulls/${prNumber}`,
      ),
      this.apiClient.get<GitHubCommit[]>(
        `/repos/${this.owner}/${this.repo}/pulls/${prNumber}/commits`,
      ),
      this.apiClient.get<GitHubReview[]>(
        `/repos/${this.owner}/${this.repo}/pulls/${prNumber}/reviews`,
      ),
      this.apiClient.get<GitHubComment[]>(
        `/repos/${this.owner}/${this.repo}/issues/${prNumber}/comments`,
      ),
      this.apiClient.get<GitHubComment[]>(
        `/repos/${this.owner}/${this.repo}/pulls/${prNumber}/comments`,
      ),
    ]);

    return {
      ...pr.data,
      commits: commits.data,
      reviews: reviews.data,
      comments: comments.data,
      review_comments: reviewComments.data,
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
}
