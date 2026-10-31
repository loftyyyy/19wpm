import { useEffect, useLayoutEffect, useMemo, useRef, useCallback, useState } from 'react';
import { animate } from 'animejs';
import Word from './Word';
import { completeKeystroke, markPerformance, measurePerformance } from '../../utils/performance';

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
  const renderStartMarkRef = useRef<string | null>(null);
  // Bumped when the container width changes; the layout effects key off it so a
  // resize re-measures line positions instead of trusting a stale cache.
  const [layoutEpoch, setLayoutEpoch] = useState(0);

  // Captured before commit so the layout effect can measure render-to-paint cost.
  // eslint-disable-next-line react-hooks/refs -- perf instrumentation, not render state
  renderStartMarkRef.current = markPerformance('viewport:start');

  const setCurrentCharRef = useCallback((el: HTMLSpanElement | null) => {
    currentCharRef.current = el;
  }, []);
  const setLastCharRef = useCallback((el: HTMLSpanElement | null) => {
    lastCharRef.current = el;
  }, []);
  const setWordRef = useCallback((index: number, el: HTMLSpanElement | null) => {
    wordRefs.current[index] = el;
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

  // Line wrapping depends on the content width, so a window resize or a device
  // rotation invalidates every cached `offsetTop`. Without this the scroll offset
  // and the three-line window keep pointing at the pre-resize layout.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === 'undefined') return;

    let lastWidth = content.clientWidth;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry ? entry.contentRect.width : content.clientWidth;
      if (Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      lineCacheRef.current = null;
      isFirstPositionRef.current = true;
      setLayoutEpoch(epoch => epoch + 1);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

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
  }, [currentWordIndex, passageWords.length, measureKey, layoutEpoch]);

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
        isFirstPositionRef.current = false;
        cursorEl.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        return;
      }

      caretAnimationRef.current?.pause();

      caretAnimationRef.current = animate(cursorEl, {
        translateX: left,
        translateY: top,
        duration: 85,
        ease: 'inOut(1.25)',
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, [currentIndex, charsText, layoutEpoch]);

  useLayoutEffect(() => {
    const startMark = renderStartMarkRef.current;
    if (startMark) {
      measurePerformance('viewport', startMark);
      renderStartMarkRef.current = null;
    }
    completeKeystroke();
  });

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
          className={`typing-cursor ${isFinished ? 'typing-cursor-hidden' : isTypingActive ? 'typing-cursor-active' : 'animate-blink'}`}
        />
        {passageWords.map((word, wi) => {
          const { chars } = word;
          const start = chars[0].globalIdx;
          const end = start + chars.length;
          const isActive = wi === currentWordIndex;
          return (
            <Word
              key={wi}
              chars={chars}
              start={start}
              end={end}
              typedChars={typedChars}
              isPastWord={lockedIndex >= end}
              hasError={mistakeWordIndices.has(wi)}
              isActive={isActive}
              activeCharIndex={isActive ? activeGlobalIdx : -1}
              lastGlobalIdx={lastGlobalIdx}
              extraChars={isActive ? extraChars : NO_EXTRA_CHARS}
              extraVariant={extraVariant}
              wordIndex={wi}
              onWordRef={setWordRef}
              onCurrentCharRef={setCurrentCharRef}
              onLastCharRef={setLastCharRef}
            />
          );
        })}
      </div>
    </div>
  );
}
