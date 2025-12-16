'use client';

import { Card, CardContent, Stack, Typography, Chip, Link as MuiLink } from '@mui/material';
import { Description as DescriptionIcon } from '@mui/icons-material';
import { formatDate } from '@/lib/utils';
import type { RawDataFileInfo } from '@/types';

interface FileInfoCardProps {
  readonly fileInfo: RawDataFileInfo;
}

export function FileInfoCard({ fileInfo }: FileInfoCardProps) {
  return (
    <Card
      elevation={0}
      sx={{
        bgcolor: 'white',
        borderRadius: 3,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <DescriptionIcon sx={{ color: '#6366f1' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
            {fileInfo.fileName}
          </Typography>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Chip
            label={`Scraped: ${formatDate(fileInfo.scrapedAt)}`}
            size="small"
            sx={{ bgcolor: '#f1f5f9' }}
          />
          <Chip
            label={`${fileInfo.prCount} PRs`}
            size="small"
            color="primary"
            sx={{ bgcolor: '#6366f1' }}
          />
        </Stack>
        <Typography variant="body2" sx={{ mt: 2, color: '#64748b' }}>
          <strong>Source:</strong>{' '}
          <MuiLink href={fileInfo.url} target="_blank" rel="noopener" sx={{ color: '#6366f1' }}>
            {fileInfo.url}
          </MuiLink>
        </Typography>
      </CardContent>
    </Card>
  );
}
