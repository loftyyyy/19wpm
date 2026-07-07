import { useState, useEffect } from 'react';

interface Props {
  onComplete: () => void;
}

const STEPS = [3, 2, 1, 'GO!'] as const;

export default function Countdown({ onComplete }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length) {
      onComplete();
      return;
    }

    const delay = step === STEPS.length - 1 ? 500 : 1000;
    const timer = setTimeout(() => setStep((s) => s + 1), delay);
    return () => clearTimeout(timer);
  }, [step, onComplete]);

  if (step >= STEPS.length) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface">
      <span className="text-8xl font-display font-bold text-accent animate-ping">
        {STEPS[step]}
      </span>
    </div>
  );
}
