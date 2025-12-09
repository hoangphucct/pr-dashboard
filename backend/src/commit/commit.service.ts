import { Injectable } from '@nestjs/common';
import type { GitHubCommit } from '@shared/github.types';

/**
 * Service for processing and analyzing commits
 */
@Injectable()
export class CommitService {
  /**
   * Check if a commit is a merge commit
   */
  isMergeCommit(commit: GitHubCommit): boolean {
    const message = commit.commit.message.toLowerCase();
    return (
      message.startsWith('merge pull request') ||
      message.startsWith('merge branch') ||
      message.startsWith('merge ') ||
      Boolean(commit.parents && commit.parents.length > 1)
    );
  }

  /**
   * Filter out merge commits from a list of commits
   */
  filterNonMergeCommits(commits: GitHubCommit[]): GitHubCommit[] {
    return commits.filter((commit) => !this.isMergeCommit(commit));
  }

  /**
   * Sort commits by committer date (ascending)
   */
  sortCommitsByDate(commits: GitHubCommit[]): GitHubCommit[] {
    return [...commits].sort(
      (a, b) =>
        new Date(a.commit.committer.date).getTime() -
        new Date(b.commit.committer.date).getTime(),
    );
  }

  /**
   * Find commit with "Work has started on the" message
   */
  findWorkStartedCommit(commits: GitHubCommit[]): GitHubCommit | undefined {
    return commits.find((commit) =>
      commit.commit.message.toLowerCase().startsWith('work has started on the'),
    );
  }

  /**
   * Get the first commit from a list of commits
   * Priority:
   * 1. Commit with "Work has started on the" message
   * 2. First non-merge commit
   * 3. First commit (if all are merge commits)
   */
  getFirstCommit(commits: GitHubCommit[]): GitHubCommit | null {
    if (!commits || commits.length === 0) {
      return null;
    }

    // Sort all commits by date (earliest first)
    const sortedCommits = this.sortCommitsByDate(commits);

    // Filter out merge commits
    const nonMergeCommits = this.filterNonMergeCommits(sortedCommits);

    // Priority 1: Find commit with "Work has started on the" message
    const workStartedCommit = this.findWorkStartedCommit(nonMergeCommits);
    if (workStartedCommit) {
      return workStartedCommit;
    }

    // Priority 2: Use first non-merge commit, or first commit if all are merge commits
    return nonMergeCommits.length > 0 ? nonMergeCommits[0] : sortedCommits[0];
  }

  /**
   * Get commit message (first line, trimmed, max 100 chars)
   */
  getCommitMessage(commit: GitHubCommit): string {
    return commit.commit.message.split('\n')[0].trim().substring(0, 100);
  }

  /**
   * Build commit URL
   */
  buildCommitUrl(owner: string, repo: string, sha: string): string {
    return `https://github.com/${owner}/${repo}/commit/${sha}`;
  }
}
