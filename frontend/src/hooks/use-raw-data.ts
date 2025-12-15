'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rawDataApi } from '@/lib/api';
import type { ProcessRawDataRequest } from '@/types';
import { toast } from 'sonner';

/**
 * Hook for fetching raw data files with pagination
 */
export function useRawData(
  selectedFile?: string,
  page?: number,
  limit?: number,
) {
  return useQuery({
    queryKey: ['raw-data', selectedFile, page, limit],
    queryFn: () => rawDataApi.getRawData(selectedFile, page, limit),
  });
}

/**
 * Hook for processing raw data from Findy Team URL
 */
export function useProcessRawData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProcessRawDataRequest) => rawDataApi.processRawData(data),
    onSuccess: (result) => {
      const dashboardInfo = result.dashboardSaved
        ? ` Dashboard updated for ${result.dashboardDate} (${result.dashboardPrCount} PRs).`
        : '';
      toast.success(`${result.message} (${result.prCount} PRs found).${dashboardInfo}`);
      queryClient.invalidateQueries({ queryKey: ['raw-data'] });
      // Also invalidate dashboard queries if dashboard was updated
      if (result.dashboardSaved) {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to process raw data: ${error.message}`);
    },
  });
}

/**
 * Hook for deleting a raw data file
 */
export function useDeleteRawDataFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fileName: string) => rawDataApi.deleteRawDataFile(fileName),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ['raw-data'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete file: ${error.message}`);
    },
  });
}
