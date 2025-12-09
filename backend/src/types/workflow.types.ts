/**
 * Workflow related types
 */

export interface WorkflowDataForValidation {
  status: string;
  createdAt: string;
}

export interface ValidationIssue {
  type: 'missing_step' | 'wrong_order' | 'abnormal_time';
  severity: 'error' | 'warning';
  message: string;
  details?: Record<string, unknown>;
}
