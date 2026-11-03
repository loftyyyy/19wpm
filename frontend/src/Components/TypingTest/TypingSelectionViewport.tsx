import TypingViewport from './TypingViewport';
import { useMistakeTracker, useTypingSelection, type TypingStore } from '../../utils/typingStore';

interface TypingSelectionViewportProps {
  store: TypingStore;
  charsText: string;
  extraVariant?: 'plain' | 'block';
  resetKey?: number;
  measureKey?: unknown;
}

/**
 * Subscribes the passage to the typing store.
 *
 * This wrapper is the seam that keeps `TypingViewport` presentational: it reads
 * the character-level slice and the mistake set from the store and passes them
 * down as props. A keystroke re-renders this component and the memoized viewport
 * below it — the container that owns the store does not re-render at all.
 */
export default function TypingSelectionViewport({
  store,
  charsText,
  extraVariant,
  resetKey,
  measureKey,
}: TypingSelectionViewportProps) {
  const selection = useTypingSelection(store);
  const mistakeWordIndices = useMistakeTracker(store);

  return (
    <TypingViewport
      charsText={charsText}
      typedChars={selection.typedChars}
      currentIndex={selection.currentIndex}
      lockedIndex={selection.lockedIndex}
      mistakeWordIndices={mistakeWordIndices}
      extraChars={selection.extraChars}
      isFinished={selection.isFinished}
      extraVariant={extraVariant}
      resetKey={resetKey}
      measureKey={measureKey}
    />
  );
}
