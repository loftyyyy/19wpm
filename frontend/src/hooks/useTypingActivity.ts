import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks whether the user is actively typing, used to pause the blinking caret
 * while keys are being pressed. `markActive` resets a short idle timer on each
 * keystroke; the timer is cleared on unmount.
 */
export function useTypingActivity() {
  const [isTypingActive, setIsTypingActive] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markActive = useCallback(() => {
    setIsTypingActive(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIsTypingActive(false), 500);
  }, []);

  useEffect(() => () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, []);

  return { isTypingActive, markActive };
}
