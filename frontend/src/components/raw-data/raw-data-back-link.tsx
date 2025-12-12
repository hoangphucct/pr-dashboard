'use client';

import { Box, Link as MuiLink } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import Link from 'next/link';

export function RawDataBackLink() {
  return (
    <Box sx={{ mb: 3 }}>
      <MuiLink
        component={Link}
        href="/dashboard"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          color: '#6366f1',
          textDecoration: 'none',
          fontWeight: 500,
          '&:hover': {
            textDecoration: 'underline',
          },
        }}
      >
        <ArrowBackIcon fontSize="small" />
        Back to Dashboard
      </MuiLink>
    </Box>
  );
}

