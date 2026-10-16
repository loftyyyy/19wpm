import { memo } from 'react';

export interface TypedWordChar {
  char: string;
  globalIdx: number;
}

export interface TypedWordProps {
  chars: TypedWordChar[];
  start: number;
  end: number;
  typedChars: string[];
  isPastWord: boolean;
  hasError: boolean;
  showExtra: boolean;
  activeGlobalIdx: number;
  lastGlobalIdx: number;
  extraChars: string[];
  extraVariant?: 'plain' | 'block';
  onWordRef: (el: HTMLSpanElement | null) => void;
  onCurrentCharRef: (el: HTMLSpanElement | null) => void;
  onLastCharRef: (el: HTMLSpanElement | null) => void;
}

function TypedWord({
  chars,
  typedChars,
  isPastWord,
  hasError,
  showExtra,
  activeGlobalIdx,
  lastGlobalIdx,
  extraChars,
  extraVariant = 'plain',
  onWordRef,
  onCurrentCharRef,
  onLastCharRef,
}: TypedWordProps) {
  const wordErrorClass = isPastWord && hasError
    ? 'underline decoration-error decoration-2'
    : '';

  return (
    <span ref={onWordRef} className={`flex ${wordErrorClass}`}>
      {chars.map(({ char, globalIdx }) => {
        const typed = typedChars[globalIdx];
        const isLastChar = globalIdx === lastGlobalIdx;
        const isCurrent = globalIdx === activeGlobalIdx;
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
            ref={el => {
              if (isCurrent) onCurrentCharRef(el);
              if (isLastChar) onLastCharRef(el);
            }}
            className={cls}
          >
            {displayChar}
          </span>
        );
      })}
      {showExtra && extraChars.map((ch, i) => (
        extraVariant === 'block' ? (
          <span
            key={`ex-${i}`}
            className="char-incorrect"
            style={{ color: 'var(--error)', backgroundColor: 'var(--error)' }}
          >
            <span style={{ color: '#fff' }}>{ch}</span>
          </span>
        ) : (
          <span key={`ex-${i}`} className="char-incorrect">{ch}</span>
        )
      ))}
    </span>
  );
}

function areEqual(prev: TypedWordProps, next: TypedWordProps): boolean {
  if (prev.chars !== next.chars) return false;
  if (prev.start !== next.start || prev.end !== next.end) return false;
  if (prev.isPastWord !== next.isPastWord) return false;
  if (prev.hasError !== next.hasError) return false;
  if (prev.showExtra !== next.showExtra) return false;
  if (prev.activeGlobalIdx !== next.activeGlobalIdx) return false;
  if (prev.lastGlobalIdx !== next.lastGlobalIdx) return false;
  if (prev.extraChars !== next.extraChars) return false;
  if (prev.extraVariant !== next.extraVariant) return false;

  const a = prev.typedChars;
  const b = next.typedChars;
  if (a === b) return true;
  for (let i = prev.start; i < prev.end; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export default memo(TypedWord, areEqual);
