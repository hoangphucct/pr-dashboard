import { Injectable } from '@nestjs/common';

/**
 * Service for calculating business days (Monday to Friday)
 */
@Injectable()
export class BusinessDaysService {
  /**
   * Check if a date is a business day (Monday = 1 to Friday = 5)
   */
  private isBusinessDay(date: Date): boolean {
    const dayOfWeek = date.getDay();
    // Monday = 1, Tuesday = 2, Wednesday = 3, Thursday = 4, Friday = 5
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  /**
   * Calculate number of business days between two dates (inclusive)
   * Only counts Monday to Friday
   */
  calculateBusinessDays(startDate: Date, endDate: Date): number {
    if (startDate > endDate) {
      return 0;
    }

    let businessDays = 0;
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (currentDate <= end) {
      if (this.isBusinessDay(currentDate)) {
        businessDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return businessDays;
  }

  /**
   * Calculate business hours between two specific timestamps
   * Only counts hours in business days (Monday to Friday)
   * Returns hours (24h per business day)
   */
  calculateBusinessHours(startDate: Date, endDate: Date): number {
    if (startDate >= endDate) {
      return 0;
    }

    let totalHours = 0;
    const start = new Date(startDate);
    const end = new Date(endDate);

    // If same day and it's a business day
    if (start.toDateString() === end.toDateString() && this.isBusinessDay(start)) {
      const diffMs = end.getTime() - start.getTime();
      return diffMs / (1000 * 60 * 60);
    }

    // Calculate hours for the start day (if business day)
    if (this.isBusinessDay(start)) {
      const endOfStartDay = new Date(start);
      endOfStartDay.setHours(23, 59, 59, 999);
      const endTime = Math.min(end.getTime(), endOfStartDay.getTime());
      const diffMs = endTime - start.getTime();
      totalHours += diffMs / (1000 * 60 * 60);
    }

    // Move to start of next day
    const current = new Date(start);
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);

    // Calculate full business days in between
    while (current < end) {
      const nextDay = new Date(current);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);

      if (this.isBusinessDay(current)) {
        if (nextDay <= end) {
          // Full business day
          totalHours += 24;
        } else {
          // Partial day (end day)
          const diffMs = end.getTime() - current.getTime();
          totalHours += diffMs / (1000 * 60 * 60);
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return totalHours;
  }

  /**
   * Calculate business days from hours
   * Assumes 24 hours per business day
   */
  calculateBusinessDaysFromHours(hours: number): number {
    if (hours <= 0) {
      return 0;
    }
    // 24 hours per business day
    return Math.round((hours / 24) * 10) / 10;
  }

  /**
   * Format time with business days
   * Example: "200h (10d)" or "25.5h (3.2d)"
   */
  formatTimeWithBusinessDays(hours: number): string {
    if (hours <= 0) {
      return '0h (0d)';
    }
    const days = this.calculateBusinessDaysFromHours(hours);
    return `${hours.toFixed(2)}h (${days}d)`;
  }
}
