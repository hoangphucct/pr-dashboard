import { format, formatDistanceToNow, parseISO } from 'date-fns';

/**
 * Format hours with days if applicable
 */
export function formatTimeWithDays(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || hours === 0) {
    return '-';
  }
  const hoursValue = hours / 24;
  const days = Math.floor(hoursValue);
  const remainingHours = Math.round(hours % 24);

  if (days > 0) {
    return `${days}d ${remainingHours}h`;
  }
  return `${hoursValue.toFixed(2)}h`;
}

/**
 * Calculate total time from metrics
 */
export function calculateTotalTime(
  commitToOpen: number,
  openToReview: number,
  reviewToApproval: number,
  approvalToMerge: number,
): number {
  return (
    (commitToOpen || 0) + (openToReview || 0) + (reviewToApproval || 0) + (approvalToMerge || 0)
  );
}

/**
 * Calculate time from open to merge
 */
export function calculateOpenToMerge(
  openToReview: number,
  reviewToApproval: number,
  approvalToMerge: number,
): number {
  return (openToReview || 0) + (reviewToApproval || 0) + (approvalToMerge || 0);
}

/**
 * Format date for display in timeline (d/M/yyyy HH:mm)
 */
export function formatTimelineDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const date = parseISO(dateStr);
    return format(date, 'd/M/yyyy HH:mm');
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format date for display (d/M/yyyy)
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const date = parseISO(dateStr);
    return format(date, 'd/M/yyyy');
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format relative time
 */
export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const date = parseISO(dateStr);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return 'Invalid date';
  }
}

/**
 * Get text color for label based on background color
 */
export function getLabelTextColor(bgColor: string | undefined): string {
  if (!bgColor) return '#000000';
  const hex = bgColor.replace('#', '');
  const r = Number.parseInt(hex.substring(0, 2), 16);
  const g = Number.parseInt(hex.substring(2, 4), 16);
  const b = Number.parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Timeline event icon configuration
 */
export const TIMELINE_EVENT_CONFIG: Record<string, { icon: string; color: string }> = {
  commit: { icon: '📝', color: '#28a745' },
  ready_for_review: { icon: '👁️', color: '#17a2b8' },
  comment: { icon: '💬', color: '#6c757d' },
  review_comment: { icon: '💬', color: '#6c757d' },
  review_requested: { icon: '👤', color: '#ffc107' },
  force_pushed: { icon: '⚠️', color: '#ff9800' },
  base_ref_changed: { icon: '🌿', color: '#2196F3' },
  approved: { icon: '✅', color: '#28a745' },
  merged: { icon: '🔀', color: '#6f42c1' },
  default: { icon: '●', color: '#007bff' },
};

/**
 * Get timeline event config by type
 */
export function getTimelineEventConfig(type: string): { icon: string; color: string } {
  return TIMELINE_EVENT_CONFIG[type] || TIMELINE_EVENT_CONFIG.default;
}

/**
 * Validate Findy Team URL
 */
export function validateFindyUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const isValidDomain = urlObj.hostname === 'findy-team.io';
    const isValidPath = urlObj.pathname === '/team/analytics/cycletime';
    const hasMonitoringId = urlObj.searchParams.has('monitoring_id');
    const monitoringId = urlObj.searchParams.get('monitoring_id');
    const isValidMonitoringId = monitoringId !== null && /^\d+$/.test(monitoringId);
    if (!isValidDomain || !isValidPath || !hasMonitoringId || !isValidMonitoringId) {
      return false;
    }
    const hasRange = urlObj.searchParams.has('range');
    const hasStartDate = urlObj.searchParams.has('start_date');
    const hasEndDate = urlObj.searchParams.has('end_date');
    if (hasRange) {
      return true;
    }
    if (hasStartDate && hasEndDate) {
      const startDate = urlObj.searchParams.get('start_date');
      const endDate = urlObj.searchParams.get('end_date');
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      return (
        startDate !== null &&
        endDate !== null &&
        dateRegex.test(startDate) &&
        dateRegex.test(endDate)
      );
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Class name utility
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
