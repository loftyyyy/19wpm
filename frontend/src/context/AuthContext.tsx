import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, TestResult } from '../types';
import type { ApiAuthResponse, ApiUserProfile } from '../types/api';
import { loginUser, registerUser, logoutUser as serviceLogout, getSessionUser, updateUserProfile } from '../services/auth';
import { saveResult as localStorageSaveResult, getResults as localStorageGetResults, migrateGuestResults } from '../services/results';
import { api, setTokens, clearTokens, getAccessToken, ApiError } from '../services/api';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  addResult: (result: TestResult) => void;
  getResults: () => TestResult[];
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapProfileToUser(dto: ApiUserProfile): User {
  return {
    id: String(dto.userId),
    name: dto.firstName ? `${dto.firstName} ${dto.lastName}`.trim() : dto.username,
    email: dto.email,
    joinDate: dto.createdAt ? dto.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
    streak: 0,
  };
}

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

  const setUserAndMigrate = useCallback((u: User) => {
    setUser(u);
    migrateGuestResults(u.id);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    setIsLoading(true);
    try {
      const data = await api.post<ApiAuthResponse>('/auth/login', { email, password });
      setTokens(data.accessToken, data.refreshToken, data.userResponseDTO.id);
      setUserAndMigrate({
        id: String(data.userResponseDTO.id),
        name: data.userResponseDTO.username,
        email: data.userResponseDTO.email,
        joinDate: new Date().toISOString().split('T')[0],
        streak: 0,
      });
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

  const register = useCallback(async (name: string, email: string, password: string): Promise<string | null> => {
    setIsLoading(true);
    try {
      const nameParts = name.trim().split(/\s+/);
      const data = await api.post<ApiAuthResponse>('/auth/signup', {
        username: email.split('@')[0],
        firstName: nameParts[0] || name,
        lastName: nameParts.slice(1).join(' ') || '',
        email,
        password,
        country: '',
      });
      setTokens(data.accessToken, data.refreshToken, data.userResponseDTO.id);
      setUserAndMigrate({
        id: String(data.userResponseDTO.id),
        name: data.userResponseDTO.username,
        email: data.userResponseDTO.email,
        joinDate: new Date().toISOString().split('T')[0],
        streak: 0,
      });
      return null;
    } catch (err) {
      const isNetworkDown = err instanceof TypeError
        || (err instanceof ApiError && err.status >= 500);
      if (isNetworkDown) {
        const localResult = registerUser(name, email, password);
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
