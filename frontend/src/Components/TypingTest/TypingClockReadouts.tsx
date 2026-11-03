import { useLayoutEffect } from 'react';
import { useClock, useClockValue } from '../../utils/typingClock';
import { completeTick } from '../../utils/performance';
import type { TestMode } from '../../types';

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full h-1.5 bg-muted rounded-full mb-8 transition-theme">
      <div
        className="h-full bg-accent rounded-full transition-all duration-100"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/**
 * Countdown readout. Only this span re-renders on each 100 ms clock sample, so
 * the passage and its characters are not part of the timer's render path.
 */
export function TestTimer() {
  const timeLeft = useClockValue(snapshot => snapshot.timeLeft);
  const display = timeLeft >= 60
    ? `${Math.floor(timeLeft / 60)}:${String(Math.floor(timeLeft % 60)).padStart(2, '0')}`
    : `${Math.floor(timeLeft)}`;
  return (
    <div className="text-3xl font-mono font-bold text-accent transition-theme">
      {display}
    </div>
  );
}

/**
 * Live WPM. It subscribes to the whole snapshot rather than one field, which
 * keeps it re-rendering on every sample — that commit is where the `19wpm:tick`
 * sample closes, and it happens without touching the typing tree.
 */
export function LiveWpm() {
  const { wpm } = useClock();
  useLayoutEffect(() => {
    completeTick();
  });
  return <span><span className="text-accent font-semibold">{wpm}</span> wpm</span>;
}

function TimedProgress({ totalTime }: { totalTime: number }) {
  const elapsedSeconds = useClockValue(snapshot => snapshot.elapsedSeconds);
  const percent = totalTime > 0 ? Math.min(100, (elapsedSeconds / totalTime) * 100) : 0;
  return <ProgressBar percent={percent} />;
}

interface TestProgressProps {
  testMode: TestMode;
  totalTime: number;
  completedWords: number;
  totalWords: number;
  isFinished: boolean;
}

/** Timed runs follow the clock; words runs follow the completed-word count. */
export function TestProgress({ testMode, totalTime, completedWords, totalWords, isFinished }: TestProgressProps) {
  if (testMode === 'timed') return <TimedProgress totalTime={totalTime} />;
  const percent = totalWords > 0 ? ((isFinished ? totalWords : completedWords) / totalWords) * 100 : 0;
  return <ProgressBar percent={percent} />;
}
