'use client';

import { Box, CircularProgress } from '@mui/material';

interface LoadingSpinnerProps {
  readonly size?: number;
  readonly color?: string;
}

export function LoadingSpinner({ size = 60, color = '#6366f1' }: LoadingSpinnerProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress size={size} sx={{ color }} />
    </Box>
  );
}

