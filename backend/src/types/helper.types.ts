export interface ParsedPr {
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
  labels: string[];
  hasForcePushed: boolean;
  isDraft: boolean;
  baseBranch?: string;
  headBranch?: string;
}
