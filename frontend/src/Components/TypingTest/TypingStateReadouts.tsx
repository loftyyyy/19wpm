import { useTypingValue, type TypingStore } from '../../utils/typingStore';

/** Live accuracy. Only this span re-renders when a keystroke changes it. */
export function AccuracyReadout({ store }: { store: TypingStore }) {
  const accuracy = useTypingValue(store, snapshot => snapshot.accuracy);
  const tone = accuracy >= 95 ? 'text-success' : accuracy >= 80 ? 'text-accent' : 'text-error';
  return (
    <span>
      <span className={tone}>{accuracy}%</span> acc
    </span>
  );
}

interface WordsReadoutProps {
  store: TypingStore;
  totalWords: number;
}

/**
 * Words-mode progress counter. It subscribes to the store itself, so submitting a
 * word updates the counter without re-rendering the page around the passage.
 */
export function WordsReadout({ store, totalWords }: WordsReadoutProps) {
  const completedWords = useTypingValue(store, snapshot => snapshot.completedWords);
  const isFinished = useTypingValue(store, snapshot => snapshot.isFinished);
  const completed = isFinished ? totalWords : completedWords;
  return (
    <div className="text-base font-mono text-accent transition-theme">
      {completed} / {totalWords}
    </div>
  );
}
