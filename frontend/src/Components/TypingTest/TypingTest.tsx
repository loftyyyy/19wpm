import { useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getRandomPassage } from '../../utils/passages';
import { useTypingEngine } from '../../hooks/useTypingEngine';
import { useAuth } from '../../context/AuthContext';
import type { Duration, Passage } from '../../types';

export default function TypingTest() {
  const [searchParams] = useSearchParams();
  const durationParam = searchParams.get('time');
  const duration: Duration = (durationParam === '15' || durationParam === '60') ? parseInt(durationParam) as Duration : 30;
  const navigate = useNavigate();
  const { addResult } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const navigatedRef = useRef(false);

  const passage = useMemo((): Passage => {
    const isCustom = searchParams.get('custom');
    if (isCustom) {
      try {
        const stored = localStorage.getItem('19wpm-custom-passage');
        if (stored) {
          const p = JSON.parse(stored);
          return { text: p.text, author: p.author, source: p.source };
        }
      } catch {}
    }
    return getRandomPassage();
  }, []);
  const { state, handleKeyDown, getResult } = useTypingEngine(passage, duration);

  const passageWords = useMemo(() => {
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
  }, [passage.text]);

  useEffect(() => {
    if (state.isFinished && !navigatedRef.current) {
      navigatedRef.current = true;
      const result = getResult();
      sessionStorage.setItem('19wpm-last-result', JSON.stringify(result));
      if (addResult) addResult(result);
      navigate('/results', { state: { result } });
    }
    if (!state.isFinished) {
      navigatedRef.current = false;
    }
  }, [state.isFinished]);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const progressPct = state.totalTime > 0 ? ((state.totalTime - state.timeLeft) / state.totalTime) * 100 : 0;
  const timerDisplay = `${Math.floor(state.timeLeft / 60)}:${String(Math.floor(state.timeLeft % 60)).padStart(2, '0')}`;

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
          <div className="flex items-center gap-6">
            <div className="text-3xl font-mono font-bold text-accent transition-theme">
              {timerDisplay}
            </div>
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

        <div
          ref={containerRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onClick={() => containerRef.current?.focus()}
          className="w-full p-6 rounded-xl bg-card border border-line transition-theme focus:outline-none focus:ring-2 focus:ring-accent/30 font-mono text-xl md:text-2xl leading-relaxed cursor-text select-none"
        >
          {!state.isRunning && !state.isFinished && (
            <div className="text-center text-text-dim font-sans text-sm mb-4 transition-theme">
              Start typing to begin &middot; Press Esc to restart
            </div>
          )}
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {passageWords.map((word, wi) => (
              <span key={wi} className="flex">
                {word.chars.map(({ char, globalIdx }) => {
                  const typed = state.typedChars[globalIdx];
                  const isCurrent = globalIdx === state.currentIndex;
                  const isCorrect = typed !== undefined && typed === char;
                  const isIncorrect = typed !== undefined && typed !== char;

                  let cls = 'char-untyped transition-colors';
                  if (isCorrect) cls = 'char-correct';
                  if (isIncorrect) cls = 'char-incorrect';
                  if (isCurrent) cls = 'char-current text-text-main';

                  return (
                    <span key={globalIdx} className={cls}>
                      {char}
                    </span>
                  );
                })}
                {wi < passageWords.length - 1 && (
                  <span className="text-text-dim"> </span>
                )}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-text-dim font-sans text-sm italic transition-theme">
            &mdash; {passage.author}, <em>{passage.source}</em>
          </p>
        </div>
      </div>
    </div>
  );
}
