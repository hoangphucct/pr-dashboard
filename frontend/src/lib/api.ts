import type {
  DashboardResponse,
  GetDataRequest,
  GetDataResponse,
  TimelineResponse,
  RawDataResponse,
  ProcessRawDataRequest,
  ProcessRawDataResponse,
  ApiError,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  // Add API key if available
  if (API_KEY) {
    (headers as Record<string, string>)['X-API-Key'] = API_KEY;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || errorData.error || `HTTP error! status: ${response.status}`,
    );
  }
  return response.json();
}

/**
 * Dashboard API functions
 */
export const dashboardApi = {
  /**
   * Get dashboard data for a specific date with pagination
   */
  getDashboard: (
    date?: string,
    page?: number,
    limit?: number,
  ): Promise<DashboardResponse> => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));
    const queryString = params.toString();
    return fetchApi<DashboardResponse>(
      `/dashboard${queryString ? `?${queryString}` : ''}`,
    );
  },

  /**
   * Fetch PR data from GitHub and save to storage
   */
  getData: (data: GetDataRequest): Promise<GetDataResponse> => {
    return fetchApi<GetDataResponse>('/dashboard/get-data', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get timeline for a specific PR
   */
  getTimeline: (prNumber: number): Promise<TimelineResponse> => {
    return fetchApi<TimelineResponse>(`/dashboard/timeline/${prNumber}`);
  },

  /**
   * Delete a PR from storage
   */
  deletePr: (prNumber: number, date?: string): Promise<{ success: boolean; message: string }> => {
    const params = date ? `?date=${encodeURIComponent(date)}` : '';
    return fetchApi(`/dashboard/pr/${prNumber}${params}`, {
      method: 'DELETE',
    });
  },

  /**
   * Delete all data for a specific date
   */
  deleteDataByDate: (date: string): Promise<{ success: boolean; message: string; date: string }> => {
    return fetchApi(`/dashboard/date/${encodeURIComponent(date)}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Raw Data API functions
 */
export const rawDataApi = {
  /**
   * Get raw data files list and optionally load a selected file's data with pagination
   */
  getRawData: (
    selectedFile?: string,
    page?: number,
    limit?: number,
  ): Promise<RawDataResponse> => {
    const params = new URLSearchParams();
    if (selectedFile) params.append('selectedFile', selectedFile);
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));
    const queryString = params.toString();
    return fetchApi<RawDataResponse>(
      `/raw-data${queryString ? `?${queryString}` : ''}`,
    );
  },

  /**
   * Process raw data from Findy Team URL
   */
  processRawData: (data: ProcessRawDataRequest): Promise<ProcessRawDataResponse> => {
    return fetchApi<ProcessRawDataResponse>('/raw-data', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a raw data file
   */
  deleteRawDataFile: (fileName: string): Promise<{ success: boolean; message: string; fileName: string }> => {
    return fetchApi(`/raw-data/${encodeURIComponent(fileName)}`, {
      method: 'DELETE',
    });
  },
};
