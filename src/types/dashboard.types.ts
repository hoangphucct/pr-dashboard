/**
 * Dashboard related types
 */

export interface GetDataDto {
  prIds: string;
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
  labels?: Array<{ name: string; color?: string }>;
  hasForcePushed?: boolean;
  needsTimelineUpdate?: boolean;
}
