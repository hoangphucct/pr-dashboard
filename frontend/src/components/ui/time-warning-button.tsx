'use client';

import { useState } from 'react';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
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
      <Tooltip title={`${warnings.length} time warning`} arrow>
        <Button
          onClick={handleOpen}
          color="error"
          sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          component="label"
          role={undefined}
          variant="contained"
          tabIndex={-1}
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
                top: -4,
              },
            }}
          >
            Warnings
          </Badge>
        </Button>
      </Tooltip>

      <TimeWarningModal open={open} onClose={handleClose} warnings={warnings} prNumber={prNumber} />
    </>
  );
}
