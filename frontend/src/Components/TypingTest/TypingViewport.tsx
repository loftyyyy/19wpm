import { useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { animate } from 'animejs';
import TypedWord from './TypedWord';

const NO_EXTRA_CHARS: string[] = [];

interface TypingViewportProps {
  charsText: string;
  typedChars: string[];
  currentIndex: number;
  lockedIndex: number;
  mistakeWordIndices: Set<number>;
  extraChars: string[];
  isFinished: boolean;
  isTypingActive: boolean;
  extraVariant?: 'plain' | 'block';
  resetKey?: number;
  measureKey?: unknown;
}

export default function TypingViewport({
  charsText,
  typedChars,
  currentIndex,
  lockedIndex,
  mistakeWordIndices,
  extraChars,
  isFinished,
  isTypingActive,
  extraVariant,
  resetKey,
  measureKey,
}: TypingViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const cursorRef = useRef<HTMLDivElement>(null);
  const currentCharRef = useRef<HTMLSpanElement | null>(null);
  const lastCharRef = useRef<HTMLSpanElement | null>(null);
  const caretAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
  const isFirstPositionRef = useRef(true);
  const scrollAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
  const lineCacheRef = useRef<{ sortedTops: number[]; lineHeight: number } | null>(null);

  const setCurrentCharRef = useCallback((el: HTMLSpanElement | null) => {
    currentCharRef.current = el;
  }, []);
  const setLastCharRef = useCallback((el: HTMLSpanElement | null) => {
    lastCharRef.current = el;
  }, []);

  const passageWords = useMemo(() => {
    if (!charsText) return [];
    const words: { chars: { char: string; globalIdx: number }[] }[] = [];
    let globalIdx = 0;
    let currentWord: { char: string; globalIdx: number }[] = [];
    for (const ch of charsText.split('')) {
      if (ch === ' ') {
        if (currentWord.length > 0) {
          words.push({ chars: currentWord });
          currentWord = [];
        }
        globalIdx++;
      } else {
        currentWord.push({ char: ch, globalIdx });
        globalIdx++;
      }
    }
    if (currentWord.length > 0) words.push({ chars: currentWord });
    return words;
  }, [charsText]);

  const currentWordIndex = useMemo(() => {
    if (passageWords.length === 0) return 0;
    for (let i = 0; i < passageWords.length; i++) {
      const word = passageWords[i];
      const first = word.chars[0].globalIdx;
      const last = word.chars[word.chars.length - 1].globalIdx;
      if (currentIndex >= first && currentIndex <= last) return i;
      if (i > 0 && currentIndex === first - 1) return i - 1;
    }
    return Math.max(0, passageWords.length - 1);
  }, [currentIndex, passageWords]);

  useEffect(() => {
    lineCacheRef.current = null;
    if (contentRef.current) {
      contentRef.current.style.marginTop = '0px';
    }
    isFirstPositionRef.current = true;
  }, [charsText, resetKey]);

  useLayoutEffect(() => {
    const elements = wordRefs.current;
    if (!elements.length || !contentRef.current || !viewportRef.current) return;

    if (!lineCacheRef.current) {
      const tops = new Set<number>();
      elements.forEach(el => { if (el) tops.add(el.offsetTop); });
      const sortedTops = [...tops].sort((a, b) => a - b);
      if (sortedTops.length < 2) return;
      const lineHeight = sortedTops[1] - sortedTops[0];
      viewportRef.current.style.height = `${lineHeight * 3}px`;
      lineCacheRef.current = { sortedTops, lineHeight };
    }

    const { sortedTops } = lineCacheRef.current;
    const currentEl = elements[currentWordIndex];
    if (!currentEl) return;

    const lineIdx = sortedTops.indexOf(currentEl.offsetTop);
    if (lineIdx < 0) return;

    // Show current word on line 2 (index 1), like Monkeytype
    const targetLine = Math.max(0, lineIdx - 1);
    const newMarginTop = -sortedTops[targetLine];

    const currentMarginTop = parseFloat(
      contentRef.current.style.marginTop || '0'
    );

    if (Math.abs(newMarginTop - currentMarginTop) < 1) return;

    // Cancel in-flight scroll animation
    scrollAnimationRef.current?.pause();

    // Animate marginTop at 125ms like Monkeytype
    scrollAnimationRef.current = animate(contentRef.current, {
      marginTop: newMarginTop,
      duration: 125,
      ease: 'inOut(2)',
    });
  }, [currentWordIndex, passageWords.length, measureKey]);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      const cursorEl = cursorRef.current;
      const containerEl = contentRef.current;
      if (!cursorEl || !containerEl) return;

      const passageLength = charsText.length;
      const isAtEnd = currentIndex >= passageLength;

      let targetEl: HTMLSpanElement | null = null;
      let useRightEdge = false;

      const shouldUseRightEdge = isAtEnd || charsText[currentIndex] === ' ';

      if (shouldUseRightEdge && (lastCharRef.current || currentCharRef.current)) {
        targetEl = currentCharRef.current ?? lastCharRef.current;
        useRightEdge = true;
      } else if (currentCharRef.current) {
        targetEl = currentCharRef.current;
        useRightEdge = false;
      }

      if (!targetEl) return;

      // Use offsetLeft/offsetTop relative to contentRef
      // like Monkeytype does, NOT getBoundingClientRect
      let el: HTMLElement | null = targetEl;
      let left = useRightEdge ? el.offsetWidth : 0;
      let top = 0;
      while (el && el !== containerEl) {
        left += el.offsetLeft;
        top += el.offsetTop;
        el = el.offsetParent as HTMLElement;
      }

      // Center vertically like Monkeytype:
      // top += (letterHeight - caretHeight) / 2
      const caretHeight = parseFloat(
        getComputedStyle(cursorEl).height
      );
      top += (targetEl.offsetHeight - caretHeight) / 2;
      // Shift left by half caret width to sit between chars
      left -= 1;

      if (isFirstPositionRef.current) {
        // Teleport on first render — no animation
        isFirstPositionRef.current = false;
        cursorEl.style.left = `${left}px`;
        cursorEl.style.top = `${top}px`;
        return;
      }

      // Cancel any in-flight animation
      caretAnimationRef.current?.pause();

      // Animate with Monkeytype's exact easing
      caretAnimationRef.current = animate(cursorEl, {
        left,
        top,
        duration: 85,
        ease: 'inOut(1.25)',
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, [currentIndex, charsText]);

  const passageLength = charsText.length;
  const isAtEnd = currentIndex >= passageLength;
  const currentCharIsSpace = charsText[currentIndex] === ' ';
  const activeGlobalIdx = isAtEnd
    ? -1
    : currentCharIsSpace
      ? currentIndex - 1
      : currentIndex;
  const lastGlobalIdx = passageLength - 1;

  return (
    <div ref={viewportRef} className="overflow-hidden">
      <div ref={contentRef} className="flex flex-wrap gap-x-2 gap-y-1 relative">
        <div
          ref={cursorRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '2px',
            height: '1.2em',
            backgroundColor: 'var(--accent)',
            borderRadius: '1px',
            pointerEvents: 'none',
            zIndex: 10,
            display: isFinished ? 'none' : 'block',
          }}
          className={isTypingActive ? '' : 'animate-blink'}
        />
        {passageWords.map((word, wi) => {
          const { chars } = word;
          const start = chars[0].globalIdx;
          const end = start + chars.length;
          const showExtra = wi === currentWordIndex;
          return (
            <TypedWord
              key={wi}
              chars={chars}
              start={start}
              end={end}
              typedChars={typedChars}
              isPastWord={lockedIndex >= end}
              hasError={mistakeWordIndices.has(wi)}
              showExtra={showExtra}
              activeGlobalIdx={activeGlobalIdx}
              lastGlobalIdx={lastGlobalIdx}
              extraChars={showExtra ? extraChars : NO_EXTRA_CHARS}
              extraVariant={extraVariant}
              onWordRef={el => { wordRefs.current[wi] = el; }}
              onCurrentCharRef={setCurrentCharRef}
              onLastCharRef={setLastCharRef}
            />
          );
        })}
      </div>
    </div>
  );
}
