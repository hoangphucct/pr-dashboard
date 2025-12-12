'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Box, Stack } from '@mui/material';
import { useDashboard } from '@/hooks/use-dashboard';
import { PrForm } from '@/components/dashboard/pr-form';
import { DateSelector } from '@/components/dashboard/date-selector';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardContent } from '@/components/dashboard/dashboard-content';
import { WorkflowModal } from '@/components/dashboard/workflow-modal';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ErrorAlert } from '@/components/ui/error-alert';
import { EmptyState } from '@/components/ui/empty-state';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { DashboardPrData } from '@/types';

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dateParam = searchParams.get('date') || undefined;
  const pageParam = searchParams.get('page');
  const currentPage = pageParam ? Number.parseInt(pageParam, 10) : 1;
  const validPage = Number.isNaN(currentPage) || currentPage < 1 ? 1 : currentPage;
  const { data, isLoading, error } = useDashboard(dateParam, validPage, DEFAULT_PAGE_SIZE);
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
      router.push(`/dashboard?date=${date}&page=1`);
    } else {
      router.push('/dashboard?page=1');
    }
  };

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    const params = new URLSearchParams();
    if (dateParam) params.append('date', dateParam);
    params.append('page', String(page));
    router.push(`/dashboard?${params.toString()}`);
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
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorAlert message={error.message} />;
  }

  const today = new Date().toISOString().split('T')[0];
  const selectedDate = data?.selectedDate || today;

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', py: 4, px: { xs: 2, md: 4 } }}>
      <DashboardHeader />

      <Stack spacing={3}>
        <PrForm selectedDate={selectedDate} />

        {data?.availableDates && data.availableDates.length > 0 && (
          <DateSelector
            availableDates={data.availableDates}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
          />
        )}

        {data?.hasData && data.pagination ? (
          <DashboardContent
            data={data.data}
            selectedDate={selectedDate}
            pagination={data.pagination}
            onOpenTimeline={handleOpenTimeline}
            onPageChange={handlePageChange}
          />
        ) : (
          <EmptyState message='No data available. Please enter PR IDs and click "Get Data" to start.' />
        )}
      </Stack>

      <WorkflowModal
        isOpen={selectedPr !== null}
        onClose={handleCloseTimeline}
        prNumber={selectedPr?.prNumber || null}
        prData={selectedPr?.prData || null}
      />
    </Box>
  );
}
