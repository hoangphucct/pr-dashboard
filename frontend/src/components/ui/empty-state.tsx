'use client';

import { Paper, Typography } from '@mui/material';

interface EmptyStateProps {
  readonly message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
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
        {message}
      </Typography>
    </Paper>
  );
}
