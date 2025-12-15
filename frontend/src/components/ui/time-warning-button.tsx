'use client';

import { useState } from 'react';
import { IconButton, Badge, Tooltip } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { TimeWarning } from '@/types';
import { TimeWarningModal } from './time-warning-modal';

interface TimeWarningButtonProps {
  warnings: TimeWarning[];
  prNumber: number;
}

export function TimeWarningButton({ warnings, prNumber }: TimeWarningButtonProps) {
  const [open, setOpen] = useState(false);

  if (!warnings || warnings.length === 0) {
    return null;
  }

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <>
      <Tooltip title={`${warnings.length} cảnh báo vượt ngưỡng thời gian`} arrow>
        <IconButton
          onClick={handleOpen}
          size="small"
          sx={{
            bgcolor: '#ef4444',
            color: 'white',
            '&:hover': {
              bgcolor: '#dc2626',
            },
            width: 32,
            height: 32,
            ml: 1,
          }}
        >
          <Badge
            badgeContent={warnings.length}
            color="error"
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: '#fbbf24',
                color: '#000',
                fontWeight: 'bold',
                fontSize: '0.65rem',
                minWidth: 16,
                height: 16,
                right: -4,
                top: -4,
              },
            }}
          >
            <WarningAmberIcon sx={{ fontSize: 18 }} />
          </Badge>
        </IconButton>
      </Tooltip>

      <TimeWarningModal
        open={open}
        onClose={handleClose}
        warnings={warnings}
        prNumber={prNumber}
      />
    </>
  );
}

