/**
 * Timeline event type configuration
 */
const TIMELINE_EVENT_CONFIG = {
  commit: { icon: '📝', color: '#28a745' },
  ready_for_review: { icon: '👁️', color: '#17a2b8' },
  comment: { icon: '💬', color: '#6c757d' },
  review_comment: { icon: '💬', color: '#6c757d' },
  review_requested: { icon: '👤', color: '#ffc107' },
  force_pushed: { icon: '⚠️', color: '#ff9800' },
  approved: { icon: '✅', color: '#28a745' },
  merged: { icon: '🔀', color: '#6f42c1' },
  default: { icon: '●', color: '#007bff' },
};

/**
 * Get timeline event configuration
 */
function getTimelineEventConfig(type) {
  return TIMELINE_EVENT_CONFIG[type] || TIMELINE_EVENT_CONFIG.default;
}

/**
 * Initialize summary chart with PR cycle time data
 */
function initSummaryChart(data) {
  if (typeof Chart === 'undefined') {
    console.error('Chart.js is not loaded');
    return;
  }

  const summaryCtx = document.getElementById('summaryChart');
  if (!summaryCtx) {
    console.warn('Summary chart canvas not found');
    return;
  }

  // Filter out null/undefined items
  const validData = data.filter((item) => item && item.prNumber != null);

  if (validData.length === 0) {
    console.warn('No valid data for summary chart');
    return;
  }

  const prNumbers = validData.map((item) => item.prNumber);
  const commitToOpen = validData.map((item) => item.commitToOpen || 0);
  const openToReview = validData.map((item) => item.openToReview || 0);
  const reviewToApproval = validData.map((item) => item.reviewToApproval || 0);
  const approvalToMerge = validData.map((item) => item.approvalToMerge || 0);

  try {
    const ctx = summaryCtx.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2d context from canvas');
      return;
    }

    const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: prNumbers.map((n) => `PR #${n}`),
      datasets: [
        {
          label: 'Commit to Open',
          data: commitToOpen,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
        },
        {
          label: 'Open to Review',
          data: openToReview,
          backgroundColor: 'rgba(255, 206, 86, 0.6)',
        },
        {
          label: 'Review to Approval',
          data: reviewToApproval,
          backgroundColor: 'rgba(153, 102, 255, 0.6)',
        },
        {
          label: 'Approval to Merge',
          data: approvalToMerge,
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
        },
      ],
    },
    options: {
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true },
      },
      plugins: {
        legend: { display: true, position: 'top' },
      },
    },
  });
  } catch (error) {
    console.error('Error creating summary chart:', error);
    console.error('Error details:', error.message, error.stack);
  }
}

/**
 * Initialize workflow chart for a single PR
 */
function initWorkflowChart(prNumber, metrics) {
  if (typeof Chart === 'undefined') {
    console.error('Chart.js is not loaded');
    return;
  }

  if (!metrics || prNumber == null) {
    console.warn('Invalid metrics or prNumber for workflow chart');
    return;
  }

  const canvasId = `workflowChart-${prNumber}`;
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.warn(`Canvas not found for PR #${prNumber}`);
    return;
  }

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error(`Could not get 2d context from canvas for PR #${prNumber}`);
      return;
    }

    const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [
        'Commit to Open',
        'Open to Review',
        'Review to Approval',
        'Approval to Merge',
      ],
      datasets: [
        {
          label: 'Hours',
          data: [
            metrics.commitToOpen || 0,
            metrics.openToReview || 0,
            metrics.reviewToApproval || 0,
            metrics.approvalToMerge || 0,
          ],
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 99, 132, 0.6)',
          ],
        },
      ],
    },
    options: {
      scales: {
        y: { beginAtZero: true },
      },
      plugins: {
        legend: { display: false },
      },
    },
  });
  } catch (error) {
    console.error(`Error creating workflow chart for PR #${prNumber}:`, error);
    console.error('Error details:', error.message, error.stack);
  }
}

/**
 * Initialize all charts when page loads
 */
