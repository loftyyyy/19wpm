import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  startTime: string;
  durationMs: number;
  offsetMs?: number;
  onComplete: () => void;
}

const DEFAULT_DURATION_MS = 3500;

function stepFor(remaining: number, durationMs: number): string {
  if (remaining > (durationMs * 5) / 7) return '3';
  if (remaining > (durationMs * 3) / 7) return '2';
  if (remaining > durationMs / 7) return '1';
  return 'GO!';
}

export default function Countdown({ startTime, durationMs, offsetMs = 0, onComplete }: Props) {
  const [now, setNow] = useState(() => Date.now());
  // Fallback origin for races whose startTime is missing or malformed.
  const [fallbackStartMs] = useState(() => Date.now());
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  const firedRef = useRef(false);

  const duration = durationMs > 0 ? durationMs : DEFAULT_DURATION_MS;

  const deadline = useMemo(() => {
    const startMs = new Date(startTime).getTime();
    return Number.isNaN(startMs)
      ? fallbackStartMs + offsetMs + duration
      : startMs + duration;
  }, [startTime, duration, offsetMs, fallbackStartMs]);

  const remaining = Math.max(0, deadline - (now + offsetMs));

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (remaining > 0 || firedRef.current) return;
    firedRef.current = true;
    onCompleteRef.current();
  }, [remaining]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface">
      <span className="text-8xl font-display font-bold text-accent animate-ping">
        {stepFor(remaining, duration)}
      </span>
    </div>
  );
}
