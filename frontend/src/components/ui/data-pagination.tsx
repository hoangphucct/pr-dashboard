'use client';

import { Box, Pagination } from '@mui/material';
import type { PaginationInfo } from '@/types';

interface DataPaginationProps {
  readonly pagination: PaginationInfo;
  readonly onPageChange: (event: React.ChangeEvent<unknown>, page: number) => void;
}

export function DataPagination({ pagination, onPageChange }: DataPaginationProps) {
  if (pagination.totalPages <= 1) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
      <Pagination
        count={pagination.totalPages}
        page={pagination.page}
        onChange={onPageChange}
        color="primary"
        size="large"
        showFirstButton
        showLastButton
      />
    </Box>
  );
}

