import { useEffect, useRef, useMemo, useCallback, useLayoutEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTypingEngine } from '../../hooks/useTypingEngine';
import { useCapsLock } from '../../hooks/useCapsLock';
import { usePassageQueue } from '../../hooks/usePassageQueue';
import { useAuth } from '../../context/AuthContext';
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const restartBtnRef = useRef<HTMLButtonElement>(null);
  const navigatedRef = useRef(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  const currentCharRef = useRef<HTMLSpanElement | null>(null);
  const [isTypingActive, setIsTypingActive] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const { next, isLoading, peek } = usePassageQueue(mode, duration, wordCount, phraseLength, difficulty);

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
      setPassage(peek());
    }
  }, [isLoading]);

  const isCapsLockOn = useCapsLock();

  const { state, handleKeyDown, getResult, reset } = useTypingEngine(
    passage ?? { title: '', text: '', author: '', source: '' },
    duration, testMode, wordCount, contentType
  );

  const passageWords = useMemo(() => {
    if (!passage) return [];
    const words: { chars: { char: string; globalIdx: number }[] }[] = [];
    let globalIdx = 0;
    const parts = passage.text.split('');
    let currentWord: { char: string; globalIdx: number }[] = [];
    for (const ch of parts) {
      if (ch === ' ') {
        words.push({ chars: currentWord });
        currentWord = [];
        globalIdx++;
      } else {
        currentWord.push({ char: ch, globalIdx });
        globalIdx++;
      }
    }
    if (currentWord.length > 0) words.push({ chars: currentWord });
    return words;
  }, [passage]);

  const currentWordIndex = useMemo(() => {
    if (passageWords.length === 0) return 0;
    for (let i = 0; i < passageWords.length; i++) {
      const word = passageWords[i];
      const first = word.chars[0].globalIdx;
      const last = word.chars[word.chars.length - 1].globalIdx;
      if (state.currentIndex >= first && state.currentIndex <= last) return i;
      if (i > 0 && state.currentIndex === first - 1) return i - 1;
    }
    return Math.max(0, passageWords.length - 1);
  }, [state.currentIndex, passageWords]);

  const handleRestart = useCallback(() => {
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
    if (e.key === 'Enter' && !state.isRunning) {
      e.preventDefault();
      const nextPassage = next();
      if (nextPassage) setPassage(nextPassage);
      reset();
      navigatedRef.current = false;
      containerRef.current?.focus();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      reset();
      navigatedRef.current = false;
      containerRef.current?.focus();
      return;
    }
    setIsTypingActive(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIsTypingActive(false), 500);
    handleKeyDown(e);
  }, [handleKeyDown, handleRestart, next, reset, state.isRunning]);

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
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  const lineCacheRef = useRef<{ sortedTops: number[]; lineHeight: number } | null>(null);

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

    const startLine = Math.max(0, Math.min(lineIdx - 1, sortedTops.length - 3));
    const offset = -sortedTops[startLine];

    if (contentRef.current.style.transform !== `translateY(${offset}px)`) {
      contentRef.current.style.transform = `translateY(${offset}px)`;
      contentRef.current.style.transition = 'transform 0.15s ease-out';
    }
  }, [currentWordIndex, passageWords.length, mode]);

  useLayoutEffect(() => {
    const cursorEl = cursorRef.current;
    const charEl = currentCharRef.current;
    const containerEl = contentRef.current;
    if (!cursorEl || !charEl || !containerEl) return;

    const containerRect = containerEl.getBoundingClientRect();
    const charRect = charEl.getBoundingClientRect();

    cursorEl.style.transform = `translate(${charRect.left - containerRect.left}px, ${charRect.top - containerRect.top}px)`;
  }, [state.currentIndex, passage]);

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
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-line text-text-sub font-mono text-[10px]">ctrl+⌫</kbd>
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
            <div className="text-center text-text-dim font-sans text-sm transition-theme">Loading passage...</div>
          ) : !state.isRunning && !state.isFinished ? (
            <div className="text-center text-text-dim font-sans text-sm mb-4 transition-theme">
              Start typing to begin &middot; Press Esc to restart
            </div>
          ) : null}
          {passage && (
            <div ref={viewportRef} className="overflow-hidden">
              <div ref={contentRef} className="flex flex-wrap gap-x-2 gap-y-1 relative">
                <div ref={cursorRef} className={`typing-cursor${state.isFinished ? ' typing-cursor-hidden' : isTypingActive ? ' typing-cursor-active' : ''}`} />
{passageWords.map((word, wi) => {
                  const wordEnd = word.chars[word.chars.length - 1].globalIdx;
                  const isPastWord = state.currentIndex > wordEnd;
                  const hasError = state.mistakeWordIndices.has(wi);
                  const wordErrorClass = isPastWord && hasError
                    ? 'underline decoration-error decoration-2'
                    : '';
                  return (
                  <span key={wi} ref={el => { wordRefs.current[wi] = el; }} className={`flex ${wordErrorClass}`}>
                    {word.chars.map(({ char, globalIdx }) => {
                      const typed = state.typedChars[globalIdx];
                      const isCurrent = globalIdx === state.currentIndex;
                      const isCorrect = typed !== undefined && typed === char;
                      const isIncorrect = typed !== undefined && typed !== char;

                      let cls = 'char-untyped transition-colors';
                      if (isCorrect) cls = 'char-correct';
                      if (isIncorrect) cls = 'char-incorrect';

const displayChar = (isIncorrect && typed !== undefined) ? typed : char;
                      return (
                        <span key={globalIdx} ref={isCurrent ? currentCharRef : undefined} className={cls}>
                          {displayChar}
                        </span>
                      );
                    })}
                    {wi < passageWords.length - 1 && (
                      <span className="text-text-dim"> </span>
                    )}
                    {wi === currentWordIndex && state.extraChars.map((ch, i) => (
                      <span key={`ex-${i}`} className="char-incorrect">{ch}</span>
                    ))}
</span>
                );
              })}
              </div>
            </div>
          )}
        </div>

        {passage && (
          <div className="mt-6 text-center flex items-center justify-center gap-4">
            <p className="text-text-dim font-sans text-sm italic transition-theme">
              {passage.title ? `${passage.title} � ` : ''}&mdash; {passage.author}, <em>{passage.source}</em>
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
