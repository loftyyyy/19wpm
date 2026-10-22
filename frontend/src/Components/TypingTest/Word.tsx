import { memo, useCallback } from 'react';
import type { CSSProperties } from 'react';

const EXTRA_BLOCK_STYLE: CSSProperties = {
  color: 'var(--error)',
  backgroundColor: 'var(--error)',
};

const EXTRA_BLOCK_TEXT_STYLE: CSSProperties = {
  color: '#fff',
};

export interface WordChar {
  char: string;
  globalIdx: number;
}

export interface WordProps {
  chars: WordChar[];
  start: number;
  end: number;
  typedChars: string[];
  isPastWord: boolean;
  hasError: boolean;
  isActive: boolean;
  activeCharIndex: number;
  lastGlobalIdx: number;
  extraChars: string[];
  extraVariant?: 'plain' | 'block';
  wordIndex: number;
  onWordRef: (index: number, el: HTMLSpanElement | null) => void;
  onCurrentCharRef: (el: HTMLSpanElement | null) => void;
  onLastCharRef: (el: HTMLSpanElement | null) => void;
}

function Word({
  chars,
  typedChars,
  isPastWord,
  hasError,
  isActive,
  activeCharIndex,
  lastGlobalIdx,
  extraChars,
  extraVariant = 'plain',
  wordIndex,
  onWordRef,
  onCurrentCharRef,
  onLastCharRef,
}: WordProps) {
  const setWordRef = useCallback(
    (el: HTMLSpanElement | null) => onWordRef(wordIndex, el),
    [onWordRef, wordIndex]
  );

  const wordErrorClass = isPastWord && hasError
    ? 'underline decoration-error decoration-2'
    : '';

  return (
    <span ref={setWordRef} className={`flex ${wordErrorClass}`}>
      {chars.map(({ char, globalIdx }) => {
        const typed = typedChars[globalIdx];
        const isLastChar = globalIdx === lastGlobalIdx;
        const isCurrent = globalIdx === activeCharIndex;
        const isSkipped = typed === '';
        const isCorrect = typed !== undefined && typed !== '' && typed === char;
        const isIncorrect = typed !== undefined && (typed !== '' ? typed !== char : true);

        let cls = 'char-untyped';
        if (isCorrect) cls = 'char-correct';
        if (isIncorrect || isSkipped) cls = 'char-incorrect';

        const displayChar = (isIncorrect && typed !== undefined && typed !== '')
          ? typed
          : char;

        return (
          <span
            key={globalIdx}
            ref={isCurrent ? onCurrentCharRef : isLastChar ? onLastCharRef : undefined}
            className={cls}
          >
            {displayChar}
          </span>
        );
      })}
      {isActive && extraChars.map((ch, i) => (
        extraVariant === 'block' ? (
          <span
            key={`ex-${i}`}
            className="char-incorrect"
            style={EXTRA_BLOCK_STYLE}
          >
            <span style={EXTRA_BLOCK_TEXT_STYLE}>{ch}</span>
          </span>
        ) : (
          <span key={`ex-${i}`} className="char-incorrect">{ch}</span>
        )
      ))}
    </span>
  );
}

function areEqual(prev: WordProps, next: WordProps): boolean {
  if (prev.chars !== next.chars) return false;
  if (prev.start !== next.start || prev.end !== next.end) return false;
  if (prev.isPastWord !== next.isPastWord) return false;
  if (prev.hasError !== next.hasError) return false;
  if (prev.isActive !== next.isActive) return false;
  if (prev.activeCharIndex !== next.activeCharIndex) return false;
  if (prev.lastGlobalIdx !== next.lastGlobalIdx) return false;
  if (prev.extraChars !== next.extraChars) return false;
  if (prev.extraVariant !== next.extraVariant) return false;

  if (!prev.isActive) return true;

  const a = prev.typedChars;
  const b = next.typedChars;
  if (a === b) return true;
  for (let i = prev.start; i < prev.end; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export default memo(Word, areEqual);
