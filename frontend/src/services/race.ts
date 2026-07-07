import { api } from './api';
import type { RaceRoom, TextType } from '../types/race';

export async function createRoom(textType: TextType | null, isPrivate: boolean): Promise<string> {
  const data = await api.post<{ roomCode: string }>('/race/rooms', { textType, isPrivate });
  return data.roomCode;
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
