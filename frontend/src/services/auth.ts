import type { User } from '../types';
import type {
  ApiAuthRequest,
  ApiRegisterRequest,
  ApiAuthResponse,
  ApiUserProfile,
  ApiUserUpdateRequest,
  ApiUserDeactivateRequest,
  ApiLogoutRequest,
} from '../types/api';
import { api, setTokens, clearTokens, getAccessToken, getStoredUserId } from './api';

// ── Existing localStorage-based functions (unchanged) ──

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

// ── New API-based functions ──

function mapMinimalUserToUser(dto: NonNullable<ApiAuthResponse['userResponseDTO']>): User {
  return {
    id: String(dto.id),
    name: dto.username,
    email: dto.email,
    joinDate: new Date().toISOString().split('T')[0],
    streak: 0,
  };
}

function mapProfileToUser(dto: ApiUserProfile): User {
  return {
    id: String(dto.userId),
    name: dto.firstName ? `${dto.firstName} ${dto.lastName}`.trim() : dto.username,
    email: dto.email,
    joinDate: dto.createdAt ? dto.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
    streak: 0,
  };
}

export async function apiLogin(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const body: ApiAuthRequest = { email, password };
    const data = await api.post<ApiAuthResponse>('/auth/login', body);
    setTokens(data.accessToken, data.refreshToken, data.userResponseDTO.id);
    const user = mapMinimalUserToUser(data.userResponseDTO);
    return { user, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Login failed';
    return { user: null, error: msg };
  }
}

export async function apiRegister(
  username: string,
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  country: string,
): Promise<{ user: User | null; error: string | null }> {
  try {
    const body: ApiRegisterRequest = { username, firstName, lastName, email, password, country };
    const data = await api.post<ApiAuthResponse>('/auth/signup', body);
    setTokens(data.accessToken, data.refreshToken, data.userResponseDTO.id);
    const user = mapMinimalUserToUser(data.userResponseDTO);
    return { user, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Registration failed';
    return { user: null, error: msg };
  }
}

export async function apiLogout(): Promise<void> {
  try {
    const refreshToken = localStorage.getItem('19wpm-refresh-token');
    const body: ApiLogoutRequest = { refreshToken: refreshToken || '' };
    await api.post('/auth/logout', body);
  } catch {
    // Silently fail — we clear tokens regardless
  } finally {
    clearTokens();
  }
}

export async function apiGetSessionUser(): Promise<User | null> {
  if (!getAccessToken()) return null;
  try {
    const data = await api.get<ApiUserProfile>('/auth/me');
    return mapProfileToUser(data);
  } catch {
    clearTokens();
    return null;
  }
}

export async function apiUpdateProfile(
  firstName: string,
  lastName: string,
  country: string,
  currentPassword: string,
): Promise<{ user: User | null; error: string | null }> {
  const userId = getStoredUserId();
  if (userId === null) {
    return { user: null, error: 'Not authenticated' };
  }

  try {
    const body: ApiUserUpdateRequest = { firstName, lastName, country, currentPassword };
    await api.patch(`/users/${userId}`, body);
    const user = await apiGetSessionUser();
    return { user, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Update failed';
    return { user: null, error: msg };
  }
}

export async function apiDeactivateAccount(currentPassword: string): Promise<{ error: string | null }> {
  try {
    const body: ApiUserDeactivateRequest = { currentPassword };
    await api.put('/users/deactivate', body);
    clearTokens();
    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Deactivation failed';
    return { error: msg };
  }
}
