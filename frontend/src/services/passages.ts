import type { Passage, WordCount, PhraseLength, Mode } from '../types';
import { generateTestPassage as localGeneratePassage, getRandomPassage as localRandomPassage } from '../utils/passages';
import { generateRandomWords as localRandomWords } from '../utils/words';

export function generateTestPassage(
  mode: Mode,
  duration: number,
  wordCount: WordCount,
  phraseLength?: PhraseLength,
): Passage {
  return localGeneratePassage(mode, duration, wordCount, phraseLength);
}

export function getRandomPassage(): Passage {
  return localRandomPassage();
}

export function generateRandomWords(count: number): string {
  return localRandomWords(count);
}
