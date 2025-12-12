'use client';

import { Stack } from '@mui/material';
import { RawDataTable } from '@/components/raw-data/raw-data-table';
import { DataPagination } from '@/components/ui/data-pagination';
import type { DashboardPrData, PaginationInfo } from '@/types';

interface RawDataContentProps {
  readonly data: DashboardPrData[];
  readonly pagination: PaginationInfo;
  readonly onPageChange: (event: React.ChangeEvent<unknown>, page: number) => void;
}

export function RawDataContent({
  data,
  pagination,
  onPageChange,
}: RawDataContentProps) {
  return (
    <Stack spacing={2}>
      <RawDataTable data={data} />
      <DataPagination pagination={pagination} onPageChange={onPageChange} />
    </Stack>
  );
}

