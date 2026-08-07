export type RaceState = 'LOBBY' | 'COUNTDOWN' | 'RACING' | 'FINISHED';
export type TextType = 'SHORT' | 'MEDIUM' | 'LONG' | 'THICC';

export interface RaceParticipant {
  userId: number;
  username: string;
  ready: boolean;
  finished: boolean;
  disconnected: boolean;
  connected: boolean;
  progressPercent: number;
  currentWpm: number;
  errors: number;
  correctChars: number;
  accuracy: number;
  finishRank: number;
}

export interface RaceText {
  textId: number;
  content: string;
  title: string;
  author: string;
  wordCount: number;
  charLength: number;
}

export interface RaceRoom {
  roomCode: string;
  state: RaceState;
  textType: TextType;
  private: boolean;
  hostUserId: number | null;
  participants: RaceParticipant[];
  text: RaceText | null;
  startTime: string | null;
  finishCount: number;
  countdownStartTime: string | null;
  countdownDurationMs: number;
  durationSeconds: number;
}
