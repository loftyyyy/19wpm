import { useState, useEffect } from 'react';

export function useCapsLock(): boolean {
  const [isCapsLock, setIsCapsLock] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setIsCapsLock(e.getModifierState('CapsLock'));
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return isCapsLock;
}
