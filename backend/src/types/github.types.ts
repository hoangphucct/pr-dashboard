/**
 * GitHub API related types
 */

export interface GitHubCommit {
  sha: string;
  parents?: Array<{ sha: string }>;
  commit: {
    committer: {
      name?: string;
      email?: string;
      date: string;
      user?: {
        login: string;
      };
    };
    author: {
      name?: string;
      email?: string;
      date: string;
      user?: {
        login: string;
      };
    };
    message: string;
  };
  // For REST API compatibility
  author?: {
    login: string;
  };
  committer?: {
    login: string;
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
  in_reply_to_id?: number;
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
  // Base ref changed specific fields
  previousRefName?: string | null;
  currentRefName?: string | null;
}

/**
 * GraphQL response types for GitHub Pull Request
 */
export interface GitHubGraphQLPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface GitHubGraphQLCommitActor {
  date: string;
  name?: string;
  email?: string;
  user?: { login: string } | null;
}

export interface GitHubGraphQLCommit {
  oid: string;
  message: string;
  committedDate: string;
  committer?: GitHubGraphQLCommitActor;
  author?: GitHubGraphQLCommitActor;
  parents: { nodes: Array<{ oid: string }> };
}

export interface GitHubGraphQLReview {
  id: string;
  state: string;
  submittedAt: string;
  body: string | null;
  url: string;
  author: { login: string } | null;
}

export interface GitHubGraphQLComment {
  id: string;
  createdAt: string;
  body: string;
  url: string;
  author: { login: string } | null;
}

export interface GitHubGraphQLReviewThreadComment extends GitHubGraphQLComment {
  replyTo: { id: string } | null;
  isMinimized: boolean;
}

export interface GitHubGraphQLReviewThread {
  id: string;
  comments: {
    pageInfo: GitHubGraphQLPageInfo;
    nodes: Array<GitHubGraphQLReviewThreadComment>;
  };
}

export interface GitHubGraphQLTimelineItem {
  __typename: string;
  id?: string;
  createdAt?: string;
  actor?: { login?: string } | null;
  beforeCommit?: { oid: string } | null;
  afterCommit?: { oid: string } | null;
  currentRefName?: string;
  previousRefName?: string;
}

export interface GitHubGraphQLPullRequestResponse {
  id: string;
  number: number;
  title: string;
  state: string;
  isDraft: boolean;
  url: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  mergeCommit: { oid: string } | null;
  mergedBy: { login: string } | null;
  baseRef: {
    name: string;
    target: { oid: string };
    repository: { owner: { login: string } };
  };
  headRef: {
    name: string;
    target: { oid: string };
  };
  author: { login: string };
  labels: { nodes: Array<{ name: string; color: string }> };
  commits: {
    nodes: Array<{
      commit: GitHubGraphQLCommit;
    }>;
  };
  reviews: {
    nodes: Array<GitHubGraphQLReview>;
  };
  comments: {
    nodes: Array<GitHubGraphQLComment>;
  };
  reviewThreads: {
    pageInfo: GitHubGraphQLPageInfo;
    nodes: Array<GitHubGraphQLReviewThread>;
  };
  timelineItems: {
    nodes: Array<GitHubGraphQLTimelineItem>;
  };
  additions: number;
  deletions: number;
  changedFiles: number;
}

/**
 * Extended timeline item with additional fields for timeline query
 */
export interface GitHubGraphQLTimelineItemExtended extends GitHubGraphQLTimelineItem {
  requestedReviewer?: {
    login?: string;
    name?: string;
  } | null;
  ref?: {
    name: string;
  } | null;
}

/**
 * GraphQL response wrapper
 */
export interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

/**
 * PR Details Response from GraphQL API
 * Used for getPullRequestDetails query
 */
export interface GitHubGraphQLPRDetailsResponse {
  repository: {
    pullRequest: GitHubGraphQLPullRequestResponse | null;
  };
}

/**
 * Review thread comment structure
 */
export interface GitHubGraphQLReviewThreadCommentNode {
  id: string;
  createdAt: string;
  body: string;
  url: string;
  author: { login: string } | null;
  replyTo: { id: string } | null;
  isMinimized: boolean;
}

/**
 * Review thread structure
 */
export interface GitHubGraphQLReviewThread {
  id: string;
  comments: {
    pageInfo: GitHubGraphQLPageInfo;
    nodes: Array<GitHubGraphQLReviewThreadCommentNode>;
  };
}

/**
 * Review threads structure with pagination
 */
export interface GitHubGraphQLReviewThreads {
  pageInfo: GitHubGraphQLPageInfo;
  nodes: Array<GitHubGraphQLReviewThread>;
}

/**
 * Review thread comments response from GraphQL
 */
export interface GitHubGraphQLReviewThreadCommentsResponse {
  repository: {
    pullRequest: {
      reviewThread: {
        comments: {
          pageInfo: GitHubGraphQLPageInfo;
          nodes: Array<GitHubGraphQLReviewThreadCommentNode>;
        };
      } | null;
    } | null;
  };
}

/**
 * Review threads response from GraphQL
 */
export interface GitHubGraphQLReviewThreadsResponse {
  repository: {
    pullRequest: {
      reviewThreads: GitHubGraphQLReviewThreads | null;
    } | null;
  };
}

/**
 * PR list item for date range queries
 */
export interface GitHubGraphQLPRListItem {
  number: number;
  title: string;
  state: string;
  isDraft: boolean;
  url: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  mergeCommit: { oid: string } | null;
  mergedBy: { login: string } | null;
  baseRef: {
    name: string;
    target: { oid: string };
    repository: { owner: { login: string } };
  };
  headRef: {
    name: string;
    target: { oid: string };
  };
  author: { login: string };
  labels: { nodes: Array<{ name: string; color: string }> };
}

/**
 * PR list response from GraphQL
 */
export interface GitHubGraphQLPRListResponse {
  repository: {
    pullRequests: {
      nodes: Array<GitHubGraphQLPRListItem>;
      pageInfo: GitHubGraphQLPageInfo;
    };
  };
}

/**
 * Transformed review comment structure
 */
export interface TransformedReviewComment {
  id: number;
  created_at: string;
  body: string;
  html_url: string;
  user?: { login: string };
  in_reply_to_id?: number;
}

/**
 * PR Timeline Response from GraphQL API
 * Extended version with baseRef name and repository name
 */
export interface GitHubGraphQLPRTimelineResponse {
  repository: {
    pullRequest: {
      id: string;
      number: number;
      title: string;
      state: string;
      isDraft: boolean;
      url: string;
      createdAt: string;
      updatedAt: string;
      mergedAt: string | null;
      mergeCommit: {
        oid: string;
      } | null;
      mergedBy: {
        login: string;
      } | null;
      baseRef: {
        name: string;
        target: {
          oid: string;
        };
        repository: {
          owner: {
            login: string;
          };
          name: string;
        };
      };
      headRef: {
        target: {
          oid: string;
        };
      };
      author: {
        login: string;
      };
      labels: {
        nodes: Array<{
          name: string;
          color: string;
        }>;
      };
      commits: {
        nodes: Array<{
          commit: {
            oid: string;
            message: string;
            committedDate: string;
            committer?: {
              date: string;
              name?: string;
              user?: { login: string } | null;
            };
            author?: {
              date: string;
              name?: string;
              email?: string;
            };
            parents: {
              nodes: Array<{
                oid: string;
              }>;
            };
          };
        }>;
      };
      reviews: {
        nodes: Array<{
          id: string;
          state: string;
          submittedAt: string;
          body: string | null;
          url: string;
          author: {
            login: string;
          } | null;
        }>;
      };
      comments: {
        nodes: Array<{
          id: string;
          createdAt: string;
          body: string;
          url: string;
          author: {
            login: string;
          } | null;
        }>;
      };
      reviewThreads: {
        nodes: Array<{
          id: string;
          comments: {
            nodes: Array<{
              id: string;
              createdAt: string;
              body: string;
              url: string;
              author: {
                login: string;
              } | null;
              replyTo: {
                id: string;
              } | null;
              isMinimized: boolean;
            }>;
          };
        }>;
      };
      timelineItems: {
        nodes: Array<GitHubGraphQLTimelineItemExtended>;
      };
      additions: number;
      deletions: number;
      changedFiles: number;
    } | null;
  };
}
