import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTypingEngine } from '../../hooks/useTypingEngine';
import TypingViewport from './TypingViewport';
import { TypingPassageSkeleton } from './TypingSkeleton';
import { useTypingActivity } from '../../hooks/useTypingActivity';
import { useCapsLock } from '../../hooks/useCapsLock';
import { usePassageQueue } from '../../hooks/usePassageQueue';
import { useAuth } from '../../context/AuthContext';
import { beginKeystroke } from '../../utils/performance';
import { completeTypingJourney } from '../../utils/telemetry';
import type { Duration, Passage, TestMode, WordCount, ContentType, Mode, PhraseLength, TextDifficulty } from '../../types';

const wordCounts: WordCount[] = [10, 25, 50, 100];
const PREFERENCES_KEY = 'typing_preferences';

function loadPreferences() {
  try {
    const saved = localStorage.getItem(PREFERENCES_KEY);
    if (saved) {
      const p = JSON.parse(saved);
      return {
        mode: p.mode === 'words' || p.mode === 'phrases' || p.mode === 'time' ? p.mode : 'time' as Mode,
        duration: p.duration === 15 || p.duration === 30 || p.duration === 60 ? p.duration : 30 as Duration,
        wordCount: p.wordCount === 10 || p.wordCount === 25 || p.wordCount === 50 || p.wordCount === 100 ? p.wordCount : 25 as WordCount,
        phraseLength: p.phraseLength === 'short' || p.phraseLength === 'medium' || p.phraseLength === 'long' || p.phraseLength === 'thicc' || p.phraseLength === 'all' ? p.phraseLength : 'medium' as PhraseLength,
        difficulty: p.difficulty === 'EASY' || p.difficulty === 'MEDIUM' || p.difficulty === 'HARD' || p.difficulty === 'EXPERT' ? p.difficulty : 'EASY' as TextDifficulty,
      };
    }
  } catch {}
  return { mode: 'time' as Mode, duration: 30 as Duration, wordCount: 25 as WordCount, phraseLength: 'medium' as PhraseLength, difficulty: 'EASY' as TextDifficulty };
}

