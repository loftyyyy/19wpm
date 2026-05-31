import type { User } from '../types';

const USERS_KEY = '19wpm-users';
const SESSION_KEY = '19wpm-session';

interface StoredUser extends User {
  password: string;
}

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

export function loginUser(email: string, password: string): { user: User | null; error: string | null } {
  const users = getStoredUsers();
  const found = users.find(u => u.email === email);
  if (!found) return { user: null, error: 'No account found with this email.' };
  if (found.password !== password) return { user: null, error: 'Incorrect password.' };
  const { password: _, ...safe } = found;
  localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
  return { user: safe, error: null };
}

export function registerUser(name: string, email: string, password: string): { user: User | null; error: string | null } {
  const users = getStoredUsers();
  if (users.find(u => u.email === email)) return { user: null, error: 'An account with this email already exists.' };
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
  localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
  return { user: safe, error: null };
}

export function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
}

export function getSessionUser(): User | null {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function updateUserProfile(id: string, updates: Partial<User>): User | null {
  const users = getStoredUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...updates };
  setStoredUsers(users);
  const { password: _, ...safe } = users[idx];
  localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
  return safe;
}
