export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  joinDate: string;
  streak: number;
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
  wordCount: WordCount;
  contentType: ContentType;
  date: string;
}

export interface Passage {
  text: string;
  author: string;
  source: string;
}

export type Duration = 15 | 30 | 60;
export type ContentType = 'words' | 'phrases';
export type TestMode = 'timed' | 'words';
export type WordCount = 10 | 25 | 50 | 100;
export type Mode = 'words' | 'phrases' | 'time';
export type PhraseLength = 'short' | 'medium' | 'long' | 'thicc' | 'all';

export type Theme = 'light' | 'dark';
