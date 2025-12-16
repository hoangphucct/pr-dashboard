'use client';

import { Box, Typography } from '@mui/material';

export function DashboardHeader() {
  return (
    <Box sx={{ mb: 5, textAlign: 'center' }}>
      <Typography
        variant="h4"
        component="h1"
        sx={{
          fontWeight: 700,
          color: '#1e293b',
          mb: 1,
        }}
      >
        PR Cycle-Time Dashboard
      </Typography>
      <Typography variant="body1" sx={{ color: '#64748b' }}>
        Track and analyze your pull request metrics
      </Typography>
    </Box>
  );
}