function initCharts() {
  const chartDataElement = document.getElementById('chart-data');
  if (!chartDataElement) {
    console.warn('Chart data element not found');
    return;
  }

  try {
    const rawData = chartDataElement.textContent.trim();
    if (!rawData) {
      console.warn('No chart data found');
      return;
    }

    const data = JSON.parse(rawData);
    
    // Handle both array and object with prs property
    const prsArray = Array.isArray(data) ? data : data.prs || [];
    if (!Array.isArray(prsArray) || prsArray.length === 0) {
      console.warn('No valid PR data found');
      return;
    }

    // Filter out invalid items (null, undefined, or missing prNumber)
    const validPrs = prsArray.filter((item) => {
      const isValid =
        item != null &&
        typeof item === 'object' &&
        item.prNumber != null;
      if (!isValid) {
        console.warn('Invalid PR item:', item);
      }
      return isValid;
    });

    if (validPrs.length === 0) {
      console.warn('No valid PRs to display');
      return;
    }

      initSummaryChart(validPrs);

      validPrs.forEach((item) => {
        if (item && item.prNumber != null) {
          initWorkflowChart(item.prNumber, item);
        }
      });
  } catch (error) {
    console.error('Error initializing charts:', error);
    console.error('Chart data element content:', chartDataElement.textContent);
  }
}

/**
 * Create chart error message element
 */
function createChartErrorMessage() {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'chart-error-message';
  errorDiv.innerHTML = '<strong>Error:</strong> Chart.js library failed to load. Please check your internet connection or refresh the page.';
  return errorDiv;
}

/**
 * Initialize charts when DOM is ready and Chart.js is loaded
 */
function waitForChartJS(retries = 50) {
  if (retries <= 0) {
    console.error('Chart.js failed to load after multiple attempts');
    const errorDiv = createChartErrorMessage();
    document.body.insertBefore(errorDiv, document.body.firstChild);
    return;
  }

  if (typeof Chart !== 'undefined') {
    // Wait for DOM to be fully ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initCharts, 200);
      });
    } else {
      // Small delay to ensure DOM is fully ready
      setTimeout(initCharts, 200);
    }
  } else {
    // Wait a bit and try again
    setTimeout(() => waitForChartJS(retries - 1), 100);
  }
}

// Start waiting for Chart.js when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => waitForChartJS());
} else {
  waitForChartJS();
}

/**
 * Open workflow modal from button click
 */
function openWorkflowModalFromButton(button) {
  if (!button) {
    console.error('Button element is required');
    return;
  }

  const prNumber = button.getAttribute('data-pr-number');
  const prDataStr = button.getAttribute('data-pr-data');

  if (!prNumber) {
    console.error('Missing PR number');
    return;
  }

  const prNum = Number.parseInt(prNumber, 10);
  if (Number.isNaN(prNum)) {
    console.error('Invalid PR number:', prNumber);
    return;
  }

  let prData = null;
  if (prDataStr) {
    try {
      prData = JSON.parse(prDataStr);
    } catch (error) {
      console.error('Error parsing PR data:', error);
    }
  }

  openWorkflowModal(prNum, prData);
}

/**
 * Open workflow modal with PR details
 */
