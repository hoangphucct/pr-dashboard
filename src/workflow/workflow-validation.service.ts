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
    const missingStepsIssues = this.checkMissingSteps(
      timeline,
      workflow.status,
    );
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

    // Review comment is optional - reviewer can approve directly without comment
    // So we don't check for missing review comment

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

    // Check if PR is merged without approval
    const approvedItems = sortedTimeline.filter(
      (item) => item.type === 'approved',
    );
    const mergedItems = sortedTimeline.filter((item) => item.type === 'merged');

    if (
      workflow.status === 'Merged' &&
      mergedItems.length > 0 &&
      approvedItems.length === 0
    ) {
      issues.push({
        type: 'missing_step',
        severity: 'error',
        message: 'PR was merged without approval',
        details: {
          mergedTime: mergedItems[0].time,
        },
      });
    }

    // Check if there are review comments but no approval after a long time (48 hours)
    // Only check for Open PRs (not merged/closed)
    if (
      workflow.status === 'Open' &&
      commentItems.length > 0 &&
      approvedItems.length === 0
    ) {
      const firstComment = commentItems[0];
      const commentTime = new Date(firstComment.time).getTime();
      const now = Date.now();
      const hoursSinceComment = (now - commentTime) / (1000 * 60 * 60);

      // If comment exists for more than 48 hours without approval, it's a warning
      if (hoursSinceComment > 48) {
        issues.push({
          type: 'missing_step',
          severity: 'warning',
          message: `Review comment exists for ${Math.round(hoursSinceComment)} hours without approval`,
          details: {
            firstCommentTime: firstComment.time,
            hoursSinceComment: Math.round(hoursSinceComment),
          },
        });
      }
    }

    return issues;
  }
}
