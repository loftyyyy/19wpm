import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, TestResult } from '../types';
import { loginUser, registerUser, logoutUser as serviceLogout, getSessionUser, updateUserProfile } from '../services/auth';
import { saveResult as saveResultService, getResults as getResultsService, migrateGuestResults } from '../services/results';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => string | null;
  register: (name: string, email: string, password: string) => string | null;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  addResult: (result: TestResult) => void;
  getResults: () => TestResult[];
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getSessionUser);

  useEffect(() => {
    if (user) {
      localStorage.setItem('19wpm-session', JSON.stringify(user));
    } else {
      localStorage.removeItem('19wpm-session');
    }
  }, [user]);

  const login = useCallback((email: string, password: string): string | null => {
    const { user: u, error } = loginUser(email, password);
    if (error || !u) return error;
    migrateGuestResults(u.id);
    setUser(u);
    return null;
  }, []);

  const register = useCallback((name: string, email: string, password: string): string | null => {
    const { user: u, error } = registerUser(name, email, password);
    if (error || !u) return error;
    migrateGuestResults(u.id);
    setUser(u);
    return null;
  }, []);

  const logout = useCallback(() => {
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
    saveResultService(result, user?.id);
  }, [user]);

  const getResults = useCallback((): TestResult[] => {
    return getResultsService(user?.id);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, register, logout, updateUser, addResult, getResults }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
