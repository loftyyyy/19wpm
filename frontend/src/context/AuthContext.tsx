import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, TestResult } from '../types';

const USERS_KEY = '19wpm-users';
const SESSION_KEY = '19wpm-session';

interface StoredUser extends User {
  password: string;
}

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

function getStoredUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function setStoredUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSessionUser(): User | null {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function setSessionUser(user: User | null) {
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getSessionUser);

  useEffect(() => {
    setSessionUser(user);
  }, [user]);

  const login = useCallback((email: string, password: string): string | null => {
    const users = getStoredUsers();
    const found = users.find(u => u.email === email);
    if (!found) return 'No account found with this email.';
    if (found.password !== password) return 'Incorrect password.';
    const { password: _, ...safe } = found;
    setUser(safe);
    return null;
  }, []);

  const register = useCallback((name: string, email: string, password: string): string | null => {
    const users = getStoredUsers();
    if (users.find(u => u.email === email)) return 'An account with this email already exists.';
    const newUser: StoredUser = {
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      name,
      email,
      password,
      joinDate: new Date().toISOString().split('T')[0],
      streak: 0,
    };
    setStoredUsers([...users, newUser]);
    const { password: _, ...safe } = newUser;
    setUser(safe);
    return null;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      const users = getStoredUsers();
      const idx = users.findIndex(u => u.id === prev.id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updates };
        setStoredUsers(users);
      }
      return updated;
    });
  }, []);

  const addResult = useCallback((result: TestResult) => {
    if (!user) return;
    const key = `19wpm-results-${user.id}`;
    const existing: TestResult[] = JSON.parse(localStorage.getItem(key) || '[]');
    existing.unshift(result);
    localStorage.setItem(key, JSON.stringify(existing));
  }, [user]);

  const getResults = useCallback((): TestResult[] => {
    if (!user) return [];
    const key = `19wpm-results-${user.id}`;
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
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
