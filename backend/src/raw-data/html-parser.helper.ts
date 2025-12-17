import type { ParsedPr } from '@shared/helper.types';

/**
 * Helper functions for parsing PR data from HTML table
 */
export class HtmlParserHelper {
  /**
   * Parse PRs data from HTML table
   */
  static parsePrsFromHtml(html: string): unknown[] {
    const prs: unknown[] = [];
    const rowPattern =
      /<tr[^>]*class="[^"]*css-mfqrpf[^"]*"[^>]*>(.*?)<\/tr>/gs;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowPattern.exec(html)) !== null) {
      const rowHtml = String(rowMatch[1]);
      const prData = this.parsePrRowFromHtml(rowHtml);
      if (prData) {
        prs.push(prData);
      }
    }
    return prs;
  }

  /**
   * Parse a single PR row from HTML
   */
  static parsePrRowFromHtml(rowHtml: string): ParsedPr | null {
    const prNumberMatch = /href="[^"]*\/pull\/(\d+)"/.exec(rowHtml);
    if (!prNumberMatch) {
      return null;
    }
    const prNumber = Number.parseInt(prNumberMatch[1], 10);
    if (Number.isNaN(prNumber)) {
      return null;
    }
    const titleMatch = /title="([^"]+)"/.exec(rowHtml);
    const title = titleMatch?.[1] || `PR #${prNumber}`;
    const url = `https://github.com/ZIGExN/dorapita/pull/${prNumber}`;
    const branchMatch =
      /<div[^>]*class="[^"]*css-1p1bspk[^"]*"[^>]*>([^<]+)<\/div>/.exec(
        rowHtml,
      );
    const branchInfo = branchMatch?.[1] || '';
    const [baseBranch, headBranch] = this.parseBranchInfo(branchInfo);
    const statusMatch =
      /<div[^>]*class="[^"]*(?:css-d9b9w0|css-vkn4bi)[^"]*"[^>]*>([^<]+)<\/div>/.exec(
        rowHtml,
      );

    const status = this.normalizeStatus(statusMatch?.[1] || 'Unknown');
    const cells = this.extractTableCells(rowHtml);
    const commitToOpen = this.parseNumericValue(cells[3]);
    const openToReview = this.parseNumericValue(cells[4]);
    const reviewToApproval = this.parseNumericValue(cells[5]);
    const approvalToMerge = this.parseNumericValue(cells[6]);
    const dateMatch = /(\d{4}\/\d{2}\/\d{2})\s*\([^)]+\)/.exec(rowHtml);
    const openDate = dateMatch?.[1]
      ? this.convertDateToIso(dateMatch[1])
      : null;
    return {
      prNumber,
      title,
      author: 'Unknown',
      url,
      status,
      commitToOpen: commitToOpen ?? 0,
      openToReview: openToReview ?? 0,
      reviewToApproval: reviewToApproval ?? 0,
      approvalToMerge: approvalToMerge ?? 0,
      createdAt: openDate || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      labels: [],
      hasForcePushed: false,
      isDraft: false,
      baseBranch,
      headBranch,
    };
  }

  /**
   * Extract table cells from row HTML
   */
  static extractTableCells(rowHtml: string): string[] {
    const cells: string[] = [];
    const cellPattern =
      /<td[^>]*class="[^"]*css-18a3pw2[^"]*"[^>]*>(.*?)<\/td>/gs;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellPattern.exec(rowHtml)) !== null) {
      cells.push(String(cellMatch[1]));
    }
    return cells;
  }

  /**
   * Parse branch info from string like "baseBranch ← headBranch"
   */
  static parseBranchInfo(
    branchInfo: string,
  ): [string | undefined, string | undefined] {
    const parts = branchInfo.split('←').map((s) => s.trim());
    if (parts.length === 2) {
      return [parts[0] || undefined, parts[1] || undefined];
    }
    return [undefined, undefined];
  }

  /**
   * Normalize status text - keep original status from HTML
   */
  static normalizeStatus(status: string): string {
    const normalized = status.trim();
    return normalized || 'Unknown';
  }

  /**
   * Parse numeric value from cell HTML, returns null for "-" or empty
   */
  static parseNumericValue(cellHtml: string | undefined): number | null {
    if (!cellHtml) {
      return null;
    }
    const valueMatch = cellHtml.match(
      /<div[^>]*class="[^"]*css-zcsya3[^"]*"[^>]*>([^<]+)<\/div>/,
    );
    const value = valueMatch?.[1]?.trim();
    if (!value || value === '-') {
      return null;
    }
    const num = Number.parseFloat(value);
    return Number.isNaN(num) ? null : num;
  }

  /**
   * Convert date format from "2025/12/02" to ISO string
   */
  static convertDateToIso(dateStr: string): string | null {
    const [year, month, day] = dateStr.split('/');
    if (!year || !month || !day) {
      return null;
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`;
  }

  /**
   * Extract open dates from HTML table data
   */
  static extractOpenDatesFromHtml(data: unknown): Map<number, string> {
    const openDatesMap = new Map<number, string>();
    if (!data || typeof data !== 'object') {
      return openDatesMap;
    }
    const tableHtml = (data as { html?: string }).html;
    if (typeof tableHtml !== 'string') {
      return openDatesMap;
    }
    const rowPattern =
      /<tr[^>]*>.*?<a[^>]*href="[^"]*\/pull\/(\d+)"[^>]*>.*?<\/tr>/gs;
    const datePattern = /(\d{4}\/\d{2}\/\d{2})\s*\([^)]+\)/;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowPattern.exec(tableHtml)) !== null) {
      const prNumber = Number.parseInt(String(rowMatch[1]), 10);
      if (Number.isNaN(prNumber)) {
        continue;
      }
      const dateMatch = String(rowMatch[0]).match(datePattern);
      if (dateMatch?.[1]) {
        const isoDate = this.convertDateToIso(String(dateMatch[1]));
        if (isoDate) {
          openDatesMap.set(prNumber, isoDate);
        }
      }
    }
    return openDatesMap;
  }
}
