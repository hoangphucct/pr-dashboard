/**
 * Dashboard related types
 */
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
  labels?: PrLabel[];
  hasForcePushed?: boolean;
  isDraft?: boolean;
  /** True if PR was created as Draft (has ready_for_review event in history) */
  wasCreatedAsDraft?: boolean;
  needsTimelineUpdate?: boolean;
  baseBranch?: string;
  headBranch?: string;
}

export interface PrLabel {
  name: string;
  color?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface DashboardResponse {
  data: DashboardPrData[];
  selectedDate: string;
  availableDates: string[];
  hasData: boolean;
  pagination: PaginationInfo;
}

export interface GetDataRequest {
  prIds: string;
  selectedDate?: string;
}

export interface GetDataResponse {
  success: boolean;
  message: string;
  date: string;
  prNumbers: number[];
}

/**
 * Timeline related types
 */
export interface TimelineItem {
  type: string;
  title: string;
  time: string;
  actor?: string;
  url?: string;
  description?: string;
  parentId?: number;
  indentLevel?: number;
}

export interface TimelineResponse {
  timeline: TimelineItem[];
  validationIssues: ValidationIssue[];
}

/**
 * Validation related types
 */
export interface ValidationIssue {
  type: 'missing_step' | 'wrong_order' | 'abnormal_time';
  severity: 'error' | 'warning';
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Raw Data related types
 */
export interface RawDataFile {
  fileName: string;
  scrapedAt: string;
  prCount: number;
}

export interface RawDataFileInfo {
  fileName: string;
  scrapedAt: string;
  url: string;
  prCount: number;
}

export interface RawDataResponse {
  rawDataFiles: RawDataFile[];
  selectedFile?: string;
  selectedFileData: RawDataFileInfo | null;
  prsData: DashboardPrData[];
  hasData: boolean;
  pagination: PaginationInfo;
}

export interface ProcessRawDataRequest {
  findyUrl: string;
  saveToDashboard?: boolean;
}

export interface ProcessRawDataResponse {
  success: boolean;
  message: string;
  fileName: string;
  prCount: number;
  prNumbers: number[];
  dashboardSaved?: boolean;
  dashboardDate?: string;
  dashboardPrCount?: number;
}

/**
 * API Error type
 */
export interface ApiError {
  error?: string;
  message?: string;
  statusCode?: number;
}
