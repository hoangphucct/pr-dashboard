'use client';

import { Chip } from '@mui/material';

interface StatusBadgeProps {
  status: string;
}

const statusColorMap: Record<string, 'success' | 'primary' | 'error' | 'default' | 'secondary'> = {
  Merged: 'secondary',
  Open: 'success',
  'In Progress': 'success',
  Closed: 'error',
  Draft: 'default',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = statusColorMap[status] || 'default';

  return <Chip label={status} color={color} size="small" variant="outlined" />;
}
