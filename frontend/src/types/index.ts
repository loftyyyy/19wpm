export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  avatar?: string;
  joinDate: string;
  streak: number;
  isActive: boolean;
}

export interface WpmPoint {
  time: number;
  wpm: number;
  errors: number;
}

export interface MistakeWord {
  expected: string;
  typed: string;
}

export interface ReplayEvent {
  type: 'key' | 'backspace' | 'deleteWord';
  key?: string;
  timestamp: number;
}

export interface TestResult {
  id: string;
  textId?: number;
  title: string;
  passage: string;
  author: string;
  source: string;
  wpm: number;
  accuracy: number;
  duration: number;
  correctChars: number;
  incorrectChars: number;
  totalCorrect: number;
  totalIncorrect: number;
  wpmHistory: WpmPoint[];
  mistakeWords: MistakeWord[];
  replayEvents: ReplayEvent[];
  testMode: TestMode;
  wordCount: number;
  contentType: ContentType;
  date: string;
  difficulty?: TextDifficulty;
}

export type TextDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
export type TextType = 'SHORT' | 'MEDIUM' | 'LONG' | 'THICC';

export interface Passage {
  textId?: number;
  title: string;
  text: string;
  author: string;
  source: string;
  type?: TextType;
}

export type Duration = 15 | 30 | 60;
export type ContentType = 'words' | 'phrases';
export type TestMode = 'timed' | 'words';
export type WordCount = 10 | 25 | 50 | 100;
export type Mode = 'words' | 'phrases' | 'time';
export type PhraseLength = 'short' | 'medium' | 'long' | 'thicc' | 'all';

export type Theme = 'light' | 'dark';

export function userDisplayName(user: Pick<User, 'firstName' | 'lastName' | 'username'>): string {
  if (user.firstName || user.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  }
  return user.username;
}
