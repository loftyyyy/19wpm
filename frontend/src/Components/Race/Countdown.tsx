import { useEffect, useRef, useState } from 'react';

interface Props {
  startTime: string;
  durationMs: number;
  onComplete: () => void;
}

function stepFor(remaining: number): string {
  if (remaining > 2500) return '3';
  if (remaining > 1500) return '2';
  if (remaining > 500) return '1';
  return 'GO!';
}

export default function Countdown({ startTime, durationMs, onComplete }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const firedRef = useRef(false);

  const startMs = new Date(startTime).getTime();
  const deadline = Number.isNaN(startMs)
    ? Date.now() + (durationMs > 0 ? durationMs : 3500)
    : startMs + durationMs;
  const remaining = Math.max(0, deadline - now);

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
        {stepFor(remaining)}
      </span>
    </div>
  );
}
