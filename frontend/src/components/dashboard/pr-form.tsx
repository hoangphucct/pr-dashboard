'use client';

import { useState } from 'react';
import { TextField, Button, Link as MuiLink, Box, Stack } from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import Link from 'next/link';
import { useGetData } from '@/hooks/use-dashboard';

interface PrFormProps {
  readonly selectedDate: string;
}

export function PrForm({ selectedDate }: PrFormProps) {
  const [prIds, setPrIds] = useState('');
  const getData = useGetData();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prIds.trim()) return;
    getData.mutate({
      prIds: prIds.trim(),
      selectedDate,
    });
  };

  return (
    <Box
      sx={{
        bgcolor: 'white',
        p: 3,
        borderRadius: 3,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        mb: 3,
      }}
    >
      <form onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <TextField
            label="Enter PR IDs (comma separated)"
            placeholder="e.g., 1,2,3,4,5"
            value={prIds}
            onChange={(e) => setPrIds(e.target.value)}
            required
            fullWidth
            size="medium"
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#f8fafc',
              },
            }}
          />
          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              type="submit"
              variant="contained"
              disabled={getData.isPending || !prIds.trim()}
              startIcon={<SendIcon />}
              sx={{
                bgcolor: '#6366f1',
                px: 3,
                py: 1.25,
                fontSize: '0.9rem',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                '&:hover': {
                  bgcolor: '#4f46e5',
                  boxShadow: '0 6px 16px rgba(99, 102, 241, 0.4)',
                },
                '&:disabled': {
                  bgcolor: '#c7d2fe',
                },
              }}
            >
              {getData.isPending ? 'Loading...' : 'Get Data'}
            </Button>
            <MuiLink
              component={Link}
              href="/raw-data"
              sx={{
                color: '#6366f1',
                fontWeight: 500,
                fontSize: '0.9rem',
                textDecoration: 'none',
                '&:hover': {
                  color: '#4f46e5',
                  textDecoration: 'underline',
                },
              }}
            >
              Go to Raw Data Page →
            </MuiLink>
          </Stack>
        </Stack>
      </form>
    </Box>
  );
}
