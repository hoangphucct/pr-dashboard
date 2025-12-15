/**
 * Storage related types
 */

export interface PrMetrics {
  prNumber: number;
  title: string;
  author: string;
  url: string;
  status: string;
  commitToOpen: number;
  openToReview: number;
  reviewToApproval: number;
  approvalToMerge: number;
  createdAt: string;
  updatedAt: string;
  labels?: Array<{ name: string; color?: string }>;
  hasForcePushed?: boolean;
  isDraft?: boolean;
  /** True if PR was created as Draft (has ready_for_review event in history) */
  wasCreatedAsDraft?: boolean;
  baseBranch?: string;
  headBranch?: string;
}

export interface DailyData {
  date: string;
  prs: PrMetrics[];
  createdAt: string;
  updatedAt: string;
}
