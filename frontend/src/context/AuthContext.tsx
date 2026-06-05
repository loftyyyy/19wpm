import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, TestResult } from '../types';
import type { ApiAuthResponse, ApiAuthRequest, ApiRegisterRequest, ApiUserProfile, ApiTypingResultResponse } from '../types/api';
import { loginUser, registerUser, logoutUser as serviceLogout, getSessionUser, updateUserProfile, mapProfileToUser, mapMinimalUserToUser } from '../services/auth';
import { saveResult as localStorageSaveResult, getResults as localStorageGetResults, migrateGuestResults, apiGetResults } from '../services/results';
import { apiSaveResult } from '../services/results';
import { api, setTokens, clearTokens, getAccessToken, getStoredUserId, ApiError } from '../services/api';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (username: string, firstName: string, lastName: string, email: string, password: string, country: string) => Promise<string | null>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  addResult: (result: TestResult) => void;
  getResults: () => TestResult[];
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getSessionUser);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('19wpm-session', JSON.stringify(user));
    } else {
      localStorage.removeItem('19wpm-session');
    }
  }, [user]);

  // On mount, if we have tokens but no local session user, validate them via the API
  useEffect(() => {
    if (getAccessToken() && !getSessionUser()) {
      setIsLoading(true);
      api.get<ApiUserProfile>('/auth/me')
        .then(data => setUser(mapProfileToUser(data)))
        .catch(() => clearTokens())
        .finally(() => setIsLoading(false));
    }
  }, []);

  // Sync server-side typing results into localStorage on mount
  useEffect(() => {
    if (!getAccessToken()) return;
    apiGetResults().then(({ data }) => {
      if (!data || data.length === 0) return;
      const storedUserId = String(getStoredUserId());
      const key = `19wpm-results-${storedUserId}`;
      const existing: TestResult[] = JSON.parse(localStorage.getItem(key) || '[]');
      const existingKeys = new Set(existing.map(r => `${r.date}-${r.wpm}-${r.accuracy}`));
      const newResults: TestResult[] = [];
      for (const r of data) {
        const dedupKey = `${r.finishedAt || r.createdAt}-${r.wpm}-${r.accuracy}`;
        if (!existingKeys.has(dedupKey)) {
          newResults.push({
            id: String(r.typingResultId),
            textId: r.textId,
            passage: '',
            author: '',
            source: '',
            wpm: r.wpm,
            accuracy: r.accuracy,
            duration: Math.round(r.durationMs / 1000),
            correctChars: 0,
            incorrectChars: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            wpmHistory: [],
            mistakeWords: [],
            replayEvents: [],
            testMode: 'timed',
            wordCount: 10,
            contentType: 'words',
            date: r.finishedAt || r.createdAt,
          });
        }
      }
      if (newResults.length > 0) {
        localStorage.setItem(key, JSON.stringify([...newResults, ...existing]));
      }
    });
  }, []);

  const setUserAndMigrate = useCallback((u: User) => {
    setUser(u);
    migrateGuestResults(u.id);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    setIsLoading(true);
    try {
      const loginBody: ApiAuthRequest = { email, password };
      const data = await api.post<ApiAuthResponse>('/auth/login', loginBody);
      setTokens(data.accessToken, data.refreshToken, data.userResponseDTO.id);
      setUserAndMigrate(mapMinimalUserToUser(data.userResponseDTO));
      return null;
    } catch (err) {
      const isNetworkDown = err instanceof TypeError
        || (err instanceof ApiError && err.status >= 500);
      if (isNetworkDown) {
        const localResult = loginUser(email, password);
        if (localResult.user) {
          setUserAndMigrate(localResult.user);
          return null;
        }
      }
      const msg = err instanceof Error ? err.message : 'Login failed';
      return msg;
    } finally {
      setIsLoading(false);
    }
  }, [setUserAndMigrate]);

  const register = useCallback(async (username: string, firstName: string, lastName: string, email: string, password: string, country: string): Promise<string | null> => {
    setIsLoading(true);
    try {
      const registerBody: ApiRegisterRequest = { username, firstName, lastName, email, password, country };
      const data = await api.post<ApiAuthResponse>('/auth/signup', registerBody);
      setTokens(data.accessToken, data.refreshToken, data.userResponseDTO.id);
      const u = mapMinimalUserToUser(data.userResponseDTO);
      setUserAndMigrate({ ...u, firstName, lastName, country });
      return null;
    } catch (err) {
      const isNetworkDown = err instanceof TypeError
        || (err instanceof ApiError && err.status >= 500);
      if (isNetworkDown) {
        const localResult = registerUser(username, firstName, lastName, email, password, country);
        if (localResult.user) {
          setUserAndMigrate(localResult.user);
          return null;
        }
      }
      const msg = err instanceof Error ? err.message : 'Registration failed';
      return msg;
    } finally {
      setIsLoading(false);
    }
  }, [setUserAndMigrate]);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('19wpm-refresh-token');
      await api.post('/auth/logout', { refreshToken: refreshToken || '' });
    } catch {
      // API call best-effort; clear local state regardless
    }
    clearTokens();
    serviceLogout();
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      return updateUserProfile(prev.id, updates);
    });
  }, []);

  const addResult = useCallback((result: TestResult) => {
    localStorageSaveResult(result, user?.id);
    if (result.textId) {
      apiSaveResult({
        textId: result.textId,
        finishedAt: new Date(result.date).toISOString(),
        durationMs: result.duration * 1000,
        timeConstraintMs: null,
        wpm: result.wpm,
        accuracy: result.accuracy,
      });
    }
  }, [user]);

  const getResults = useCallback((): TestResult[] => {
    return localStorageGetResults(user?.id);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
      updateUser,
      addResult,
      getResults,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
