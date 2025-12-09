'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  CircularProgress,
  Link as MuiLink,
  Card,
  CardContent,
  Box,
  Typography,
  Alert,
  Stack,
  Paper,
  Chip,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Description as DescriptionIcon } from '@mui/icons-material';
import Link from 'next/link';
import { useRawData } from '@/hooks/use-raw-data';
import { RawDataForm } from '@/components/raw-data/raw-data-form';
import { FileSelector } from '@/components/raw-data/file-selector';
import { RawDataTable } from '@/components/raw-data/raw-data-table';
import { formatDate } from '@/lib/utils';

export default function RawDataPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedFile = searchParams.get('selectedFile') || undefined;
  const { data, isLoading, error } = useRawData(selectedFile);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleFileChange = (fileName: string) => {
    if (fileName) {
      router.push(`/raw-data?selectedFile=${encodeURIComponent(fileName)}`);
    } else {
      router.push('/raw-data');
    }
  };

  if (!mounted) {
    return null;
  }

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress size={60} sx={{ color: '#6366f1' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        <Alert severity="error">
          <strong>Error:</strong> {error.message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', py: 4, px: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ mb: 5, textAlign: 'center' }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 700,
            color: '#1e293b',
            mb: 1,
          }}
        >
          Raw Data Management
        </Typography>
        <Typography variant="body1" sx={{ color: '#64748b' }}>
          Process and view raw PR cycle-time data from Findy Team
        </Typography>
      </Box>

      {/* Back Link */}
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

      <Stack spacing={3}>
        {/* Form */}
        <RawDataForm />

        {/* File Selector */}
        {data?.rawDataFiles && data.rawDataFiles.length > 0 && (
          <FileSelector
            files={data.rawDataFiles}
            selectedFile={selectedFile}
            onFileChange={handleFileChange}
          />
        )}

        {/* Selected File Info */}
        {data?.selectedFileData && (
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
                  {data.selectedFileData.fileName}
                </Typography>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Chip
                  label={`Scraped: ${formatDate(data.selectedFileData.scrapedAt)}`}
                  size="small"
                  sx={{ bgcolor: '#f1f5f9' }}
                />
                <Chip
                  label={`${data.selectedFileData.prCount} PRs`}
                  size="small"
                  color="primary"
                  sx={{ bgcolor: '#6366f1' }}
                />
              </Stack>
              <Typography variant="body2" sx={{ mt: 2, color: '#64748b' }}>
                <strong>Source:</strong>{' '}
                <MuiLink
                  href={data.selectedFileData.url}
                  target="_blank"
                  rel="noopener"
                  sx={{ color: '#6366f1' }}
                >
                  {data.selectedFileData.url}
                </MuiLink>
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Data Table */}
        {data?.hasData && <RawDataTable data={data.prsData} />}

        {/* Empty State */}
        {!data?.hasData && selectedFile && (
          <Paper
            elevation={0}
            sx={{
              textAlign: 'center',
              py: 8,
              px: 4,
              bgcolor: 'white',
              borderRadius: 3,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            }}
          >
            <Typography variant="body1" sx={{ color: '#64748b' }}>
              No PR data found in selected file.
            </Typography>
          </Paper>
        )}

        {/* No File Selected */}
        {!selectedFile && data?.rawDataFiles && data.rawDataFiles.length > 0 && (
          <Paper
            elevation={0}
            sx={{
              textAlign: 'center',
              py: 8,
              px: 4,
              bgcolor: 'white',
              borderRadius: 3,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            }}
          >
            <Typography variant="body1" sx={{ color: '#64748b' }}>
              Select a file from the dropdown above to view its data.
            </Typography>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}
