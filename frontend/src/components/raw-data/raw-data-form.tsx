'use client';

import { useState } from 'react';
import { TextField, Button, Box, Stack, Typography } from '@mui/material';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import { useProcessRawData } from '@/hooks/use-raw-data';
import { validateFindyUrl } from '@/lib/utils';
import { toast } from 'sonner';

export function RawDataForm() {
  const [findyUrl, setFindyUrl] = useState('');
  const processRawData = useProcessRawData();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = findyUrl.trim();
    if (!url) {
      toast.error('Please enter a URL');
      return;
    }
    if (!validateFindyUrl(url)) {
      toast.error(
        'Invalid URL. URL must match pattern:\n' +
          '• https://findy-team.io/team/analytics/cycletime?monitoring_id=<number>&range=<string>\n' +
          '• https://findy-team.io/team/analytics/cycletime?monitoring_id=<number>&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD',
      );
      return;
    }
    processRawData.mutate({ findyUrl: url });
  };

  return (
    <Box
      sx={{
        bgcolor: 'white',
        p: 3,
        borderRadius: 3,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 2 }}>
        Import from Findy Team
      </Typography>
      <form onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <TextField
            type="url"
            label="Findy Team URL"
            placeholder="https://findy-team.io/team/analytics/cycletime?monitoring_id=12045&start_date=2025-11-01&end_date=2025-11-30"
            value={findyUrl}
            onChange={(e) => setFindyUrl(e.target.value)}
            required
            fullWidth
            size="medium"
            variant="outlined"
            helperText="Enter a valid Findy Team cycle-time analytics URL"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#f8fafc',
              },
            }}
          />
          <Box>
            <Button
              type="submit"
              variant="contained"
              disabled={processRawData.isPending || !findyUrl.trim()}
              startIcon={<CloudUploadIcon />}
              sx={{
                bgcolor: '#10b981',
                px: 3,
                py: 1.25,
                fontSize: '0.9rem',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                '&:hover': {
                  bgcolor: '#059669',
                  boxShadow: '0 6px 16px rgba(16, 185, 129, 0.4)',
                },
                '&:disabled': {
                  bgcolor: '#a7f3d0',
                },
              }}
            >
              {processRawData.isPending ? 'Processing...' : 'Process Raw Data'}
            </Button>
          </Box>
        </Stack>
      </form>
    </Box>
  );
}
