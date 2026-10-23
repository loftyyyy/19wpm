import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTypingEngine } from '../hooks/useTypingEngine';
import TypingViewport from '../Components/TypingTest/TypingViewport';
import { useTypingActivity } from '../hooks/useTypingActivity';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import Lobby from '../Components/Race/Lobby';
import Countdown from '../Components/Race/Countdown';
import RaceTrack from '../Components/Race/RaceTrack';
import RaceResults from '../Components/Race/RaceResults';
import { useAuth } from '../context/AuthContext';
import { useRaceSocket } from '../hooks/useRaceSocket';
import { createRoom, joinRoomByCode, joinMatchmaking, getPendingMatch } from '../services/race';
import type { TextType } from '../types/race';
import type { Passage, TestResult, WpmPoint } from '../types';

const TEXT_TYPES: TextType[] = ['SHORT', 'MEDIUM', 'LONG', 'THICC'];

export default function Race() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, updateUser } = useAuth();

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [phase, setPhase] = useState<'setup' | 'lobby' | 'countdown' | 'racing' | 'finished'>('setup');
  const [selectedTextType, setSelectedTextType] = useState<TextType>('SHORT');
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [matchmakingSeconds, setMatchmakingSeconds] = useState(0);
  const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(null);
  const [raceWpmHistory, setRaceWpmHistory] = useState<WpmPoint[]>([]);
  const [myRaceResult, setMyRaceResult] = useState<TestResult | null>(null);
  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStartIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleMatchmakingCode = useCallback((code: string) => {
    setRoomCode(code);
    setPhase('lobby');
    setIsMatchmaking(false);
  }, []);

  const socket = useRaceSocket(roomCode, { onMatchmakingRoomCode: handleMatchmakingCode });

  useEffect(() => {
    if (socket.raceStreak == null) return;
    updateUser({ streak: socket.raceStreak });
  }, [socket.raceStreak, updateUser]);

  useEffect(() => {
    if (!socket.room || phase === 'finished') return;
    if (socket.room.state === 'FINISHED') setPhase('finished');
  }, [socket.room, phase]);

  useEffect(() => {
    if (!socket.room || phase === 'racing' || phase === 'finished') return;
    if (socket.room.state === 'RACING') setPhase('racing');
  }, [socket.room, phase]);

  useEffect(() => {
    if (!socket.room || phase !== 'lobby') return;
    if (socket.room.state === 'COUNTDOWN') setPhase('countdown');
  }, [socket.room, phase]);

  useEffect(() => {
    if (!socket.room) return;
    if (socket.room.hostUserId !== null) return;
    if (socket.room.state !== 'LOBBY') return;

    const count = socket.room.participants.filter(p => p.connected).length;

    if (autoStartTimerRef.current) clearTimeout(autoStartTimerRef.current);
    if (autoStartIntervalRef.current) clearInterval(autoStartIntervalRef.current);

    if (count >= 2) {
      setAutoStartCountdown(5);
      let remaining = 5;
      autoStartIntervalRef.current = setInterval(() => {
        remaining -= 1;
        setAutoStartCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(autoStartIntervalRef.current!);
        }
      }, 1000);
      autoStartTimerRef.current = setTimeout(() => {
        socket.sendStart();
        setAutoStartCountdown(null);
      }, 5000);
    } else {
      setAutoStartCountdown(null);
    }

    return () => {
      if (autoStartTimerRef.current) clearTimeout(autoStartTimerRef.current);
      if (autoStartIntervalRef.current) clearInterval(autoStartIntervalRef.current);
    };
  }, [socket.room?.participants.filter(p => p.connected).length, socket.room?.state, socket.room?.hostUserId]);

  useEffect(() => {
    if (!isMatchmaking) {
      setMatchmakingSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setMatchmakingSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isMatchmaking]);

  useEffect(() => {
    if (!isMatchmaking) return;
    const interval = setInterval(async () => {
      const code = await getPendingMatch();
      if (code) {
        handleMatchmakingCode(code);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isMatchmaking, handleMatchmakingCode]);

  const handleCancelMatchmaking = useCallback(async () => {
    try {
      await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/race/matchmaking/leave`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('19wpm-access-token') ?? ''}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch { /* ignore */ }
    setIsMatchmaking(false);
    setMatchmakingSeconds(0);
  }, []);

  const handleCreateRoom = useCallback(async () => {
    if (isRequesting) return;
    setIsRequesting(true);
    try {
      const code = await createRoom(selectedTextType, true);
      setRoomCode(code);
      setPhase('lobby');
    } catch {
      console.error('Failed to create room');
    } finally {
      setIsRequesting(false);
    }
  }, [selectedTextType, isRequesting]);

  const handleJoinMatchmaking = useCallback(async () => {
    if (isRequesting) return;
    setIsRequesting(true);
    try {
      await joinMatchmaking(selectedTextType);
      setIsMatchmaking(true);
    } catch {
      console.error('Failed to join matchmaking');
    } finally {
      setIsRequesting(false);
    }
  }, [selectedTextType, isRequesting]);

  const handleJoinByCode = useCallback(async () => {
    if (!joinCode.trim() || isRequesting) return;
    setJoinError('');
    setIsRequesting(true);
    try {
      await joinRoomByCode(joinCode.trim().toUpperCase());
      setRoomCode(joinCode.trim().toUpperCase());
      setPhase('lobby');
    } catch {
      setJoinError('Room not found or already started.');
    } finally {
      setIsRequesting(false);
    }
  }, [joinCode, isRequesting]);

  const handleStart = useCallback(() => {
    socket.sendStart();
  }, [socket]);

  const handleCountdownComplete = useCallback(() => {
    if (socket.room?.state === 'RACING') setPhase('racing');
    else if (socket.room?.state === 'FINISHED') setPhase('finished');
  }, [socket.room?.state]);

  const handlePlayAgain = useCallback(() => {
    setRoomCode(null);
    setPhase('setup');
    setIsMatchmaking(false);
    setJoinCode('');
    setJoinError('');
    setMatchmakingSeconds(0);
    setAutoStartCountdown(null);
    setRaceWpmHistory([]);
    setMyRaceResult(null);
  }, []);

  const renderContent = () => {
    if (isMatchmaking) {
      return (
        <div className="bg-card border border-line rounded-2xl shadow-sm p-8 transition-theme max-w-lg mx-auto text-center">
          <div className="mb-6">
            <div className="w-12 h-12 rounded-full border-4 border-accent border-t-transparent animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-display font-semibold text-text-main mb-2">Finding a match...</h2>
            <p className="text-text-dim font-sans text-sm">
              Searching for {selectedTextType.toLowerCase()} race
            </p>
          </div>
          <p className="text-text-dim font-sans text-xs mb-6">
            {matchmakingSeconds}s elapsed &middot; waiting for opponents
          </p>
          {matchmakingSeconds >= 30 && (
            <p className="text-text-dim font-sans text-xs mb-4 bg-muted rounded-xl p-3">
              Taking longer than usual. Ask a friend to join at{' '}
              <span className="text-accent font-semibold">
                19wpm.vercel.app/race
              </span>
            </p>
          )}
          <button
            onClick={handleCancelMatchmaking}
            className="px-6 py-2 rounded-xl font-sans font-semibold text-sm bg-muted border border-line text-text-sub hover:text-text-main transition-colors hover:cursor-pointer"
          >
            Cancel
          </button>
        </div>
      );
    }

    if (phase === 'setup') {
      return (
        <div className="bg-card border border-line rounded-2xl shadow-sm p-6 transition-theme max-w-lg mx-auto">
          <h2 className="text-xl font-display font-semibold text-text-main text-center mb-6">Race Setup</h2>

          <div className="mb-6">
            <p className="text-xs font-sans font-semibold text-text-dim uppercase tracking-wider mb-3">Text Type</p>
            <div className="flex gap-2">
              {TEXT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTextType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-sans font-semibold transition-colors hover:cursor-pointer ${
                    selectedTextType === t
                      ? 'bg-accent text-white'
                      : 'bg-muted text-text-sub hover:text-text-main'
                  }`}
                >
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleCreateRoom}
              disabled={isRequesting}
              className="w-full py-3 rounded-xl font-sans font-semibold text-sm bg-accent text-white hover:bg-accent-hover transition-colors hover:cursor-pointer disabled:opacity-40"
            >
              Create Private Room
            </button>
            <button
              onClick={handleJoinMatchmaking}
              disabled={isRequesting}
              className="w-full py-3 rounded-xl font-sans font-semibold text-sm bg-muted text-text-main border border-line hover:bg-muted/80 transition-colors hover:cursor-pointer disabled:opacity-40"
            >
              Find Public Match
            </button>
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-xs text-text-dim font-sans">
                or join existing
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
              placeholder="Enter room code"
              maxLength={6}
              className="flex-1 px-4 py-3 rounded-xl bg-muted border border-line text-sm font-sans text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 uppercase tracking-widest"
            />
            <button
              onClick={handleJoinByCode}
              disabled={!joinCode.trim() || isRequesting}
              className="px-5 py-3 rounded-xl font-sans font-semibold text-sm bg-muted border border-line text-text-main hover:bg-accent hover:text-white hover:border-accent transition-colors disabled:opacity-40 hover:cursor-pointer"
            >
              Join
            </button>
          </div>

          {joinError && (
            <p className="text-red-400 text-xs font-sans mt-2 text-center">
              {joinError}
            </p>
          )}
        </div>
      );
    }

    if (phase === 'lobby') {
      if (!socket.room) {
        return (
          <div className="flex items-center justify-center min-h-40">
            <p className="text-text-dim font-sans text-sm">
              Connecting to room...
            </p>
          </div>
        );
      }
      return (
        <Lobby
          room={socket.room}
          currentUserId={Number(user?.id ?? 0)}
          onStart={handleStart}
          autoStartCountdown={autoStartCountdown}
        />
      );
    }

    if (phase === 'countdown') {
      return (
        <Countdown
          startTime={socket.room?.countdownStartTime ?? new Date().toISOString()}
          durationMs={socket.room?.countdownDurationMs ?? 3500}
          offsetMs={socket.serverOffsetMs}
          onComplete={handleCountdownComplete}
        />
      );
    }

    if (phase === 'racing' && socket.room) {
      return (
        <div className="space-y-4 max-w-2xl mx-auto">
          <RaceTrack
            participants={socket.room.participants}
            currentUserId={Number(user?.id ?? 0)}
          />
          {socket.room.text && (
            <div className="bg-card border border-line rounded-2xl shadow-sm p-4 transition-theme">
              <p className="text-xs font-sans text-text-dim mb-3">
                {socket.room.text.title} · {socket.room.text.author}
              </p>
              <RaceTypingInput
                passage={socket.room.text.content}
                onProgress={(p, w, t) => socket.sendProgress(p, w, t)}
                onFinish={(wpm, errors, correctChars, wpmHistory, result, keyIntervalsMs) => {
                  setRaceWpmHistory(wpmHistory);
                  setMyRaceResult(result);
                  socket.sendFinish(wpm, errors, correctChars, keyIntervalsMs);
                }}
                startTime={socket.room.startTime!}
              />
            </div>
          )}
        </div>
      );
    }

    if (phase === 'finished' && socket.room) {
      return (
        <RaceResults
          participants={socket.room.participants}
          currentUserId={Number(user?.id ?? 0)}
          onPlayAgain={handlePlayAgain}
          room={socket.room}
          wpmHistory={raceWpmHistory}
          replayResult={myRaceResult}
        />
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface transition-theme flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-text-dim font-sans text-sm">Loading...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-surface transition-theme flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="bg-card border border-line rounded-2xl p-8 max-w-sm w-full text-center">
            <h1 className="text-xl font-display font-semibold text-text-main mb-2">Sign in to compete</h1>
            <p className="text-sm font-sans text-text-dim mb-6">You need an account to join or create a race.</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 rounded-xl font-sans font-semibold text-sm bg-accent text-white hover:bg-accent-hover transition-colors hover:cursor-pointer mb-3"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-sans text-text-sub underline hover:text-text-main transition-colors hover:cursor-pointer"
            >
              Create account
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface transition-theme flex flex-col">
      <Navbar />
      <main className="flex-1 px-4 py-12">
        {renderContent()}
      </main>
      <Footer />
    </div>
  );
}

interface RaceTypingInputProps {
  passage: string;
  onProgress: (progressPercent: number, currentWpm: number, errors: number) => void;
  onFinish: (finalWpm: number, errors: number, correctChars: number, wpmHistory: WpmPoint[], result: TestResult, keyIntervalsMs: number[]) => void;
  startTime: string;
}

function RaceTypingInput({ passage, onProgress, onFinish, startTime }: RaceTypingInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const finishReportedRef = useRef(false);
  const keyIntervalsRef = useRef<number[]>([]);
  const lastKeyAtRef = useRef<number | null>(null);
  const onProgressRef = useRef(onProgress);
  const onFinishRef = useRef(onFinish);
  const { isTypingActive, markActive } = useTypingActivity();

  const passageObj = useMemo<Passage>(
    () => ({ title: '', text: passage, author: '', source: '' }),
    [passage]
  );

  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  const { state, handleKeyDown, getResult } = useTypingEngine(passageObj, 60, 'words', 25, 'words');

  const calcWpm = useCallback((typed: string) => {
    const minutes = (Date.now() - new Date(startTime).getTime()) / 60000;
    if (minutes <= 0) return 0;
    const words = typed.trim().split(/\s+/).filter(Boolean).length;
    return Math.round(words / minutes);
  }, [startTime]);

  useEffect(() => {
    const typed = state.typedChars.join('');
    onProgressRef.current(
      Math.min(state.currentIndex / passage.length, 1),
      calcWpm(typed),
      state.totalIncorrect
    );
  }, [state.typedChars, state.currentIndex, state.totalIncorrect, passage, calcWpm]);

  useEffect(() => {
    if (state.isFinished && !finishReportedRef.current) {
      finishReportedRef.current = true;
      const typed = state.typedChars.join('');
      onProgressRef.current(1, calcWpm(typed), state.totalIncorrect);
      onFinishRef.current(calcWpm(typed), state.totalIncorrect, state.totalCorrect, state.wpmHistory, getResult(), keyIntervalsRef.current);
    }
    if (!state.isFinished) {
      finishReportedRef.current = false;
    }
  }, [state.isFinished, state.typedChars, state.wpmHistory, state.totalIncorrect, state.totalCorrect, calcWpm, getResult]);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleContainerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab' || e.key === 'Escape') {
      e.preventDefault();
      return;
    }
    if (!e.repeat && e.key.length === 1) {
      const now = performance.now();
      const previous = lastKeyAtRef.current;
      if (previous !== null) {
        const interval = Math.round(now - previous);
        if (interval >= 0 && keyIntervalsRef.current.length < 2000) {
          keyIntervalsRef.current.push(interval);
        }
      }
      lastKeyAtRef.current = now;
    }
    markActive();
    handleKeyDown(e);
  }, [handleKeyDown, markActive]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleContainerKeyDown}
      onClick={() => containerRef.current?.focus()}
      className="w-full focus:outline-none focus:ring-2 focus:ring-accent/30 font-mono text-xl md:text-2xl leading-relaxed cursor-text select-none"
    >
      {!state.isRunning && !state.isFinished && (
        <div className="text-center text-text-dim font-sans text-sm mb-4 transition-theme">
          Start typing to begin
        </div>
      )}
      <TypingViewport
        charsText={passage}
        typedChars={state.typedChars}
        currentIndex={state.currentIndex}
        lockedIndex={state.lockedIndex}
        mistakeWordIndices={state.mistakeWordIndices}
        extraChars={state.extraChars}
        isFinished={state.isFinished}
        isTypingActive={isTypingActive}
        extraVariant="block"
        measureKey={passage}
      />
    </div>
  );
}
