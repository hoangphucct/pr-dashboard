'use client';

import { Box, Typography } from '@mui/material';

export function RawDataHeader() {
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
        Raw Data Management
      </Typography>
      <Typography variant="body1" sx={{ color: '#64748b' }}>
        Process and view raw PR cycle-time data from Findy Team
      </Typography>
    </Box>
  );
}
