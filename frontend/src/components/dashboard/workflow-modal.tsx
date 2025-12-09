'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Button,
  Box,
  Typography,
  Chip,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTimeline } from '@/hooks/use-timeline';
import { TimelineView } from '@/components/timeline/timeline-view';
import type { DashboardPrData } from '@/types';

interface WorkflowModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly prNumber: number | null;
  readonly prData: DashboardPrData | null;
}

export function WorkflowModal({ isOpen, onClose, prNumber, prData }: WorkflowModalProps) {
  const { data, isLoading, error } = useTimeline(prNumber);

  const title = prData?.title || 'Workflow Details';

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      aria-labelledby="workflow-dialog-title"
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle
        id="workflow-dialog-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e2e8f0',
          pb: 2,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Chip
              label={`PR #${prNumber}`}
              color="primary"
              size="small"
              sx={{ fontWeight: 600 }}
            />
            {prData?.status && (
              <Chip
                label={prData.status}
                color={prData.status === 'Merged' ? 'success' : 'default'}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500 }}>
            {title}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ ml: 2 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <TimelineView
          timeline={data?.timeline || []}
          validationIssues={data?.validationIssues || []}
          isLoading={isLoading}
          error={error?.message}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={onClose} variant="contained" sx={{ bgcolor: '#6366f1' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
