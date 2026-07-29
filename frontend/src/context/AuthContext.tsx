import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, TestResult, TestMode, ContentType } from '../types';
import type { ApiAuthResponse, ApiAuthRequest, ApiRegisterRequest, ApiUserProfile } from '../types/api';
import { loginUser, registerUser, logoutUser as serviceLogout, getSessionUser, updateUserProfile, mapProfileToUser, mapMinimalUserToUser } from '../services/auth';
import { saveGuestResult, getGuestResults, clearGuestResults, clearAllResults, migrateGuestResults, apiGetResults, apiSaveResult } from '../services/results';
import { api, setTokens, clearTokens, getAccessToken, setOnUnauthorizedHandler, clearOnUnauthorizedHandler, ApiError } from '../services/api';

function mapApiResultToTestResult(r: { typingResultId: number; textId: number; finishedAt: string; durationMs: number; wpm: number; accuracy: number; createdAt: string; textTitle?: string; textContent?: string; mode: 'TEXT' | 'WORDS'; wordCount: number }): TestResult {
  const isTextMode = r.mode === 'TEXT';
  return {
    id: String(r.typingResultId),
    textId: isTextMode ? r.textId : undefined,
    title: r.textTitle ?? '',
    passage: r.textContent ?? '',
    author: '',
    source: '',
    wpm: r.wpm,
    rawWpm: 0,
    consistency: 100,
    accuracy: r.accuracy,
    duration: Math.round(r.durationMs / 1000),
    correctChars: 0,
    incorrectChars: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    wpmHistory: [],
    mistakeWords: [],
    replayEvents: [],
    testMode: 'timed' as TestMode,
    wordCount: r.wordCount ?? r.textContent?.split(' ').length ?? 0,
    contentType: isTextMode ? 'phrases' as ContentType : 'words' as ContentType,
    date: r.finishedAt || r.createdAt,
  };
}

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
  setupFromOAuth: (u: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getSessionUser);
  const [isLoading, setIsLoading] = useState(!!getAccessToken());
  const [serverResults, setServerResults] = useState<TestResult[]>([]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('19wpm-session', JSON.stringify(user));
    } else {
      localStorage.removeItem('19wpm-session');
    }
  }, [user]);

  // Register the global 401 handler so any unrecoverable 401 clears auth state
  useEffect(() => {
    setOnUnauthorizedHandler(() => {
      clearTokens();
      serviceLogout();
      setUser(null);
      setServerResults([]);
      window.location.href = '/login';
    });
    return () => clearOnUnauthorizedHandler();
  }, []);

  // On mount, validate the stored token against the server.
  // Uses raw fetch to bypass the global 401 interceptor (which would redirect).
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      // No token — keep existing state (localStorage fallback mode)
      return;
    }

    setIsLoading(true);

    const validateToken = async () => {
      try {
        const res = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data: ApiUserProfile = await res.json();
          setUser(mapProfileToUser(data));
        } else if (res.status === 401) {
          clearTokens();
          serviceLogout();
          setUser(null);
          setServerResults([]);
        }
      } catch {
        // Network error — keep existing in-memory state for offline use
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, []);

  // Fetch results from the API when authenticated (on mount and after login/register)
  const fetchResults = useCallback(async () => {
    if (!getAccessToken()) return;
    const { data } = await apiGetResults();
    if (!data) return;
    setServerResults(data.map(mapApiResultToTestResult));
  }, []);

  useEffect(() => {
    if (getAccessToken()) {
      fetchResults();
    }
  }, [fetchResults]);

  const setUserAndMigrate = useCallback(async (u: User) => {
    setUser(u);
    const migrated = await migrateGuestResults();
    if (migrated) clearGuestResults();
    await fetchResults();
  }, [fetchResults]);

  const setupFromOAuth = useCallback(async (u: User) => {
    setUser(u);
    const migrated = await migrateGuestResults();
    if (migrated) clearGuestResults();
    await fetchResults();
  }, [fetchResults]);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    setIsLoading(true);
    try {
      const loginBody: ApiAuthRequest = { email, password };
      const data = await api.post<ApiAuthResponse>('/auth/login', loginBody);
      setTokens(data.accessToken, data.refreshToken, data.userResponseDTO.id);
      await setUserAndMigrate(mapMinimalUserToUser(data.userResponseDTO));
      return null;
    } catch (err) {
      const isNetworkDown = err instanceof TypeError
        || (err instanceof ApiError && err.status >= 500);
      if (isNetworkDown) {
        const localResult = loginUser(email, password);
        if (localResult.user) {
          await setUserAndMigrate(localResult.user);
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
      await setUserAndMigrate({ ...u, firstName, lastName, country });
      return null;
    } catch (err) {
      const isNetworkDown = err instanceof TypeError
        || (err instanceof ApiError && err.status >= 500);
      if (isNetworkDown) {
        const localResult = registerUser(username, firstName, lastName, email, password, country);
        if (localResult.user) {
          await setUserAndMigrate(localResult.user);
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
    clearAllResults();
    setUser(null);
    setServerResults([]);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      return updateUserProfile(prev.id, updates);
    });
  }, []);

  const addResult = useCallback((result: TestResult) => {
    if (!user) {
      saveGuestResult(result);
      return;
    }

    setServerResults(prev => [result, ...prev]);

    const isTextMode = result.contentType === 'phrases';

    apiSaveResult({
      mode: isTextMode ? 'TEXT' : 'WORDS',
      ...(isTextMode ? { textId: result.textId! } : {}),
      ...(isTextMode ? {} : { textContent: result.passage }),
      finishedAt: new Date(result.date).toISOString(),
      durationMs: result.duration * 1000,
      timeConstraintMs: null,
      wpm: result.wpm,
      accuracy: result.accuracy,
    }).then(({ error }) => {
      if (error) {
        console.error('Failed to save result to backend:', error);
      }
      fetchResults();
    });
  }, [user, fetchResults]);

  const getResults = useCallback((): TestResult[] => {
    if (user) return serverResults;
    return getGuestResults();
  }, [user, serverResults]);

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
      setupFromOAuth,
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
