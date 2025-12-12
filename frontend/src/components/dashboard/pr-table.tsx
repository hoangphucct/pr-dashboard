'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Link as MuiLink,
  Chip,
  Box,
  Stack,
} from '@mui/material';
import { Delete as DeleteIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import { StatusBadge } from '@/components/ui/status-badge';
import { BranchInfo } from '@/components/ui/branch-info';
import { PrLabels } from '@/components/ui/pr-label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatTimeWithDays, calculateOpenToMerge, calculateTotalTime } from '@/lib/utils';
import { useDeletePr } from '@/hooks/use-dashboard';
import type { DashboardPrData } from '@/types';

interface PrTableProps {
  readonly data: DashboardPrData[];
  readonly selectedDate: string;
  readonly onOpenTimeline: (prNumber: number, prData: DashboardPrData) => void;
}

export function PrTable({ data, selectedDate, onOpenTimeline }: PrTableProps) {
  const deletePr = useDeletePr();
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; prNumber: number | null }>({
    open: false,
    prNumber: null,
  });

  const handleDeleteClick = (prNumber: number) => {
    setDeleteConfirm({ open: true, prNumber });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm.prNumber) {
      deletePr.mutate({ prNumber: deleteConfirm.prNumber, date: selectedDate });
    }
    setDeleteConfirm({ open: false, prNumber: null });
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ open: false, prNumber: null });
  };

  if (!data || data.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 5, color: '#64748b' }}>
        <p>No data available. Please enter PR IDs and click &quot;Get Data&quot; to start.</p>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          bgcolor: 'white',
          borderRadius: 3,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          p: 2,
          mb: 3,
          overflowX: 'auto',
        }}
      >
        <TableContainer component={Paper} elevation={0} sx={{ backgroundColor: 'transparent' }}>
          <Table sx={{ minWidth: 1000 }} aria-label="PR Cycle Time Table">
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
                <TableCell>Author</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Commit to Open (h)</TableCell>
                <TableCell>Open to Review (h)</TableCell>
                <TableCell>Review to Approval (h)</TableCell>
                <TableCell>Approval to Merge (h)</TableCell>
                <TableCell>Open to Merge (h)</TableCell>
                <TableCell>Total Cycle (h)</TableCell>
                <TableCell>Actions</TableCell>
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
                          <Chip
                            label="Force Pushed"
                            color="error"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                      <BranchInfo baseBranch={pr.baseBranch} headBranch={pr.headBranch} />
                      <PrLabels labels={pr.labels} />
                      {pr.isDraft === false && (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          <Chip
                            label="Not Draft"
                            color="error"
                            size="small"
                            className="ml-2 w-auto"
                          />
                          </Stack>
                        )}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ color: '#475569' }}>{pr.author}</TableCell>
                  <TableCell>
                    <StatusBadge status={pr.status} />
                  </TableCell>
                  <TableCell sx={{ color: '#475569' }}>
                    {formatTimeWithDays(pr.commitToOpen)}
                  </TableCell>
                  <TableCell sx={{ color: '#475569' }}>
                    {formatTimeWithDays(pr.openToReview)}
                  </TableCell>
                  <TableCell sx={{ color: '#475569' }}>
                    {formatTimeWithDays(pr.reviewToApproval)}
                  </TableCell>
                  <TableCell sx={{ color: '#475569' }}>
                    {formatTimeWithDays(pr.approvalToMerge)}
                  </TableCell>
                  <TableCell>
                    <strong style={{ color: '#059669' }}>
                      {formatTimeWithDays(
                        calculateOpenToMerge(
                          pr.openToReview,
                          pr.reviewToApproval,
                          pr.approvalToMerge,
                        ),
                      )}
                    </strong>
                  </TableCell>
                  <TableCell>
                    <strong style={{ color: '#4f46e5' }}>
                      {formatTimeWithDays(
                        calculateTotalTime(
                          pr.commitToOpen,
                          pr.openToReview,
                          pr.reviewToApproval,
                          pr.approvalToMerge,
                        ),
                      )}
                    </strong>
                  </TableCell>
                  <TableCell>
                    <Stack direction="column" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        sx={{
                          bgcolor: '#6366f1',
                          '&:hover': { bgcolor: '#4f46e5' },
                          textTransform: 'none',
                          fontSize: '0.75rem',
                        }}
                        startIcon={<VisibilityIcon fontSize="small" />}
                        onClick={() => onOpenTimeline(pr.prNumber, pr)}
                      >
                        Details
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                        startIcon={<DeleteIcon fontSize="small" />}
                        disabled={deletePr.isPending}
                        onClick={() => handleDeleteClick(pr.prNumber)}
                      >
                        {deletePr.isPending ? 'Deleting...' : 'Delete'}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete Pull Request"
        message={`Are you sure you want to delete PR #${deleteConfirm.prNumber}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </>
  );
}
