import { api, getAccessToken, API_BASE_URL } from './api';
import type { RaceRoom, TextType } from '../types/race';

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

export async function joinRoomByCode(code: string): Promise<RaceRoom> {
  return api.post<RaceRoom>(`/race/rooms/${code}/join`);
}

export async function joinMatchmaking(textType: TextType | null): Promise<void> {
  await api.post('/race/matchmaking/join', { textType });
}

export async function leaveMatchmaking(): Promise<void> {
  await api.post('/race/matchmaking/leave');
}
