import type { PrMetrics } from '@shared/storage.types';
import type { DashboardPrData } from '@shared/dashboard.types';

/**
 * Helper functions for processing PR data
 */
export class PrDataHelper {
  /**
   * Check if a PR object is valid
   */
  static isValidPr(pr: unknown): pr is PrMetrics {
    return (
      pr !== null &&
      pr !== undefined &&
      typeof pr === 'object' &&
      'prNumber' in pr &&
      pr.prNumber != null &&
      typeof pr.prNumber === 'number'
    );
  }

  /**
   * Filter valid PRs from an array
   */
  static filterValidPrs(prs: unknown[]): PrMetrics[] {
    return prs.filter((pr): pr is PrMetrics => this.isValidPr(pr));
  }

  /**
   * Map PR metrics to dashboard data format
   */
  static mapToDashboardData(pr: PrMetrics): DashboardPrData {
    return {
      prNumber: pr.prNumber,
      title: pr.title || `PR #${pr.prNumber}`,
      author: pr.author || 'Unknown',
      url: pr.url || '',
      status: pr.status || 'Unknown',
      commitToOpen: pr.commitToOpen ?? 0,
      openToReview: pr.openToReview ?? 0,
      reviewToApproval: pr.reviewToApproval ?? 0,
      approvalToMerge: pr.approvalToMerge ?? 0,
      createdAt: pr.createdAt || new Date().toISOString(),
      updatedAt: pr.updatedAt || new Date().toISOString(),
      labels: pr.labels || [],
      hasForcePushed: pr.hasForcePushed || false,
      isDraft: pr.isDraft ?? false,
      wasCreatedAsDraft: pr.wasCreatedAsDraft ?? false,
      baseBranch: pr.baseBranch,
      headBranch: pr.headBranch,
      hasTimeWarning: pr.hasTimeWarning ?? false,
      timeWarnings: pr.timeWarnings ?? [],
    };
  }

  /**
   * Process and clean PR data for dashboard
   */
  static processPrDataForDashboard(prs: unknown[]): DashboardPrData[] {
    const validPrs = this.filterValidPrs(prs);
    return validPrs.map((pr) => this.mapToDashboardData(pr));
  }
}
