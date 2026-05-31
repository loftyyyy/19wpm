export const API_BASE_URL = 'http://localhost:8080/api';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export async function apiRequest<T>(
  _endpoint: string,
  _options?: RequestInit,
): Promise<ApiResponse<T>> {
  return { data: null, error: 'Backend not connected — using local storage' };
}
