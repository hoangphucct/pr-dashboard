import { Injectable } from '@nestjs/common';

export type TimeWarningType =
  | 'commitToOpen'
  | 'openToReview'
  | 'reviewToApproval'
  | 'approvalToMerge';

export interface TimeWarning {
  type: TimeWarningType;
  label: string;
  limit: number;
  actual: number;
  exceeded: boolean;
  suggestedReasons: string[];
}

export interface TimeWarningResult {
  hasWarning: boolean;
  warningCount: number;
  warnings: TimeWarning[];
}

export interface PrDataForWarning {
  commitToOpen: number;
  openToReview: number;
  reviewToApproval: number;
  approvalToMerge: number;
  baseBranch?: string;
  createdAt: string;
  changedFiles?: number;
  additions?: number;
  deletions?: number;
}

/**
 * Time limits in hours for each phase
 */
const TIME_LIMITS = {
  commitToOpen: 96,
  openToReview: 5,
  reviewToApproval: 24,
  approvalToMerge: 8,
} as const;

/**
 * Labels for display
 */
const PHASE_LABELS: Record<TimeWarningType, string> = {
  commitToOpen: 'Commit → Open',
  openToReview: 'Open → Review',
  reviewToApproval: 'Review → Approve',
  approvalToMerge: 'Approve → Merge',
};

@Injectable()
export class TimeWarningService {
  /**
   * Check all time warnings for a PR
   */
  checkWarnings(pr: PrDataForWarning): TimeWarningResult {
    const warnings: TimeWarning[] = [];

    // Rule 1: Commit -> Open > 96h
    if (pr.commitToOpen > TIME_LIMITS.commitToOpen) {
      warnings.push(this.createWarning('commitToOpen', pr.commitToOpen, pr));
    }

    // Rule 2: Open -> Review > 5h
    if (pr.openToReview > TIME_LIMITS.openToReview) {
      warnings.push(this.createWarning('openToReview', pr.openToReview, pr));
    }

    // Rule 3: Review -> Approve > 24h
    if (pr.reviewToApproval > TIME_LIMITS.reviewToApproval) {
      warnings.push(
        this.createWarning('reviewToApproval', pr.reviewToApproval, pr),
      );
    }

    // Rule 4: Approve -> Merge > 8h (only if baseBranch !== 'staging-jp')
    if (
      pr.baseBranch !== 'staging-jp' &&
      pr.approvalToMerge > TIME_LIMITS.approvalToMerge
    ) {
      warnings.push(
        this.createWarning('approvalToMerge', pr.approvalToMerge, pr),
      );
    }

    return {
      hasWarning: warnings.length > 0,
      warningCount: warnings.length,
      warnings,
    };
  }

  /**
   * Create a warning object with suggested reasons
   */
  private createWarning(
    type: TimeWarningType,
    actual: number,
    pr: PrDataForWarning,
  ): TimeWarning {
    return {
      type,
      label: PHASE_LABELS[type],
      limit: TIME_LIMITS[type],
      actual: Math.round(actual * 100) / 100,
      exceeded: true,
      suggestedReasons: this.suggestReasons(type, pr),
    };
  }

  /**
   * Auto-suggest reasons for the delay based on PR data
   */
  private suggestReasons(
    type: TimeWarningType,
    pr: PrDataForWarning,
  ): string[] {
    const reasons: string[] = [];

    // Check file changes
    if (pr.changedFiles && pr.changedFiles > 20) {
      reasons.push(`PR có nhiều file thay đổi (${pr.changedFiles} files)`);
    }

    // Check LOC (Lines of Code)
    const totalLoc = (pr.additions || 0) + (pr.deletions || 0);
    if (totalLoc > 500) {
      reasons.push(
        `PR có nhiều dòng code (+${pr.additions || 0}/-${pr.deletions || 0} LOC)`,
      );
    }

    // Check if created on weekend
    if (pr.createdAt) {
      const createdDate = new Date(pr.createdAt);
      const dayOfWeek = createdDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        reasons.push('PR được tạo vào cuối tuần');
      }
    }

    // Type-specific reasons
    switch (type) {
      case 'commitToOpen':
        if (pr.changedFiles && pr.changedFiles > 10) {
          reasons.push('PR lớn cần nhiều thời gian chuẩn bị');
        }
        break;

      case 'openToReview':
        reasons.push('Có thể chưa có reviewer được assign');
        reasons.push('Reviewer có thể đang bận task khác');
        break;

      case 'reviewToApproval':
        reasons.push('Có thể cần nhiều vòng review');
        if (totalLoc > 300) {
          reasons.push('PR lớn cần review kỹ hơn');
        }
        break;

      case 'approvalToMerge':
        reasons.push('Có thể đang chờ CI/CD hoàn thành');
        reasons.push('Có thể đang chờ merge window');
        break;
    }

    // If no specific reasons found
    if (reasons.length === 0) {
      reasons.push('Không xác định được lý do cụ thể');
    }

    // Remove duplicates and limit to 4 reasons
    return [...new Set(reasons)].slice(0, 4);
  }
}

