'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CircularProgress, Box, Alert, Typography, Stack, Paper } from '@mui/material';
import { useDashboard } from '@/hooks/use-dashboard';
import { PrForm } from '@/components/dashboard/pr-form';
import { DateSelector } from '@/components/dashboard/date-selector';
import { PrTable } from '@/components/dashboard/pr-table';
import { SummaryChart } from '@/components/dashboard/summary-chart';
import { WorkflowModal } from '@/components/dashboard/workflow-modal';
import type { DashboardPrData } from '@/types';

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dateParam = searchParams.get('date') || undefined;
  const { data, isLoading, error } = useDashboard(dateParam);
  const [selectedPr, setSelectedPr] = useState<{
    prNumber: number;
    prData: DashboardPrData;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDateChange = (date: string) => {
    if (date) {
      router.push(`/dashboard?date=${date}`);
    } else {
      router.push('/dashboard');
    }
  };

  const handleOpenTimeline = (prNumber: number, prData: DashboardPrData) => {
    setSelectedPr({ prNumber, prData });
  };

  const handleCloseTimeline = () => {
    setSelectedPr(null);
  };

  // Show nothing during SSR to prevent hydration mismatch
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

  const today = new Date().toISOString().split('T')[0];
  const selectedDate = data?.selectedDate || today;

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
          PR Cycle-Time Dashboard
        </Typography>
        <Typography variant="body1" sx={{ color: '#64748b' }}>
          Track and analyze your pull request metrics
        </Typography>
      </Box>

      {/* Form Section */}
      <Stack spacing={3}>
        <PrForm selectedDate={selectedDate} />

        {/* Date Selector */}
        {data?.availableDates && data.availableDates.length > 0 && (
          <DateSelector
            availableDates={data.availableDates}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
          />
        )}

        {/* Data Section */}
        {data?.hasData ? (
          <Stack spacing={3}>
            <PrTable
              data={data.data}
              selectedDate={selectedDate}
              onOpenTimeline={handleOpenTimeline}
            />
            <SummaryChart data={data.data} />
          </Stack>
        ) : (
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
              No data available. Please enter PR IDs and click &quot;Get Data&quot; to start.
            </Typography>
          </Paper>
        )}
      </Stack>

      {/* Modal */}
      <WorkflowModal
        isOpen={selectedPr !== null}
        onClose={handleCloseTimeline}
        prNumber={selectedPr?.prNumber || null}
        prData={selectedPr?.prData || null}
      />
    </Box>
  );
}
