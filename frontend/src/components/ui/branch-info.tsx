'use client';

import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import { styled } from '@mui/material/styles';
import KeyboardBackspaceIcon from '@mui/icons-material/KeyboardBackspace';
import Box from '@mui/material/Box';

interface BranchInfoProps {
  baseBranch?: string;
  headBranch?: string;
}

export function BranchInfo({ baseBranch, headBranch }: BranchInfoProps) {
  if (!baseBranch && !headBranch) {
    return null;
  }

  const Item = styled(Paper)(({ theme }) => ({
    backgroundColor: '#fff',
    ...theme.typography.body2,
    padding: theme.spacing(0.4),
    textAlign: 'center',
    color: (theme.vars ?? theme).palette.text.secondary,
    ...theme.applyStyles('dark', {
      backgroundColor: '#1A2027',
    }),
  }));

  return (
    <Stack
      direction="row"
      sx={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
      alignItems="center"
      columnGap={0.5}
      spacing={2}
    >
      {baseBranch || 'unknown'} ← {headBranch || 'unknown'}
    </Stack>
  );
}
