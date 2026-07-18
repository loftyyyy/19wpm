import { api, getAccessToken, API_BASE_URL } from './api';
import type { TextType } from '../types/race';

export async function createRoom(textType: TextType | null, isPrivate: boolean): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/v1/race/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
    },
    body: JSON.stringify({ textType, isPrivate }),
  });
  if (!response.ok) throw new Error('Failed to create room');
  return response.text();
}

export async function joinRoomByCode(code: string): Promise<string> {
  return code;
}

export async function joinMatchmaking(textType: TextType | null): Promise<void> {
  const token = localStorage.getItem('19wpm-access-token') ?? '';
  const response = await fetch(`${API_BASE_URL}/api/v1/race/matchmaking/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ textType })
  });
  if (!response.ok) throw new Error('Failed to join matchmaking');
}

export async function leaveMatchmaking(): Promise<void> {
  await api.post('/race/matchmaking/leave');
}

export async function getPendingMatch(): Promise<string | null> {
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || '';
  const token = localStorage.getItem('19wpm-access-token') ?? '';
  const response = await fetch(
    `${apiBase}/api/v1/race/matchmaking/pending`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (response.status === 204) return null;
  if (!response.ok) return null;
  return response.text();
}
