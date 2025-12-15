import type { TimeWarning } from './storage.types';

/**
 * Dashboard related types
 */

export interface GetDataDto {
  prIds: string;
  selectedDate?: string;
}

export interface DashboardPrData {
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
  openDate?: string;
  labels?: Array<{ name: string; color?: string }>;
  hasForcePushed?: boolean;
  isDraft?: boolean;
  /** True if PR was created as Draft (has ready_for_review event in history) */
  wasCreatedAsDraft?: boolean;
  needsTimelineUpdate?: boolean;
  baseBranch?: string;
  headBranch?: string;
  /** Time warning information */
  hasTimeWarning?: boolean;
  timeWarnings?: TimeWarning[];
}
