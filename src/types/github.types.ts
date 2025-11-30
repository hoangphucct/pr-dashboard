/**
 * GitHub API related types
 */

export interface GitHubCommit {
  sha: string;
  parents?: Array<{ sha: string }>;
  commit: {
    committer: {
      date: string;
    };
    author: {
      date: string;
    };
    message: string;
  };
}

export interface GitHubReview {
  id: number;
  state: string;
  submitted_at: string;
  body?: string;
  html_url?: string;
  user?: {
    login: string;
  };
}

export interface GitHubComment {
  id: number;
  created_at: string;
  body?: string;
  html_url?: string;
  user?: {
    login: string;
  };
}

export interface GitHubLabel {
  name: string;
  color: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  html_url: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  merge_commit_sha?: string;
  merged_by?: {
    login: string;
  };
  labels?: GitHubLabel[];
  base: {
    sha: string;
    ref: string;
    repo?: {
      owner?: { login: string };
      name: string;
    };
  };
  head: {
    sha: string;
    ref: string;
  };
  user?: {
    login: string;
  };
}

export interface GitHubPullRequestDetail extends GitHubPullRequest {
  reviews: GitHubReview[];
  comments: GitHubComment[];
  review_comments: GitHubComment[];
  commits: GitHubCommit[];
  changed_files?: number;
  additions?: number;
  deletions?: number;
}

export interface GitHubEvent {
  id: number;
  event: string;
  created_at: string;
  actor?: { login: string };
  label?: { name: string };
  commit_id?: string | null;
  commit_url?: string | null;
  // Force push specific fields
  before?: string | null;
  after?: string | null;
  ref?: string | null;
}
