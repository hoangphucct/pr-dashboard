'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rawDataApi } from '@/lib/api';
import type { ProcessRawDataRequest } from '@/types';
import { toast } from 'sonner';

/**
 * Hook for fetching raw data files
 */
export function useRawData(selectedFile?: string) {
  return useQuery({
    queryKey: ['raw-data', selectedFile],
    queryFn: () => rawDataApi.getRawData(selectedFile),
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
      toast.success(`${result.message} (${result.prCount} PRs found)`);
      queryClient.invalidateQueries({ queryKey: ['raw-data'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to process raw data: ${error.message}`);
    },
  });
}
