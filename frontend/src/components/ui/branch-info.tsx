'use client';

import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import { styled } from '@mui/material/styles';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
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
    <Stack direction="column" spacing={2}>
      <Item sx={{ p: 0.5 }}> {headBranch || 'unknown'}</Item>
      <Box component="div" sx={{ display: 'flex', justifyContent: 'center' }}>
        <ArrowDownwardIcon />
      </Box>
      <Item>{baseBranch || 'unknown'}</Item>
    </Stack>
  );
}
