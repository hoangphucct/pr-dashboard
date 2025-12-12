'use client';

import { Box, Alert } from '@mui/material';

interface ErrorAlertProps {
  readonly message: string;
  readonly maxWidth?: number | string;
}

export function ErrorAlert({ message, maxWidth = 1200 }: ErrorAlertProps) {
  return (
    <Box sx={{ maxWidth, mx: 'auto', p: 3 }}>
      <Alert severity="error">
        <strong>Error:</strong> {message}
      </Alert>
    </Box>
  );
}

