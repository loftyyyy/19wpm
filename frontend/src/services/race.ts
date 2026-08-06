import { api } from './api';
import type { RaceRoom, TextType } from '../types/race';

export async function createRoom(textType: TextType | null, isPrivate: boolean): Promise<string> {
  return api.post<string>('/race/rooms', { textType, isPrivate }, 'text');
}

export async function joinRoomByCode(code: string): Promise<string> {
  return code;
}

export async function joinMatchmaking(textType: TextType | null): Promise<void> {
  await api.post('/race/matchmaking/join', { textType }, 'text');
}

export async function leaveMatchmaking(): Promise<void> {
  await api.post('/race/matchmaking/leave', undefined, 'text');
}

export async function getPendingMatch(): Promise<string | null> {
  try {
    const code = await api.get<string | undefined>('/race/matchmaking/pending', 'text');
    return code || null;
  } catch (err) {
    console.warn('[race] getPendingMatch failed', err);
    return null;
  }
}

export async function getRoomState(code: string): Promise<RaceRoom | null> {
  try {
    return await api.get<RaceRoom>(`/race/rooms/${code}`);
  } catch (err) {
    console.warn(`[race] getRoomState failed for ${code}`, err);
    return null;
  }
}
