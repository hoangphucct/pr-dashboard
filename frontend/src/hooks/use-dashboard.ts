'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import type { GetDataRequest } from '@/types';
import { toast } from 'sonner';

/**
 * Hook for fetching dashboard data
 */
export function useDashboard(date?: string) {
  return useQuery({
    queryKey: ['dashboard', date],
    queryFn: () => dashboardApi.getDashboard(date),
  });
}

/**
 * Hook for fetching PR data from GitHub
 */
export function useGetData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GetDataRequest) => dashboardApi.getData(data),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to fetch PR data: ${error.message}`);
    },
  });
}

/**
 * Hook for deleting a PR
 */
export function useDeletePr() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ prNumber, date }: { prNumber: number; date?: string }) =>
      dashboardApi.deletePr(prNumber, date),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete PR: ${error.message}`);
    },
  });
}
