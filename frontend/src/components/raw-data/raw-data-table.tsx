'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Link as MuiLink,
  Chip,
  Box,
  Stack,
  Typography,
} from '@mui/material';
import { StatusBadge } from '@/components/ui/status-badge';
import { BranchInfo } from '@/components/ui/branch-info';
import { PrLabels } from '@/components/ui/pr-label';
import { calculateOpenToMerge, calculateTotalTime, formatDate } from '@/lib/utils';
import type { DashboardPrData } from '@/types';

interface RawDataTableProps {
  readonly data: DashboardPrData[];
}

/**
 * Format raw value - display as-is without conversion
 */
function formatRawValue(value: number | undefined | null): string {
  if (value === undefined || value === null) {
    return '-';
  }
  return value.toFixed(2);
}

export function RawDataTable({ data }: RawDataTableProps) {
  if (!data || data.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          textAlign: 'center',
          py: 8,
          px: 4,
          bgcolor: 'white',
          borderRadius: 3,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        }}
      >
        <Typography variant="body1" sx={{ color: '#64748b' }}>
          No PR data found in selected file.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: 'white',
        borderRadius: 3,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        p: 2,
        overflowX: 'auto',
      }}
    >
      <TableContainer component={Paper} elevation={0} sx={{ backgroundColor: 'transparent' }}>
        <Table sx={{ minWidth: 1000 }} aria-label="Raw Data PR Table">
          <TableHead>
            <TableRow
              sx={{
                bgcolor: '#f8fafc',
                '& th': {
                  fontWeight: 600,
                  color: '#374151',
                  borderBottom: '2px solid #e5e7eb',
                },
              }}
            >
              <TableCell>PR Number</TableCell>
              <TableCell sx={{ minWidth: 250 }}>Title</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Open Date</TableCell>
              <TableCell align="right">Commit to Open</TableCell>
              <TableCell align="right">Open to Review</TableCell>
              <TableCell align="right">Review to Approval</TableCell>
              <TableCell align="right">Approval to Merge</TableCell>
              <TableCell align="right">Open to Merge</TableCell>
              <TableCell align="right">Total Cycle</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((pr, index) => (
              <TableRow
                key={`${pr.prNumber}-${index}`}
                hover
                sx={{
                  bgcolor: index % 2 === 0 ? 'white' : '#fafbfc',
                  '&:hover': { bgcolor: '#f0f4ff' },
                }}
              >
                <TableCell>
                  <strong style={{ color: '#4f46e5' }}>#{pr.prNumber}</strong>
                </TableCell>
                <TableCell>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      {pr.url ? (
                        <MuiLink
                          href={pr.url}
                          target="_blank"
                          rel="noopener"
                          sx={{ fontSize: '0.875rem', color: '#2563eb' }}
                        >
                          {pr.title}
                        </MuiLink>
                      ) : (
                        <Box component="span" sx={{ fontSize: '0.875rem', color: '#1e293b' }}>
                          {pr.title}
                        </Box>
                      )}
                      {pr.hasForcePushed && (
                        <Chip label="Force Pushed" color="error" size="small" variant="outlined" />
                      )}
                    </Stack>
                    <BranchInfo baseBranch={pr.baseBranch} headBranch={pr.headBranch} />
                    <PrLabels labels={pr.labels} />
                  </Stack>
                </TableCell>
                <TableCell>
                  <StatusBadge status={pr.status} />
                </TableCell>
                <TableCell sx={{ color: '#475569' }}>
                  {pr.openDate ? formatDate(pr.openDate) : '-'}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: 'monospace', color: '#475569' }}>
                  {formatRawValue(pr.commitToOpen)}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: 'monospace', color: '#475569' }}>
                  {formatRawValue(pr.openToReview)}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: 'monospace', color: '#475569' }}>
                  {formatRawValue(pr.reviewToApproval)}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: 'monospace', color: '#475569' }}>
                  {formatRawValue(pr.approvalToMerge)}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                  <strong style={{ color: '#059669' }}>
                    {formatRawValue(
                      calculateOpenToMerge(
                        pr.openToReview,
                        pr.reviewToApproval,
                        pr.approvalToMerge,
                      ),
                    )}
                  </strong>
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                  <strong style={{ color: '#4f46e5' }}>
                    {formatRawValue(
                      calculateTotalTime(
                        pr.commitToOpen,
                        pr.openToReview,
                        pr.reviewToApproval,
                        pr.approvalToMerge,
                      ),
                    )}
                  </strong>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
