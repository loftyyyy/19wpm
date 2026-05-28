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
  date: string;
}

export interface Passage {
  text: string;
  author: string;
  source: string;
}

export type Duration = 15 | 30 | 60;

export type Theme = 'light' | 'dark';
