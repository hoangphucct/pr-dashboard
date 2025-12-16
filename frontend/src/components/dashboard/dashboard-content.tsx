'use client';

import { Stack } from '@mui/material';
import { PrTable } from '@/components/dashboard/pr-table';
import { SummaryChart } from '@/components/dashboard/summary-chart';
import { DataPagination } from '@/components/ui/data-pagination';
import type { DashboardPrData, PaginationInfo } from '@/types';

interface DashboardContentProps {
  readonly data: DashboardPrData[];
  readonly selectedDate: string;
  readonly pagination: PaginationInfo;
  readonly onOpenTimeline: (prNumber: number, prData: DashboardPrData) => void;
  readonly onPageChange: (event: React.ChangeEvent<unknown>, page: number) => void;
}

export function DashboardContent({
  data,
  selectedDate,
  pagination,
  onOpenTimeline,
  onPageChange,
}: DashboardContentProps) {
  return (
    <Stack spacing={3}>
      <PrTable data={data} selectedDate={selectedDate} onOpenTimeline={onOpenTimeline} />
      <DataPagination pagination={pagination} onPageChange={onPageChange} />
      <SummaryChart data={data} />
    </Stack>
  );
}
