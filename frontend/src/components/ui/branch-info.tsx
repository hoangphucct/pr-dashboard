'use client';

import Stack from '@mui/material/Stack';

interface BranchInfoProps {
  baseBranch?: string;
  headBranch?: string;
}

export function BranchInfo({ baseBranch, headBranch }: BranchInfoProps) {
  if (!baseBranch && !headBranch) {
    return null;
  }

  return (
    <Stack
      direction="row"
      sx={{
        fontSize: '12px',
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
      }}
      alignItems="center"
      columnGap={0.5}
      spacing={2}
    >
      {baseBranch || 'unknown'} ← {headBranch || 'unknown'}
    </Stack>
  );
}
