import { Injectable } from '@nestjs/common';
import type { TimelineItem } from '@shared/timeline.types';

/**
 * Workflow data for validation
 * Only needs status and createdAt, not full WorkflowData
 */
interface WorkflowDataForValidation {
  status: string;
  createdAt: string;
}

export interface ValidationIssue {
  type: 'missing_step' | 'wrong_order' | 'abnormal_time';
  severity: 'error' | 'warning';
  message: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class WorkflowValidationService {
  /**
   * Expected workflow order
   */
  private readonly expectedOrder: string[] = [
    'commit',
    'ready_for_review',
    'comment',
    'review_requested',
    'review_comment',
    'approved',
    'merged',
  ];

  /**
   * Minimum time per file changed (hours)
   * If commitToOpen is less than this, it's considered abnormal
   */
  private readonly minTimePerFile = 0.1; // hours

  /**
   * Validate workflow and return issues
   * Skip validation if PR is Draft (only validate when opened or merged)
   * Timeline is loaded from workflow storage
   */
  validateWorkflow(
    workflow: WorkflowDataForValidation,
    timeline: TimelineItem[],
  ): ValidationIssue[] {
    // Skip validation for Draft PRs - only validate when opened or merged
    if (workflow.status === 'Draft') {
      return [];
    }

    const issues: ValidationIssue[] = [];

    // Check for missing steps
    const missingStepsIssues = this.checkMissingSteps(timeline, workflow.status);
    issues.push(...missingStepsIssues);

    // Check for wrong order
    const wrongOrderIssues = this.checkWrongOrder(workflow, timeline);
    issues.push(...wrongOrderIssues);

    // Note: checkAbnormalTime removed as it requires metrics data
    // which is now stored in PrMetrics, not WorkflowData

    return issues;
  }

  /**
   * Check for missing workflow steps
   */
  private checkMissingSteps(
    timeline: TimelineItem[],
    status: string,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const timelineTypes = new Set(timeline.map((item) => item.type));

    // Check for required steps
    if (!timelineTypes.has('commit')) {
      issues.push({
        type: 'missing_step',
        severity: 'error',
        message: 'Missing first commit step - Workflow is incorrect',
      });
    } else {
      // Check if commit has "Work has started on the" message
      const commitItems = timeline.filter((item) => item.type === 'commit');
      const hasWorkStartedCommit = commitItems.some((item) =>
        item.title?.toLowerCase().startsWith('work has started on the'),
      );

      if (!hasWorkStartedCommit) {
        issues.push({
          type: 'missing_step',
          severity: 'error',
          message:
            'Missing "Work has started on the" commit - Workflow is incorrect',
          details: {
            commitTitles: commitItems.map((item) => item.title),
          },
        });
      }
    }

    if (!timelineTypes.has('comment') && !timelineTypes.has('review_comment')) {
      issues.push({
        type: 'missing_step',
        severity: 'warning',
        message: 'Missing review comment step',
      });
    }

    if (!timelineTypes.has('approved')) {
      issues.push({
        type: 'missing_step',
        severity: 'warning',
        message: 'Missing approval step',
      });
    }

    // Check merged step only if PR is merged
    if (status === 'Merged' && !timelineTypes.has('merged')) {
      issues.push({
        type: 'missing_step',
        severity: 'error',
        message: 'PR is merged but missing merge step in timeline',
      });
    }

    return issues;
  }

  /**
   * Check for wrong order in workflow
   */
  private checkWrongOrder(
    workflow: WorkflowDataForValidation,
    timeline: TimelineItem[],
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const sortedTimeline = [...timeline].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );

    // Check if review_requested appears before PR is opened
    const prOpenedTime = new Date(workflow.createdAt).getTime();
    const reviewRequestedItems = sortedTimeline.filter(
      (item) => item.type === 'review_requested',
    );

    for (const item of reviewRequestedItems) {
      const itemTime = new Date(item.time).getTime();
      if (itemTime < prOpenedTime) {
        issues.push({
          type: 'wrong_order',
          severity: 'error',
          message: `Review requested (${item.time}) appears before PR was opened (${workflow.createdAt})`,
          details: {
            itemType: item.type,
            itemTime: item.time,
            prOpenedTime: workflow.createdAt,
          },
        });
      }
    }

    // Check if comment appears before ready_for_review
    const readyForReviewItems = sortedTimeline.filter(
      (item) => item.type === 'ready_for_review',
    );
    const commentItems = sortedTimeline.filter(
      (item) => item.type === 'comment' || item.type === 'review_comment',
    );

    if (readyForReviewItems.length > 0 && commentItems.length > 0) {
      const lastReadyForReview =
        readyForReviewItems[readyForReviewItems.length - 1];
      const firstComment = commentItems[0];

      if (
        new Date(firstComment.time).getTime() <
        new Date(lastReadyForReview.time).getTime()
      ) {
        issues.push({
          type: 'wrong_order',
          severity: 'warning',
          message: `Comment (${firstComment.time}) appears before ready for review (${lastReadyForReview.time})`,
          details: {
            commentTime: firstComment.time,
            readyForReviewTime: lastReadyForReview.time,
          },
        });
      }
    }

    // Check if approved appears before comment
    const approvedItems = sortedTimeline.filter(
      (item) => item.type === 'approved',
    );
    if (approvedItems.length > 0 && commentItems.length > 0) {
      const firstApproved = approvedItems[0];
      const lastComment = commentItems[commentItems.length - 1];

      if (
        new Date(firstApproved.time).getTime() <
        new Date(lastComment.time).getTime()
      ) {
        issues.push({
          type: 'wrong_order',
          severity: 'error',
          message: `Approved (${firstApproved.time}) appears before review comment (${lastComment.time})`,
          details: {
            approvedTime: firstApproved.time,
            commentTime: lastComment.time,
          },
        });
      }
    }

    return issues;
  }

}