async function openWorkflowModal(prNumber, prData) {
  const modal = document.getElementById('workflowModal');
  const modalTitle = document.getElementById('modalTitle');
  const timelineContainer = document.getElementById('workflowTimeline');

  if (!modal || !modalTitle || !timelineContainer) {
    console.error('Required modal elements not found');
    return;
  }

  const title = prData?.title || 'Workflow Details';
  modalTitle.textContent = `PR #${prNumber} - ${title}`;
  modal.classList.add('modal-visible');
  modal.classList.remove('modal-hidden');

  // Show loading
  timelineContainer.innerHTML = '<div class="timeline-loading">Loading timeline...</div>';

  try {
    const response = await fetch(`/dashboard/timeline/${prNumber}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      timelineContainer.innerHTML = `<div class="timeline-error">Error: ${data.error}</div>`;
      return;
    }

    const timeline = buildSimpleTimeline(
      data.timeline || [],
      data.validationIssues || [],
    );
    timelineContainer.innerHTML = timeline;
  } catch (error) {
    console.error('Error fetching timeline:', error);
    timelineContainer.innerHTML =
      '<div class="timeline-error">Failed to load timeline</div>';
  }
}

/**
 * Close workflow modal
 */
function closeWorkflowModal() {
  const modal = document.getElementById('workflowModal');
  if (modal) {
    modal.classList.add('modal-hidden');
    modal.classList.remove('modal-visible');
  }
}

/**
 * Format date string to local timezone (GMT+7)
 */
function formatTimelineDate(dateStr) {
  if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
      hour: 'numeric',
      minute: '2-digit',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour12: true,
    });
}

/**
 * Build validation issues HTML
 */
function buildValidationIssuesHTML(validationIssues) {
  if (!validationIssues || validationIssues.length === 0) {
    return '';
  }

  const errorCount = validationIssues.filter(
    (i) => i.severity === 'error',
  ).length;
  const warningCount = validationIssues.filter(
    (i) => i.severity === 'warning',
  ).length;
  const containerClass = errorCount > 0 ? 'error' : 'warning';

  let html = `
    <div class="validation-issues-container ${containerClass}">
      <div class="validation-issues-header">
        ⚠️ Workflow Validation Issues (${errorCount} errors, ${warningCount} warnings)
      </div>
      <div class="validation-issues-list">
  `;

  validationIssues.forEach((issue) => {
    const icon = issue.severity === 'error' ? '❌' : '⚠️';
    const itemClass = issue.severity === 'error' ? 'error' : 'warning';
    const typeText = issue.type.replace(/_/g, ' ').toUpperCase();
    const detailsHtml = issue.details
      ? `<div class="validation-issue-details">${JSON.stringify(issue.details)}</div>`
      : '';

    html += `
      <div class="validation-issue-item ${itemClass}">
        <div class="validation-issue-header">
          ${icon} ${typeText}
        </div>
        <div class="validation-issue-message">${issue.message}</div>
        ${detailsHtml}
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  return html;
}

/**
 * Build timeline event HTML
 */
function buildTimelineEventHTML(item, isLast) {
  if (!item || !item.type) {
    return '';
  }

  const config = getTimelineEventConfig(item.type);
  const eventClass = `timeline-event ${item.type}${isLast ? ' last' : ''}`;
  const titleHtml = item.url
    ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer" class="timeline-event-link">${item.title || 'Event'}</a>`
    : item.title || 'Event';
  const actorHtml = item.actor
    ? `<div class="timeline-event-actor">by ${item.actor}</div>`
    : '';
  const descriptionHtml = item.description
    ? `<div class="timeline-event-description">${item.description}</div>`
    : '';

  return `
    <div class="${eventClass}">
      <div class="timeline-event-content">
        <div class="timeline-event-title">
          <span class="timeline-event-title-icon">${config.icon}</span>
          <span class="timeline-event-title-text">${titleHtml}</span>
        </div>
        ${descriptionHtml}
        <div class="timeline-event-time">${formatTimelineDate(item.time)}</div>
        ${actorHtml}
      </div>
    </div>
  `;
}

/**
 * Build simple timeline HTML
 */
function buildSimpleTimeline(timelineItems, validationIssues = []) {
  if (!timelineItems || timelineItems.length === 0) {
    return '<div class="timeline-empty">No timeline data available</div>';
  }

  let html = '<div class="simple-timeline">';

  // Add validation issues
  html += buildValidationIssuesHTML(validationIssues || []);

  // Add timeline events
  timelineItems.forEach((item, index) => {
    if (!item) {
      return;
    }
    const isLast = index === timelineItems.length - 1;
    html += buildTimelineEventHTML(item, isLast);
  });

  html += '</div>';
  return html;
}

/**
 * Build workflow timeline HTML (old version - kept for reference)
 */
function buildWorkflowTimeline(prData) {
  const {
    prNumber,
    title,
    author,
    url,
    status,
    commitToOpen,
    openToReview,
    reviewToApproval,
    approvalToMerge,
    createdAt,
  } = prData;

  const totalTime =
    (commitToOpen || 0) +
    (openToReview || 0) +
    (reviewToApproval || 0) +
    (approvalToMerge || 0);

  const now = new Date();
  const createdDate = new Date(createdAt);

  // Calculate timeline dates forward from created date
  // Start from PR created date (this is when PR was opened)
  const openDate = createdDate;

  // Calculate commit date (before PR was opened)
  const commitDate = commitToOpen
    ? new Date(openDate.getTime() - commitToOpen * 60 * 60 * 1000)
    : openDate;

  // Calculate review date (after PR was opened)
  const reviewDate = openToReview
    ? new Date(openDate.getTime() + openToReview * 60 * 60 * 1000)
    : null;

  // Calculate approval date (after first review)
  const approvalDate = reviewToApproval && reviewDate
    ? new Date(reviewDate.getTime() + reviewToApproval * 60 * 60 * 1000)
    : reviewToApproval && openDate
      ? new Date(openDate.getTime() + (openToReview || 0) * 60 * 60 * 1000 + reviewToApproval * 60 * 60 * 1000)
      : null;

  // Calculate merge date (after approval)
  const mergeDate = approvalToMerge && approvalDate
    ? new Date(approvalDate.getTime() + approvalToMerge * 60 * 60 * 1000)
    : approvalToMerge && openDate
      ? new Date(openDate.getTime() + totalTime * 60 * 60 * 1000)
      : null;

  const formatDate = (date) => {
    if (!date) return 'N/A';
    // Use GMT+7 timezone (Vietnam timezone)
    return date.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (hours) => {
    if (!hours || hours === 0) return '0h';
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    if (days > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${remainingHours}h`;
  };

  let html = '<div class="timeline">';

  // First Commit
  html += `
    <div class="timeline-item commit">
      <div class="timeline-content">
        <div class="timeline-title">First Commit</div>
        <div class="timeline-time">${formatDate(commitDate)}</div>
        <div class="timeline-description">Work started on the task</div>
      </div>
    </div>
  `;

  // PR Opened
  html += `
    <div class="timeline-item open">
      <div class="timeline-content">
        <div class="timeline-title">PR Opened</div>
        <div class="timeline-time">${formatDate(openDate)}</div>
        <div class="timeline-duration">Duration: ${formatDuration(commitToOpen)}</div>
        <div class="timeline-description">Pull request was opened for review</div>
      </div>
    </div>
  `;

  // First Review
  if (reviewDate && openToReview > 0) {
    html += `
      <div class="timeline-item review">
        <div class="timeline-content">
          <div class="timeline-title">First Review Comment</div>
          <div class="timeline-time">${formatDate(reviewDate)}</div>
          <div class="timeline-duration">Duration: ${formatDuration(openToReview)}</div>
          <div class="timeline-description">First review comment received</div>
        </div>
      </div>
    `;
  }

  // Approval
  if (approvalDate && reviewToApproval > 0) {
    html += `
      <div class="timeline-item approved">
        <div class="timeline-content">
          <div class="timeline-title">PR Approved</div>
          <div class="timeline-time">${formatDate(approvalDate)}</div>
          <div class="timeline-duration">Duration: ${formatDuration(reviewToApproval)}</div>
          <div class="timeline-description">Pull request was approved</div>
        </div>
      </div>
    `;
  }

  // Merged
  if (mergeDate && approvalToMerge > 0) {
    html += `
      <div class="timeline-item merged">
        <div class="timeline-content">
          <div class="timeline-title">PR Merged</div>
          <div class="timeline-time">${formatDate(mergeDate)}</div>
          <div class="timeline-duration">Duration: ${formatDuration(approvalToMerge)}</div>
          <div class="timeline-description">Pull request was merged</div>
        </div>
      </div>
    `;
  }

  // Summary
  html += `
    <div class="timeline-content timeline-summary">
      <div class="timeline-title">Summary</div>
      <div class="timeline-description">
        <strong>Total Cycle Time:</strong> ${formatDuration(totalTime)}<br>
        <strong>Author:</strong> ${author}<br>
        <strong>Status:</strong> ${status}<br>
        ${url ? `<strong>PR Link:</strong> <a href="${url}" target="_blank">${url}</a>` : ''}
      </div>
    </div>
  `;

  html += '</div>';

  return html;
}

/**
 * Handle modal close on outside click
 */
function handleModalOutsideClick(event) {
  const modal = document.getElementById('workflowModal');
  if (event.target === modal) {
    closeWorkflowModal();
  }
}

// Close modal when clicking outside
window.addEventListener('click', handleModalOutsideClick);
