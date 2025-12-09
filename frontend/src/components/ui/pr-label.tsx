'use client';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { getLabelTextColor } from '@/lib/utils';
import type { PrLabel as PrLabelType } from '@/types';

interface PrLabelProps {
  readonly label: PrLabelType;
}

export function PrLabel({ label }: PrLabelProps) {
  const bgColor = label.color ? `#${label.color}` : '#e0e0e0';
  const textColor = getLabelTextColor(bgColor);

  return (
    <Chip
      label={label.name}
      size="small"
      sx={{
        bgcolor: bgColor,
        color: textColor,
        fontWeight: 500,
        fontSize: '0.75rem',
        height: 'auto',
        py: 0.25,
        '& .MuiChip-label': {
          px: 1,
        },
      }}
    />
  );
}

interface PrLabelsProps {
  readonly labels?: PrLabelType[];
}

export function PrLabels({ labels }: PrLabelsProps) {
  if (!labels || labels.length === 0) {
    return null;
  }

  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {labels.map((label, index) => (
        <PrLabel key={`${label.name}-${index}`} label={label} />
      ))}
    </Stack>
  );
}
