'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';

/**
 * Hook for fetching timeline data for a PR
 */
export function useTimeline(prNumber: number | null) {
  return useQuery({
    queryKey: ['timeline', prNumber],
    queryFn: () => {
      if (!prNumber) throw new Error('PR number is required');
      return dashboardApi.getTimeline(prNumber);
    },
    enabled: prNumber !== null,
  });
}
