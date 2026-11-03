import { memo, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useState } from 'react';
import type { RefObject } from 'react';
import { animate } from 'animejs';
import Word from './Word';
import { completeKeystroke, markPerformance, measurePerformance } from '../../utils/performance';
import { useTypingActivity } from '../../hooks/useTypingActivity';

const NO_EXTRA_CHARS: string[] = [];

interface TypingViewportProps {
  charsText: string;
  typedChars: string[];
  currentIndex: number;
  lockedIndex: number;
  mistakeWordIndices: Set<number>;
  extraChars: string[];
  isFinished: boolean;
  extraVariant?: 'plain' | 'block';
  resetKey?: number;
  measureKey?: unknown;
}

interface TypingCaretProps {
  cursorRef: RefObject<HTMLDivElement | null>;
  hidden: boolean;
}

/**
 * The blinking caret is the only consumer of the activity flag. Keeping it in
 * its own memoized component means a typing burst's idle timeout re-renders one
 * empty div instead of the passage behind it.
 */
const TypingCaret = memo(function TypingCaret({ cursorRef, hidden }: TypingCaretProps) {
  const isTypingActive = useTypingActivity();
  return (
    <div
      ref={cursorRef}
      className={`typing-cursor ${hidden ? 'typing-cursor-hidden' : isTypingActive ? 'typing-cursor-active' : 'animate-blink'}`}
    />
  );
});

function TypingViewport({
  charsText,
  typedChars,
  currentIndex,
  lockedIndex,
  mistakeWordIndices,
  extraChars,
  isFinished,
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
  const caretTargetRef = useRef({ x: 0, y: 0 });
  const isFirstPositionRef = useRef(true);
  const scrollAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
  const scrollTargetRef = useRef(0);
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
    // A reused animation would keep writing the previous passage's offsets
    // after the reset, so stop both before the layout is re-measured.
    caretAnimationRef.current?.pause();
    scrollAnimationRef.current?.pause();
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

    // One animation per element for the lifetime of the viewport: refresh()
    // re-reads the in-flight margin, restart() replays from there, so a line
    // change does not allocate a new animation object.
    scrollTargetRef.current = newMarginTop;
    if (scrollAnimationRef.current) {
      scrollAnimationRef.current.refresh().restart();
      return;
    }

    // Animate marginTop at 125ms like Monkeytype
    scrollAnimationRef.current = animate(contentRef.current, {
      marginTop: () => scrollTargetRef.current,
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

      // The caret moves in its own frame, after the keystroke measure closes,
      // so it needs a separate sample to show up in the benchmark.
      const startMark = markPerformance('caret:start');

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
        measurePerformance('caret', startMark);
        return;
      }

      // Same reuse as the scroll animation: one animation per caret, retargeted
      // through refresh() + restart() instead of allocated per keystroke.
      const caretTarget = caretTargetRef.current;
      caretTarget.x = left;
      caretTarget.y = top;

      if (caretAnimationRef.current) {
        caretAnimationRef.current.refresh().restart();
      } else {
        caretAnimationRef.current = animate(cursorEl, {
          translateX: () => caretTarget.x,
          translateY: () => caretTarget.y,
          duration: 85,
          ease: 'inOut(1.25)',
        });
      }
      measurePerformance('caret', startMark);
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
        <TypingCaret cursorRef={cursorRef} hidden={isFinished} />
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

/**
 * Only props that can change what the passage looks like are compared. Activity
 * flags, idle timers and focus state are deliberately absent: the caret
 * subscribes to them itself, so a parent re-render for one of those must not
 * reach this tree. `typedChars`, `extraChars` and `mistakeWordIndices` are
 * compared by reference because the reducer only allocates new ones when their
 * content changes.
 */
function arePropsEqual(
  prev: TypingViewportProps,
  next: TypingViewportProps
): boolean {
  return (
    prev.charsText === next.charsText &&
    prev.typedChars === next.typedChars &&
    prev.currentIndex === next.currentIndex &&
    prev.lockedIndex === next.lockedIndex &&
    prev.mistakeWordIndices === next.mistakeWordIndices &&
    prev.extraChars === next.extraChars &&
    prev.isFinished === next.isFinished &&
    prev.extraVariant === next.extraVariant &&
    prev.resetKey === next.resetKey &&
    prev.measureKey === next.measureKey
  );
}

export default memo(TypingViewport, arePropsEqual);
