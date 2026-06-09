import { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { TestResult, WpmPoint } from '../../types';

const CHART_HEIGHT = 180;
const BAR_AREA_HEIGHT = 140;
const ERROR_DOT_Y = 16;
const PADDING_LEFT = 40;
const PADDING_RIGHT = 16;
const PEAK_BADGE_WIDTH = 80;
const INNER_RIGHT = PADDING_RIGHT + PEAK_BADGE_WIDTH + 8;

function WpmBurstChart({ data }: { data: WpmPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [tooltip, setTooltip] = useState<{ x: number; wpm: number; time: number; errors: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const resize = () => setContainerWidth(el.clientWidth);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const maxWpm = useMemo(() => Math.max(...data.map(d => d.wpm), 1), [data]);
  const totalErrors = useMemo(() => data.reduce((s, d) => s + d.errors, 0), [data]);
  const avgWpm = useMemo(() => Math.round(data.reduce((s, d) => s + d.wpm, 0) / data.length), [data]);

  const innerWidth = containerWidth - PADDING_LEFT - INNER_RIGHT;
  const barGap = Math.max(0.5, Math.min(2, innerWidth / data.length * 0.08));
  const barWidth = Math.max(3, (innerWidth - barGap * (data.length - 1)) / data.length);
  const svgWidth = containerWidth;

  const peakPoint = useMemo(() => {
    let peak = data[0];
    for (const p of data) if (p.wpm > peak.wpm) peak = p;
    return peak;
  }, [data]);

  return (
    <div ref={containerRef} className="w-full relative">
      <svg width={svgWidth} height={CHART_HEIGHT} className="select-none block">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75].map(frac => {
          const y = BAR_AREA_HEIGHT + 4 - (BAR_AREA_HEIGHT - 4) * frac;
          const label = Math.round(maxWpm * frac);
          return (
            <g key={frac}>
              <line x1={PADDING_LEFT} y1={y} x2={svgWidth - INNER_RIGHT} y2={y} stroke="var(--line)" strokeOpacity="0.4" strokeDasharray="3 3" />
              <text x={PADDING_LEFT - 6} y={y + 4} textAnchor="end" fill="var(--text-dim)" fontSize="10" fontFamily="var(--font-sans)">
                {label}
              </text>
            </g>
          );
        })}

        {data.map((point, i) => {
          const x = PADDING_LEFT + i * (barWidth + barGap);
          const barH = Math.max(1, (point.wpm / maxWpm) * (BAR_AREA_HEIGHT - 4));
          const y = BAR_AREA_HEIGHT + 4 - barH;

          return (
            <g
              key={i}
              onMouseEnter={() => setTooltip({ x: x + barWidth / 2, wpm: point.wpm, time: point.time, errors: point.errors })}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect x={x} y={y} width={barWidth} height={barH} rx={2} fill="url(#barGrad)" />
              {point.errors > 0 && (
                <circle cx={x + barWidth / 2} cy={ERROR_DOT_Y} r={3} fill="var(--error)" opacity={0.8} />
              )}
              <rect x={x} y={0} width={barWidth} height={BAR_AREA_HEIGHT + 4} fill="transparent" />
            </g>
          );
        })}

        <line x1={PADDING_LEFT} y1={BAR_AREA_HEIGHT + 4} x2={svgWidth - INNER_RIGHT} y2={BAR_AREA_HEIGHT + 4} stroke="var(--line)" strokeWidth="1" />

        {data.filter((_, i) => i % 5 === 0 || i === data.length - 1).map((point, j, filtered) => {
          const idx = data.indexOf(point);
          const x = PADDING_LEFT + idx * (barWidth + barGap) + barWidth / 2;
          const show = filtered.length <= 8 || j % 2 === 0;
          return (
            <g key={idx}>
              <line x1={x} y1={BAR_AREA_HEIGHT + 4} x2={x} y2={BAR_AREA_HEIGHT + 8} stroke="var(--line)" />
              {show && (
                <text x={x} y={BAR_AREA_HEIGHT + 20} textAnchor="middle" fill="var(--text-dim)" fontSize="9" fontFamily="var(--font-sans)">
                  {point.time}s
                </text>
              )}
            </g>
          );
        })}

        {peakPoint && (
          <g transform={`translate(${svgWidth - INNER_RIGHT + 8}, 8)`}>
            <rect width={PEAK_BADGE_WIDTH} height={44} rx={6} fill="var(--muted)" />
            <text x={PEAK_BADGE_WIDTH / 2} y={18} textAnchor="middle" fill="var(--accent)" fontSize="14" fontWeight="700" fontFamily="var(--font-display)">
              {peakPoint.wpm}
            </text>
            <text x={PEAK_BADGE_WIDTH / 2} y={36} textAnchor="middle" fill="var(--text-dim)" fontSize="9" fontFamily="var(--font-sans)">
              peak wpm
            </text>
          </g>
        )}
      </svg>

      {tooltip && (
        <div
          className="absolute z-10 bg-card border border-line rounded-lg px-3 py-2 shadow-lg pointer-events-none transition-theme"
          style={{
            left: Math.min(tooltip.x - 40, containerWidth - 100),
            top: -8,
          }}
        >
          <p className="text-sm font-bold font-display text-accent">{tooltip.wpm} wpm</p>
          <p className="text-xs font-sans text-text-sub mt-0.5">
            {tooltip.time}s {tooltip.errors > 0 && <span className="text-error">&middot; {tooltip.errors} {tooltip.errors === 1 ? 'error' : 'errors'}</span>}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mt-2 text-xs font-sans text-text-dim">
        <div className="flex gap-4">
          <span>Peak: <strong className="text-accent">{peakPoint.wpm}</strong> wpm</span>
          <span>Avg: <strong className="text-text-main">{avgWpm}</strong> wpm</span>
        </div>
        <div className="flex items-center gap-3">
          {totalErrors > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-error inline-block" />
              {totalErrors} {totalErrors === 1 ? 'error' : 'errors'}
            </span>
          )}
          <span>{data.length}s elapsed</span>
        </div>
      </div>
    </div>
  );
}

function MistakeWordsList({ words }: { words: { expected: string; typed: string }[] }) {
  if (words.length === 0) return null;
  return (
    <div className="mb-8">
      <p className="text-text-sub font-sans text-sm font-semibold mb-3 transition-theme">Missed Words</p>
      <div className="bg-muted rounded-xl p-4 transition-theme max-h-48 overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {words.map((w, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-card rounded-lg px-3 py-1.5 border border-line transition-theme text-sm font-mono">
              <span className="text-success">{w.expected}</span>
              <span className="text-text-dim">&rarr;</span>
              <span className="text-error">{w.typed}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TypingReplay({ result }: { result: TestResult }) {
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
  const replayLineHeightRef = useRef(0);

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
    setTypedChars([]);
    setCurrentEventIdx(0);
    setLiveWpm(0);
    setLiveCorrect(0);
    setLiveIncorrect(0);
    setLiveExtraChars([]);
    setPlayState('idle');
  }, [stopPlayback]);

  useEffect(() => {
    return () => stopPlayback();
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

    replayContentRef.current.style.transform = `translateY(${offset}px)`;
    replayContentRef.current.style.transition = 'transform 0.15s ease-out';
  }, [replayCurrentWordIndex, passageWords.length]);

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
            {passageWords.map((word, wi) => (
              <span
                key={wi}
                ref={el => { replayWordRefs.current[wi] = el; }}
                className="flex relative group"
              >
                {word.chars.map(({ char, globalIdx }) => {
                  const typed = typedChars[globalIdx];
                  const isCurrent = globalIdx === typedChars.length;
                  const isCorrect = typed !== undefined && typed === char;
                  const isIncorrect = typed !== undefined && typed !== char;

                  let cls = 'char-untyped transition-colors';
                  if (isCorrect) cls = 'char-correct';
                  if (isIncorrect) cls = 'char-incorrect';
                  if (isCurrent && playState === 'playing') cls = 'char-current text-text-main';

                  return (
                    <span key={globalIdx} className={cls}>
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

export default function TestResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const result = (location.state as { result?: TestResult })?.result;

  const fallback = sessionStorage.getItem('19wpm-last-result');
  const safeResult: TestResult | null = result ?? (fallback ? JSON.parse(fallback) : null);
  const retryBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && document.activeElement === document.body) {
        e.preventDefault();
        retryBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!safeResult) {
    return (
      <div className="min-h-screen bg-surface transition-theme flex flex-col items-center justify-center gap-4">
        <p className="text-text-dim font-sans">No test result found.</p>
        <button
          onClick={() => navigate('/solo')}
          className="px-6 py-3 bg-accent text-white rounded-xl font-sans font-semibold hover:bg-accent-hover transition-colors hover:cursor-pointer"
        >
          Take a Test
        </button>
      </div>
    );
  }

  const minutes = safeResult.duration / 60;
  const grossWpm = minutes > 0 ? Math.round(safeResult.correctChars / 5 / minutes) : 0;
  const totalMistakes = safeResult.totalIncorrect;
  const peakWpm = safeResult.wpmHistory.length > 0
    ? Math.max(...safeResult.wpmHistory.map(p => p.wpm))
    : safeResult.wpm;

  return (
    <div className="min-h-screen bg-surface transition-theme">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-display font-bold text-text-main text-center mb-10 transition-theme">
          Test Complete
        </h1>

        <div className="bg-card border border-line rounded-2xl p-6 md:p-8 shadow-sm transition-theme">
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="text-center">
              <p className="text-5xl font-bold font-display text-accent transition-theme">
                {safeResult.wpm}
              </p>
              <p className="text-text-sub font-sans text-sm mt-1 transition-theme">WPM</p>
            </div>
            <div className="text-center">
              <p className={`text-5xl font-bold font-display transition-theme ${
                safeResult.accuracy >= 95 ? 'text-success' : safeResult.accuracy >= 80 ? 'text-accent' : 'text-error'
              }`}>
                {safeResult.accuracy}%
              </p>
              <p className="text-text-sub font-sans text-sm mt-1 transition-theme">Accuracy</p>
            </div>
          </div>

          <TypingReplay result={safeResult} />

          <div className="mb-8">
            <p className="text-text-sub font-sans text-sm font-semibold mb-3 transition-theme">WPM Burst Chart</p>
            <div className="bg-muted rounded-xl p-4 transition-theme">
              {safeResult.wpmHistory.length > 0 ? (
                <WpmBurstChart data={safeResult.wpmHistory} />
              ) : (
                <p className="text-text-dim text-sm font-sans text-center py-8">No data available</p>
              )}
            </div>
          </div>

          <MistakeWordsList words={safeResult.mistakeWords} />

          <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8">
            <div className="bg-muted rounded-xl p-4 text-center transition-theme">
              <p className="text-lg font-bold font-display text-success transition-theme">{safeResult.totalCorrect}</p>
              <p className="text-xs text-text-sub font-sans mt-0.5">Correct</p>
            </div>
            <div className="bg-muted rounded-xl p-4 text-center transition-theme">
              <p className="text-lg font-bold font-display text-error transition-theme">{totalMistakes}</p>
              <p className="text-xs text-text-sub font-sans mt-0.5">Mistakes</p>
            </div>
            <div className="bg-muted rounded-xl p-4 text-center transition-theme">
              <p className="text-lg font-bold font-display text-text-main transition-theme">{safeResult.duration}s</p>
              <p className="text-xs text-text-sub font-sans mt-0.5">Duration</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4 mb-8">
            <div className="bg-muted rounded-xl p-4 text-center transition-theme">
              <p className="text-lg font-bold font-display text-text-main transition-theme">{grossWpm}</p>
              <p className="text-xs text-text-sub font-sans mt-0.5">Net WPM (keystrokes / 5)</p>
            </div>
            <div className="bg-muted rounded-xl p-4 text-center transition-theme">
              <p className="text-lg font-bold font-display text-text-main transition-theme">{peakWpm}</p>
              <p className="text-xs text-text-sub font-sans mt-0.5">Peak WPM</p>
            </div>
          </div>

          <div className="bg-muted rounded-xl p-4 mb-8 transition-theme">
            <p className="text-text-sub font-sans text-sm font-semibold mb-2 transition-theme">Passage</p>
            {safeResult.title && (
              <p className="text-text-main font-sans text-sm font-medium mb-1 transition-theme">{safeResult.title}</p>
            )}
            <p className="text-text-dim font-sans text-sm leading-relaxed transition-theme">
              {safeResult.passage.length > 200
                ? safeResult.passage.slice(0, 200) + '...'
                : safeResult.passage}
            </p>
            <p className="text-text-dim font-sans text-xs mt-2 italic transition-theme">
              &mdash; {safeResult.author}, <em>{safeResult.source}</em>
            </p>
          </div>

          <div className="flex gap-4">
            <button
              ref={retryBtnRef}
              onClick={() => navigate('/solo')}
              className="flex-1 px-6 py-3 bg-accent text-white rounded-xl font-sans font-semibold hover:bg-accent-hover transition-colors hover:cursor-pointer"
            >
              Retry
            </button>
            <button
              onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
              className="flex-1 px-6 py-3 border border-accent text-accent rounded-xl font-sans font-semibold hover:bg-muted transition-colors hover:cursor-pointer"
            >
              View My Stats
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
