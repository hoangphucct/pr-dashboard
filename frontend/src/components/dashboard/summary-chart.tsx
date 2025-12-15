'use client';

import { Box, Typography, Paper, Stack, Chip } from '@mui/material';
import { BarChart as BarChartIcon } from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { DashboardPrData } from '@/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface SummaryChartProps {
  readonly data: DashboardPrData[];
}

export function SummaryChart({ data }: SummaryChartProps) {
  if (!data || data.length === 0) {
    return null;
  }

  // Filter and deduplicate data by prNumber
  const seenPrNumbers = new Set<number>();
  const validData = data.filter((item) => {
    if (!item?.prNumber || seenPrNumbers.has(item.prNumber)) {
      return false;
    }
    seenPrNumbers.add(item.prNumber);
    return true;
  });

  if (validData.length === 0) {
    return null;
  }

  // Calculate averages
  const totalCommitToOpen = validData.reduce((sum, item) => sum + (item.commitToOpen || 0), 0);
  const totalOpenToReview = validData.reduce((sum, item) => sum + (item.openToReview || 0), 0);
  const totalReviewToApproval = validData.reduce(
    (sum, item) => sum + (item.reviewToApproval || 0),
    0,
  );
  const totalApprovalToMerge = validData.reduce(
    (sum, item) => sum + (item.approvalToMerge || 0),
    0,
  );

  const count = validData.length;
  const avgCommitToOpen = (totalCommitToOpen / count).toFixed(1);
  const avgOpenToReview = (totalOpenToReview / count).toFixed(1);
  const avgReviewToApproval = (totalReviewToApproval / count).toFixed(1);
  const avgApprovalToMerge = (totalApprovalToMerge / count).toFixed(1);

  const chartData = {
    labels: validData.map((item) => `#${item.prNumber}`),
    datasets: [
      {
        label: 'Commit to Open',
        data: validData.map((item) => item.commitToOpen || 0),
        backgroundColor: 'rgba(99, 102, 241, 0.85)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Open to Review',
        data: validData.map((item) => item.openToReview || 0),
        backgroundColor: 'rgba(236, 72, 153, 0.85)',
        borderColor: 'rgba(236, 72, 153, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Review to Approval',
        data: validData.map((item) => item.reviewToApproval || 0),
        backgroundColor: 'rgba(59, 130, 246, 0.85)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Approval to Merge',
        data: validData.map((item) => item.approvalToMerge || 0),
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false,
        },
        ticks: {
          color: '#64748b',
          font: { weight: 'bold' as const },
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.06)',
        },
        ticks: {
          color: '#64748b',
        },
        title: {
          display: true,
          text: 'Hours',
          color: '#64748b',
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          color: '#374151',
          font: { size: 12, weight: 'bold' as const },
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        padding: 12,
        cornerRadius: 8,
        boxPadding: 6,
      },
    },
  };

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'white',
        borderRadius: 3,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <BarChartIcon sx={{ color: '#6366f1' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
            Cycle Time Overview
          </Typography>
        </Stack>
        <Chip
          label={`${validData.length} PRs`}
          size="small"
          sx={{ bgcolor: '#f1f5f9', fontWeight: 500 }}
        />
      </Box>

      {/* Stats Summary */}
      <Box
        sx={{
          px: 3,
          py: 2,
          bgcolor: '#f8fafc',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-around">
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
              Avg Commit to Open
            </Typography>
            <Typography
              variant="h6"
              sx={{ color: '#6366f1', fontWeight: 700, fontSize: '1.1rem' }}
            >
              {avgCommitToOpen}h
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
              Avg Open to Review
            </Typography>
            <Typography
              variant="h6"
              sx={{ color: '#ec4899', fontWeight: 700, fontSize: '1.1rem' }}
            >
              {avgOpenToReview}h
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
              Avg Review to Approval
            </Typography>
            <Typography
              variant="h6"
              sx={{ color: '#3b82f6', fontWeight: 700, fontSize: '1.1rem' }}
            >
              {avgReviewToApproval}h
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
              Avg Approval to Merge
            </Typography>
            <Typography
              variant="h6"
              sx={{ color: '#10b981', fontWeight: 700, fontSize: '1.1rem' }}
            >
              {avgApprovalToMerge}h
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Chart */}
      <Box sx={{ p: 3, height: 350 }}>
        <Bar data={chartData} options={options} />
      </Box>
    </Paper>
  );
}
