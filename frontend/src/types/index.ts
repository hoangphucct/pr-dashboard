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
  labels?: PrLabel[];
  hasForcePushed?: boolean;
  needsTimelineUpdate?: boolean;
  baseBranch?: string;
  headBranch?: string;
}

export interface PrLabel {
  name: string;
  color?: string;
}

export interface DashboardResponse {
  data: DashboardPrData[];
  selectedDate: string;
  availableDates: string[];
  hasData: boolean;
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
}

export interface ProcessRawDataRequest {
  findyUrl: string;
}

export interface ProcessRawDataResponse {
  success: boolean;
  message: string;
  fileName: string;
  prCount: number;
  prNumbers: number[];
}

/**
 * API Error type
 */
export interface ApiError {
  error?: string;
  message?: string;
  statusCode?: number;
}