export default function TypingTest() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addResult } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const restartBtnRef = useRef<HTMLButtonElement>(null);
  const navigatedRef = useRef(false);
  const [resetKey, setResetKey] = useState(0);
  const { isTypingActive, markActive } = useTypingActivity();

  const saved = useMemo(loadPreferences, []);

  const modeParam = searchParams.get('mode');
  const mode: Mode = modeParam === 'words' || modeParam === 'phrases' ? modeParam : saved.mode;

  const durationParam = searchParams.get('time');
  const duration: Duration = (durationParam === '15' || durationParam === '60') ? parseInt(durationParam) as Duration : saved.duration;

  const countParam = searchParams.get('count');
  const wordCount: WordCount = wordCounts.includes(Number(countParam) as WordCount) ? Number(countParam) as WordCount : saved.wordCount;

  const lengthParam = searchParams.get('length');
  const phraseLength: PhraseLength = lengthParam === 'short' || lengthParam === 'medium' || lengthParam === 'long' || lengthParam === 'thicc' || lengthParam === 'all' ? lengthParam : saved.phraseLength;

  const difficultyParam = searchParams.get('difficulty');
  const difficulty: TextDifficulty = difficultyParam === 'EASY' || difficultyParam === 'MEDIUM' || difficultyParam === 'HARD' || difficultyParam === 'EXPERT' ? difficultyParam : saved.difficulty;

  const { contentType, testMode } = useMemo(() => {
    if (mode === 'phrases') return { contentType: 'phrases' as ContentType, testMode: 'words' as TestMode };
    if (mode === 'words') return { contentType: 'words' as ContentType, testMode: 'words' as TestMode };
    return { contentType: 'words' as ContentType, testMode: 'timed' as TestMode };
  }, [mode]);

  const [passage, setPassage] = useState<Passage | null>(null);
  const { next, isLoading } = usePassageQueue(mode, duration, wordCount, phraseLength, difficulty);

  // Custom passage from ?custom query param
  useEffect(() => {
    const isCustom = searchParams.get('custom');
    if (isCustom) {
      try {
        const stored = localStorage.getItem('19wpm-custom-passage');
        if (stored) {
          const p = JSON.parse(stored);
          setPassage({ title: p.title || '', text: p.text, author: p.author, source: p.source });
        }
      } catch {}
    }
  }, [searchParams]);

  // Initialize passage from queue once loading completes
  useEffect(() => {
    if (!isLoading && passage === null) {
      setPassage(next());
    }
  }, [isLoading, next]);

  useEffect(() => {
    if (passage !== null) completeTypingJourney();
  }, [passage]);

  const isCapsLockOn = useCapsLock();

  const { state, handleKeyDown, getResult, reset } = useTypingEngine(
    passage ?? { title: '', text: '', author: '', source: '' },
    duration, testMode, wordCount, contentType
  );

  const handleRestart = useCallback(() => {
    setResetKey(k => k + 1);
    reset();
    navigatedRef.current = false;
    containerRef.current?.focus();
  }, [reset]);

  const handleContainerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      handleRestart();
      return;
    }
    if (e.key === 'Enter' && !state.isRunning && !state.isFinished) {
      e.preventDefault();
      const nextPassage = next();
      if (nextPassage) setPassage(nextPassage);
      setResetKey(k => k + 1);
      reset();
      navigatedRef.current = false;
      containerRef.current?.focus();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setResetKey(k => k + 1);
      reset();
      navigatedRef.current = false;
      containerRef.current?.focus();
      return;
    }
    if (e.key.length === 1 || e.key === 'Backspace') {
      beginKeystroke();
    }
    markActive();
    handleKeyDown(e);
  }, [handleKeyDown, handleRestart, markActive, next, reset, state.isRunning]);

  useEffect(() => {
    if (state.isFinished && !navigatedRef.current) {
      navigatedRef.current = true;
      const result = getResult();
      sessionStorage.setItem('19wpm-last-result', JSON.stringify(result));
      addResult(result);
      navigate('/results', { state: { result } });
    }
    if (!state.isFinished) {
      navigatedRef.current = false;
    }
  }, [state.isFinished, addResult]);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const totalWords = state.wordBoundaries.length;
  const displayCompleted = state.isFinished ? totalWords : state.completedWords;

  const progressPct = useMemo(() => {
    if (state.testMode === 'timed') {
      return state.totalTime > 0 ? ((state.totalTime - state.timeLeft) / state.totalTime) * 100 : 0;
    }
    return totalWords > 0 ? (displayCompleted / totalWords) * 100 : 0;
  }, [state.testMode, state.totalTime, state.timeLeft, displayCompleted, totalWords]);

  const timerDisplay = state.timeLeft >= 60
    ? `${Math.floor(state.timeLeft / 60)}:${String(Math.floor(state.timeLeft % 60)).padStart(2, '0')}`
    : `${Math.floor(state.timeLeft)}`;

  return (
    <div className="min-h-screen bg-surface transition-theme flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 max-w-4xl mx-auto w-full">
        <div className="w-full mb-8 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="text-text-dim hover:text-text-sub font-sans text-xs transition-colors hover:cursor-pointer"
          >
            &larr; Exit
          </button>

          {!state.isRunning && !state.isFinished && passage && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-text-dim font-sans text-xs">
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-line text-text-sub font-mono text-[10px]">tab</kbd>
                <span>same test</span>
              </div>
              <div className="flex items-center gap-1.5 text-text-dim font-sans text-xs">
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-line text-text-sub font-mono text-[10px]">enter</kbd>
                <span>next test</span>
              </div>
              <div className="flex items-center gap-1.5 text-text-dim font-sans text-xs">
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-line text-text-sub font-mono text-[10px]">esc</kbd>
                <span>reset</span>
              </div>
              <div className="flex items-center gap-1.5 text-text-dim font-sans text-xs">
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-line text-text-sub font-mono text-[10px]">ctrl+&#9003;</kbd>
                <span>del word</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-6">
            {state.testMode === 'timed' ? (
              <div className="text-3xl font-mono font-bold text-accent transition-theme">
                {timerDisplay}
              </div>
            ) : (
              <div className="text-base font-mono text-accent transition-theme">
                {displayCompleted} / {totalWords}
              </div>
            )}
            <div className="flex items-center gap-4 text-text-sub font-sans text-sm">
              <span><span className="text-accent font-semibold">{state.wpm}</span> wpm</span>
              <span className="w-px h-4 bg-line" />
              <span><span className={state.accuracy >= 95 ? 'text-success' : state.accuracy >= 80 ? 'text-accent' : 'text-error'}>{state.accuracy}%</span> acc</span>
            </div>
          </div>
        </div>

        <div className="w-full h-1.5 bg-muted rounded-full mb-8 transition-theme">
          <div className="h-full bg-accent rounded-full transition-all duration-100" style={{ width: `${progressPct}%` }} />
        </div>

        {isCapsLockOn && (
          <div className="flex items-center justify-center gap-2 mb-4 text-sm transition-theme" aria-live="polite">
            <svg className="w-4 h-4 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="text-yellow-600 font-sans font-medium">Caps Lock is on</span>
          </div>
        )}

        <div
          ref={containerRef}
          tabIndex={0}
          onKeyDown={handleContainerKeyDown}
          onClick={() => containerRef.current?.focus()}
          className="w-full p-6 rounded-xl bg-card border border-line transition-theme focus:outline-none focus:ring-2 focus:ring-accent/30 font-mono text-xl md:text-2xl leading-relaxed cursor-text select-none"
        >
          {!passage ? (
            <TypingPassageSkeleton />
          ) : !state.isRunning && !state.isFinished ? (
            <div className="text-center text-text-dim font-sans text-sm mb-4 transition-theme">
              Start typing to begin &middot; Press Esc to restart
            </div>
          ) : null}
          {passage && (
            <TypingViewport
              charsText={passage.text}
              typedChars={state.typedChars}
              currentIndex={state.currentIndex}
              lockedIndex={state.lockedIndex}
              mistakeWordIndices={state.mistakeWordIndices}
              extraChars={state.extraChars}
              isFinished={state.isFinished}
              isTypingActive={isTypingActive}
              resetKey={resetKey}
              measureKey={mode}
            />
          )}
        </div>

        {passage && (
          <div className="mt-6 text-center flex items-center justify-center gap-4">
            <p className="text-text-dim font-sans text-sm italic transition-theme">
              {passage.title ? `${passage.title} \u2014 ` : ''}&mdash; {passage.author}, <em>{passage.source}</em>
            </p>
            <button
              ref={restartBtnRef}
              onClick={handleRestart}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRestart(); } }}
              tabIndex={0}
              className="p-2 rounded-xl text-text-sub hover:text-accent hover:bg-muted transition-all hover:cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/50"
              title="Restart (Tab) &middot; New test (Enter)"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
