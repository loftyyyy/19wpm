import type { ApiTokenRefreshResponse } from '../types/api';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const TOKEN_KEY = '19wpm-access-token';
const REFRESH_KEY = '19wpm-refresh-token';
const USER_ID_KEY = '19wpm-user-id';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUserId(): number | null {
  const val = localStorage.getItem(USER_ID_KEY);
  return val ? Number(val) : null;
}

export function setTokens(accessToken: string, refreshToken: string, userId?: number): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  if (userId !== undefined) {
    localStorage.setItem(USER_ID_KEY, String(userId));
  }
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_ID_KEY);
}

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export function clearOnUnauthorizedHandler(): void {
  onUnauthorized = null;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

export async function attemptTokenRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    console.info('[auth] refresh skipped: no refresh token present');
    return false;
  }

  if (isRefreshing && refreshPromise) {
    console.info('[auth] refresh already in-flight; joining existing attempt');
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    console.info('[auth] refresh attempt started');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        console.warn('[auth] refresh failed with status', res.status);
        return false;
      }
      const data: ApiTokenRefreshResponse = await res.json();
      setTokens(data.accessToken, data.refreshToken, data.userResponseDTO.id);
      console.info('[auth] refresh succeeded; token pair rotated');
      return true;
    } catch (err) {
      console.warn('[auth] refresh failed with error', err);
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  responseType: 'json' | 'text' = 'json',
): Promise<T> {
  const token = getAccessToken();
  const wasAuthenticated = !!token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_BASE_URL}/api/v1${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (getRefreshToken()) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed) {
        console.info(`[api] 401 on ${endpoint}; token refreshed, retrying`);
        const newToken = getAccessToken();
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(`${API_BASE_URL}/api/v1${endpoint}`, {
          ...options,
          headers,
        });
      } else {
        console.warn(`[api] 401 on ${endpoint}; refresh failed`);
      }
    }

    if (response.status === 401) {
      clearTokens();
      if (wasAuthenticated) {
        onUnauthorized?.();
      }
    }
  }

  if (!response.ok) {
    const body = await response.text();
    let message: string;
    try {
      const json = JSON.parse(body);
      message = json.message || json.error || body;
    } catch {
      message = body || response.statusText;
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (responseType === 'text') {
    return response.text() as Promise<T>;
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string, responseType: 'json' | 'text' = 'json') =>
    request<T>(endpoint, {}, responseType),

  post: <T>(endpoint: string, body?: unknown, responseType: 'json' | 'text' = 'json') =>
    request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, responseType),

  put: <T>(endpoint: string, body?: unknown, responseType: 'json' | 'text' = 'json') =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, responseType),

  patch: <T>(endpoint: string, body?: unknown, responseType: 'json' | 'text' = 'json') =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, responseType),

  delete: <T>(endpoint: string, responseType: 'json' | 'text' = 'json') =>
    request<T>(endpoint, { method: 'DELETE' }, responseType),
};
