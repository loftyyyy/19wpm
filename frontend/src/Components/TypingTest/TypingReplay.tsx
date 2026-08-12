import { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { animate } from 'animejs';
import type { TestResult } from '../../types';

export default function TypingReplay({ result }: { result: TestResult }) {
  const [playState, setPlayState] = useState<'idle' | 'playing' | 'paused' | 'done'>('idle');
  const [typedChars, setTypedChars] = useState<string[]>([]);
  const [currentEventIdx, setCurrentEventIdx] = useState(0);
  const [liveWpm, setLiveWpm] = useState(0);
  const [liveCorrect, setLiveCorrect] = useState(0);
  const [liveIncorrect, setLiveIncorrect] = useState(0);
  const [liveExtraChars, setLiveExtraChars] = useState<string[]>([]);
  const timerRef = useRef<number | null>(null);
  const replayViewportRef = useRef<HTMLDivElement>(null);
  const replayContentRef = useRef<HTMLDivElement>(null);
  const replayWordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const replayCharRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const replayLineHeightRef = useRef(0);
  const scrollAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const caretAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
  const isFirstCaretPosRef = useRef(true);

  const passageWords = useMemo(() => {
    const w: { chars: { char: string; globalIdx: number }[] }[] = [];
    let gi = 0;
    const parts = result.passage.split('');
    let cur: { char: string; globalIdx: number }[] = [];
    for (const ch of parts) {
      if (ch === ' ') {
        w.push({ chars: cur });
        cur = [];
        gi++;
      } else {
        cur.push({ char: ch, globalIdx: gi });
        gi++;
      }
    }
    if (cur.length > 0) w.push({ chars: cur });
    return w;
  }, [result.passage]);

  const replayCurrentWordIndex = useMemo(() => {
    for (let i = 0; i < passageWords.length; i++) {
      const word = passageWords[i];
      const first = word.chars[0].globalIdx;
      const last = word.chars[word.chars.length - 1].globalIdx;
      if (typedChars.length >= first && typedChars.length <= last) return i;
      if (i > 0 && typedChars.length === first - 1) return i - 1;
    }
    return Math.max(0, passageWords.length - 1);
  }, [typedChars.length, passageWords]);

  const wordClickEvents = useMemo(() => {
    const wordStarts: number[] = [];
    let inWord = false;
    for (let i = 0; i < result.passage.length; i++) {
      if (result.passage[i] !== ' ' && !inWord) {
        wordStarts.push(i);
        inWord = true;
      } else if (result.passage[i] === ' ') {
        inWord = false;
      }
    }
    const firstEventForChar: Record<number, number> = {};
    let typedLen = 0;
    for (let ei = 0; ei < result.replayEvents.length; ei++) {
      const e = result.replayEvents[ei];
      if (e.type === 'key') {
        if (firstEventForChar[typedLen] === undefined) firstEventForChar[typedLen] = ei;
        typedLen++;
      } else if (e.type === 'backspace') {
        typedLen = Math.max(0, typedLen - 1);
      } else if (e.type === 'deleteWord') {
        if (typedLen > 0) {
          let i = typedLen - 1;
          while (i >= 0 && result.passage[i] !== ' ') i--;
          typedLen = Math.max(0, i + 1);
        }
      }
    }
    return wordStarts.map(ws => firstEventForChar[ws]).filter(ei => ei !== undefined);
  }, [result.passage, result.replayEvents]);

  const stopPlayback = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const processEvent = useCallback((idx: number, chars: string[], correct: number, incorrect: number, extraChars: string[]) => {
    const ev = result.replayEvents[idx];
    if (!ev) return { chars, correct, incorrect, extraChars };

    const newChars = [...chars];
    let newCorrect = correct;
    let newIncorrect = incorrect;
    let newExtraChars = [...extraChars];

    if (ev.type === 'key' && ev.key) {
      const charIdx = newChars.length;
      if (charIdx < result.passage.length && result.passage[charIdx] === ' ' && ev.key !== ' ') {
        newExtraChars = [...newExtraChars, ev.key];
        newIncorrect++;
      } else if (ev.key === ' ' && charIdx < result.passage.length && result.passage[charIdx] === ' ') {
        newChars.push(ev.key);
        if (newExtraChars.length > 0) {
          newExtraChars = [];
        } else {
          newCorrect++;
        }
      } else {
        const expected = result.passage[charIdx];
        const isCorrect = ev.key === expected;
        if (isCorrect) newCorrect++;
        else newIncorrect++;
        newChars.push(ev.key);
      }
    } else if (ev.type === 'backspace') {
      if (newExtraChars.length > 0) {
        newExtraChars = newExtraChars.slice(0, -1);
        newIncorrect = Math.max(0, newIncorrect - 1);
      } else if (newChars.length > 0) {
        const removed = newChars.pop()!;
        const charIdx = newChars.length;
        const expected = result.passage[charIdx];
        const wasCorrect = removed === expected;
        if (wasCorrect) newCorrect = Math.max(0, newCorrect - 1);
        else newIncorrect = Math.max(0, newIncorrect - 1);
      }
    } else if (ev.type === 'deleteWord') {
      newExtraChars = [];
      while (newChars.length > 0) {
        const removed = newChars.pop()!;
        const charIdx = newChars.length;
        const expected = result.passage[charIdx];
        const wasCorrect = removed === expected;
        if (wasCorrect) newCorrect = Math.max(0, newCorrect - 1);
        else newIncorrect = Math.max(0, newIncorrect - 1);
        if (newChars.length > 0 && newChars[newChars.length - 1] === ' ') break;
      }
    }

    return { chars: newChars, correct: newCorrect, incorrect: newIncorrect, extraChars: newExtraChars };
  }, [result.replayEvents, result.passage]);

  const runPlayback = useCallback((startIdx: number) => {
    stopPlayback();
    let idx = startIdx;
    let chars: string[] = [];
    let correct = 0;
    let incorrect = 0;
    let extraChars: string[] = [];
    for (let i = 0; i < idx; i++) {
      const r = processEvent(i, chars, correct, incorrect, extraChars);
      chars = r.chars;
      correct = r.correct;
      incorrect = r.incorrect;
      extraChars = r.extraChars;
    }
    setTypedChars(chars);
    setCurrentEventIdx(idx);
    setLiveCorrect(correct);
    setLiveIncorrect(incorrect);
    setLiveExtraChars(extraChars);
    const elapsedMin = idx > 0 && result.replayEvents[idx - 1]
      ? (result.replayEvents[idx - 1].timestamp / 1000) / 60
      : 0;
    setLiveWpm(elapsedMin > 0 ? Math.round((correct / 5) / elapsedMin) : 0);
    setPlayState('playing');

    function scheduleNext() {
      if (idx >= result.replayEvents.length) {
        setPlayState('done');
        return;
      }
      const ev = result.replayEvents[idx];
      const nextEv = result.replayEvents[idx + 1];
      const delay = nextEv ? Math.max(1, nextEv.timestamp - ev.timestamp) : 300;

      timerRef.current = window.setTimeout(() => {
        const r = processEvent(idx, chars, correct, incorrect, extraChars);
        chars = r.chars;
        correct = r.correct;
        incorrect = r.incorrect;
        extraChars = r.extraChars;
        setTypedChars(chars);
        setCurrentEventIdx(idx + 1);
        setLiveExtraChars(extraChars);

        const elapsedMin = (ev.timestamp / 1000) / 60;
        const wpm = elapsedMin > 0 ? Math.round((correct / 5) / elapsedMin) : 0;
        setLiveWpm(wpm);
        setLiveCorrect(correct);
        setLiveIncorrect(incorrect);

        idx++;
        scheduleNext();
      }, delay);
    }
    scheduleNext();
  }, [result.replayEvents, processEvent, stopPlayback]);

  const startPlayback = useCallback(() => {
    if (result.replayEvents.length === 0) return;
    stopPlayback();
    setCurrentEventIdx(0);
    isFirstCaretPosRef.current = true;
    runPlayback(0);
  }, [result.replayEvents, stopPlayback, runPlayback]);

  const togglePause = useCallback(() => {
    if (playState === 'playing') {
      stopPlayback();
      setPlayState('paused');
    } else if (playState === 'paused') {
      runPlayback(currentEventIdx);
    }
  }, [playState, currentEventIdx, stopPlayback, runPlayback]);

  const seekTo = useCallback((eventIdx: number) => {
    if (eventIdx < 0 || eventIdx >= result.replayEvents.length) return;
    setCurrentEventIdx(eventIdx);
    runPlayback(eventIdx);
  }, [result.replayEvents, runPlayback]);

  const resetPlayback = useCallback(() => {
    stopPlayback();
    caretAnimationRef.current?.pause();
    scrollAnimationRef.current?.pause();
    if (replayContentRef.current) replayContentRef.current.style.marginTop = '0px';
    setTypedChars([]);
    setCurrentEventIdx(0);
    setLiveWpm(0);
    setLiveCorrect(0);
    setLiveIncorrect(0);
    setLiveExtraChars([]);
    setPlayState('idle');
    isFirstCaretPosRef.current = true;
  }, [stopPlayback]);

  useEffect(() => {
    return () => {
      stopPlayback();
      caretAnimationRef.current?.pause();
      scrollAnimationRef.current?.pause();
    };
  }, [stopPlayback]);

  useLayoutEffect(() => {
    const elements = replayWordRefs.current;
    if (!elements.length || !replayContentRef.current) return;

    const tops = new Set<number>();
    elements.forEach(el => { if (el) tops.add(el.offsetTop); });
    const sortedTops = [...tops].sort((a, b) => a - b);
    if (sortedTops.length < 2) return;

    const lineHeight = sortedTops[1] - sortedTops[0];
    if (!replayLineHeightRef.current && replayViewportRef.current) {
      replayLineHeightRef.current = lineHeight;
      replayViewportRef.current.style.height = `${lineHeight * 3}px`;
    }

    const currentEl = elements[replayCurrentWordIndex];
    if (!currentEl) return;

    const lineIdx = sortedTops.indexOf(currentEl.offsetTop);
    if (lineIdx < 0) return;

    const startLine = Math.max(0, Math.min(lineIdx - 1, sortedTops.length - 3));
    const offset = -sortedTops[startLine];

    const currentMarginTop = parseFloat(replayContentRef.current.style.marginTop || '0');
    if (Math.abs(offset - currentMarginTop) < 1) return;

    // Cancel in-flight scroll animation
    scrollAnimationRef.current?.pause();

    // Animate marginTop at 125ms like the live typing screen
    scrollAnimationRef.current = animate(replayContentRef.current, {
      marginTop: offset,
      duration: 125,
      ease: 'inOut(2)',
    });
  }, [replayCurrentWordIndex, passageWords.length]);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      const cursorEl = cursorRef.current;
      const containerEl = replayContentRef.current;
      if (!cursorEl || !containerEl) return;

      const pos = typedChars.length;
      if (pos <= 0) {
        isFirstCaretPosRef.current = true;
        cursorEl.style.left = '0px';
        cursorEl.style.top = '0px';
        return;
      }

      const passageLength = result.passage.length;
      let targetEl: HTMLSpanElement | null = null;
      let useRightEdge = false;

      if (pos >= passageLength) {
        targetEl = replayCharRefs.current[passageLength - 1] ?? null;
        useRightEdge = true;
      } else if (result.passage[pos] === ' ') {
        targetEl = replayCharRefs.current[pos - 1] ?? null;
        useRightEdge = true;
      } else {
        targetEl = replayCharRefs.current[pos] ?? null;
      }

      if (!targetEl) return;

      // Same offsetLeft/offsetTop walk as the live typing screen
      let el: HTMLElement | null = targetEl;
      let left = useRightEdge ? el.offsetWidth : 0;
      let top = 0;
      while (el && el !== containerEl) {
        left += el.offsetLeft;
        top += el.offsetTop;
        el = el.offsetParent as HTMLElement;
      }

      // Center vertically like the live screen:
      // top += (letterHeight - caretHeight) / 2
      const caretHeight = parseFloat(getComputedStyle(cursorEl).height);
      top += (targetEl.offsetHeight - caretHeight) / 2;
      // Shift left by half caret width to sit between chars
      left -= 1;

      if (isFirstCaretPosRef.current) {
        // Teleport on first position — no animation
        isFirstCaretPosRef.current = false;
        cursorEl.style.left = `${left}px`;
        cursorEl.style.top = `${top}px`;
        return;
      }

      // Cancel any in-flight animation
      caretAnimationRef.current?.pause();

      // Animate with the same easing as the live typing screen
      caretAnimationRef.current = animate(cursorEl, {
        left,
        top,
        duration: 85,
        ease: 'inOut(1.25)',
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, [typedChars.length, result.passage, playState]);

  const accuracy = (liveCorrect + liveIncorrect) > 0
    ? Math.round((liveCorrect / (liveCorrect + liveIncorrect)) * 100)
    : 100;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="text-text-sub font-sans text-sm font-semibold transition-theme">
          {playState === 'idle' ? 'Watch Replay' : playState === 'playing' ? 'Replaying' : playState === 'paused' ? 'Paused' : 'Replay Complete'}
        </p>
        <div className="flex items-center gap-4">
          {playState !== 'idle' && (
            <div className="flex items-center gap-3 text-xs font-sans">
              <span className="text-accent font-semibold">{liveWpm} wpm</span>
              <span className="text-text-dim">&middot;</span>
              <span className="text-text-sub">{accuracy}%</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            {playState === 'idle' && (
              <button
                onClick={startPlayback}
                className="p-1.5 rounded-lg text-text-sub hover:text-accent hover:bg-muted transition-all hover:cursor-pointer"
                title="Play"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            )}
            {(playState === 'playing' || playState === 'paused') && (
              <button
                onClick={togglePause}
                className="p-1.5 rounded-lg text-text-sub hover:text-accent hover:bg-muted transition-all hover:cursor-pointer"
                title={playState === 'playing' ? 'Pause' : 'Resume'}
              >
                {playState === 'playing' ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
            )}
            {playState !== 'idle' && (
              <button
                onClick={resetPlayback}
                className="p-1.5 rounded-lg text-text-sub hover:text-accent hover:bg-muted transition-all hover:cursor-pointer"
                title="Reset replay"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {result.replayEvents.length === 0 ? (
        <div className="bg-muted rounded-xl p-4 transition-theme">
          <p className="text-text-dim text-sm font-sans text-center py-4">No replay data available.</p>
        </div>
      ) : (
        <div className="bg-card border border-line rounded-xl p-4 md:p-5 transition-theme font-mono text-lg md:text-xl leading-relaxed select-none">
          <div className="flex gap-2 mb-3">
            {(playState === 'playing' || playState === 'paused') && (
              <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-75"
                  style={{ width: `${result.replayEvents.length > 0 ? (currentEventIdx / result.replayEvents.length) * 100 : 0}%` }}
                />
              </div>
            )}
          </div>
          <div ref={replayViewportRef} className="overflow-hidden">
            <div ref={replayContentRef} className="flex flex-wrap gap-x-2 gap-y-1 relative">
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
                display: playState === 'done' ? 'none' : 'block',
              }}
              className="animate-blink"
            />
            {passageWords.map((word, wi) => (
              <span
                key={wi}
                ref={el => { replayWordRefs.current[wi] = el; }}
                className="flex relative group"
              >
                {word.chars.map(({ char, globalIdx }) => {
                  const typed = typedChars[globalIdx];
                  const isCorrect = typed !== undefined && typed === char;
                  const isIncorrect = typed !== undefined && typed !== char;

                  let cls = 'char-untyped';
                  if (isCorrect) cls = 'char-correct';
                  if (isIncorrect) cls = 'char-incorrect';

                  return (
                    <span key={globalIdx} ref={el => { replayCharRefs.current[globalIdx] = el; }} className={cls}>
                      {char}
                    </span>
                  );
                })}
                {wi < passageWords.length - 1 && (
                  <span className="text-text-dim"> </span>
                )}
                {wi === replayCurrentWordIndex && liveExtraChars.map((ch, i) => (
                  <span key={`rx-${i}`} className="char-incorrect">{ch}</span>
                ))}
                {playState !== 'idle' && wordClickEvents[wi] !== undefined && (
                  <button
                    onClick={() => seekTo(wordClickEvents[wi])}
                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity rounded-md focus:outline-none focus:ring-2 focus:ring-accent/40"
                    style={{ background: 'var(--accent)', opacity: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.08'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}
                    title="Seek to this word"
                  />
                )}
              </span>
            ))}
          </div>
          </div>
          <div className="mt-3 text-center">
            <p className="text-xs font-sans text-text-dim transition-theme">
              {playState !== 'idle' ? 'Click a word to seek the replay to that point' : 'Press play to start the replay'}
            </p>
          </div>
        </div>
      )}

      {playState === 'done' && (
        <div className="mt-3 text-center">
          <span className="text-xs font-sans text-text-dim">
            Replay finished &middot; <button onClick={resetPlayback} className="text-accent hover:underline hover:cursor-pointer">replay</button>
          </span>
        </div>
      )}
    </div>
  );
}