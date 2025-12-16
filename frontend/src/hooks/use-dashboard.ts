'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import type { GetDataRequest } from '@/types';
import { toast } from 'sonner';

/**
 * Hook for fetching dashboard data with pagination
 */
export function useDashboard(date?: string, page?: number, limit?: number) {
  return useQuery({
    queryKey: ['dashboard', date, page, limit],
    queryFn: () => dashboardApi.getDashboard(date, page, limit),
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

/**
 * Hook for deleting all data for a specific date
 */
export function useDeleteDataByDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (date: string) => dashboardApi.deleteDataByDate(date),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete data: ${error.message}`);
    },
  });
}
