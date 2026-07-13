import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import Lobby from '../Components/Race/Lobby';
import Countdown from '../Components/Race/Countdown';
import RaceTrack from '../Components/Race/RaceTrack';
import RaceResults from '../Components/Race/RaceResults';
import { useAuth } from '../context/AuthContext';
import { useRaceSocket } from '../hooks/useRaceSocket';
import { createRoom, joinRoomByCode, joinMatchmaking } from '../services/race';
import type { TextType } from '../types/race';

const TEXT_TYPES: TextType[] = ['SHORT', 'MEDIUM', 'LONG', 'THICC'];

export default function Race() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth();

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [phase, setPhase] = useState<'setup' | 'lobby' | 'countdown' | 'racing' | 'finished'>('setup');
  const [selectedTextType, setSelectedTextType] = useState<TextType>('SHORT');
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const handleMatchmakingCode = useCallback((code: string) => {
    setRoomCode(code);
    setPhase('lobby');
    setIsMatchmaking(false);
  }, []);

  const socket = useRaceSocket(roomCode, { onMatchmakingRoomCode: handleMatchmakingCode });

  useEffect(() => {
    if (!socket.room || phase !== 'lobby') return;
    if (socket.room.state === 'COUNTDOWN') setPhase('countdown');
  }, [socket.room, phase]);

  useEffect(() => {
    if (!socket.room || phase !== 'racing') return;
    if (socket.room.state === 'FINISHED') setPhase('finished');
  }, [socket.room, phase]);

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
    setPhase('racing');
  }, []);

  const handlePlayAgain = useCallback(() => {
    setRoomCode(null);
    setPhase('setup');
    setIsMatchmaking(false);
    setJoinCode('');
    setJoinError('');
  }, []);

  const renderContent = () => {
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
              disabled={isMatchmaking || isRequesting}
              className="w-full py-3 rounded-xl font-sans font-semibold text-sm bg-muted text-text-main border border-line hover:bg-muted/80 transition-colors hover:cursor-pointer disabled:opacity-40"
            >
              {isMatchmaking ? 'Searching...' : 'Find Public Match'}
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
        />
      );
    }

    if (phase === 'countdown') {
      return <Countdown onComplete={handleCountdownComplete} />;
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
                onFinish={(wpm) => socket.sendFinish(wpm)}
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
  onProgress: (progressPercent: number, currentWpm: number, typedContent: string) => void;
  onFinish: (finalWpm: number) => void;
  startTime: string;
}

function RaceTypingInput({ passage, onProgress, onFinish, startTime }: RaceTypingInputProps) {
  const [typedChars, setTypedChars] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lockedIndex, setLockedIndex] = useState(0);
  const [extraChars, setExtraChars] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const calcWpm = (typed: string) => {
    const minutes = (Date.now() - new Date(startTime).getTime()) / 60000;
    if (minutes <= 0) return 0;
    const words = typed.trim().split(/\s+/).filter(Boolean).length;
    return Math.round(words / minutes);
  };

  const reportProgress = (chars: string[], index: number) => {
    const typed = chars.join('');
    onProgress(Math.min(index / passage.length, 1), calcWpm(typed), typed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (finished) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const lastSpace = typedChars.join('').lastIndexOf(' ', (currentIndex - lockedIndex > 0 ? currentIndex - 1 : currentIndex));
        const wordStart = lastSpace >= lockedIndex ? lastSpace + 1 : lockedIndex;
        const deleteCount = currentIndex - wordStart;
        setTypedChars(prev => prev.slice(0, wordStart));
        setCurrentIndex(wordStart);
        reportProgress(typedChars.slice(0, wordStart), wordStart);
        return;
      }
      if (extraChars.length > 0) {
        setExtraChars(prev => prev.slice(0, -1));
      } else if (currentIndex > lockedIndex) {
        const newIndex = currentIndex - 1;
        setTypedChars(prev => prev.slice(0, -1));
        setCurrentIndex(newIndex);
        reportProgress(typedChars.slice(0, -1), newIndex);
      }
      return;
    }

    if (e.key.length !== 1) return;
    e.preventDefault();

    const passageChar = passage[currentIndex];

    if (e.key === ' ') {
      if (passageChar === ' ' && extraChars.length === 0) {
        const newChars = [...typedChars, ' '];
        const newIndex = currentIndex + 1;
        setTypedChars(newChars);
        setCurrentIndex(newIndex);
        setExtraChars([]);
        setLockedIndex(newIndex);
        reportProgress(newChars, newIndex);
        if (newIndex >= passage.length) {
          setFinished(true);
          onFinish(calcWpm(newChars.join('')));
        }
      } else {
        setExtraChars(prev => [...prev, ' ']);
      }
    } else {
      if (passageChar === ' ') {
        setExtraChars(prev => [...prev, e.key]);
      } else {
        const newChars = [...typedChars, e.key];
        const newIndex = currentIndex + 1;
        setTypedChars(newChars);
        setCurrentIndex(newIndex);
        reportProgress(newChars, newIndex);
        if (newIndex >= passage.length) {
          setFinished(true);
          onFinish(calcWpm(newChars.join('')));
        }
      }
    }
  };

  const chars = passage.split('');

  return (
    <div onClick={() => inputRef.current?.focus()} onCopy={e => e.preventDefault()}>
      <div className="font-mono text-lg leading-relaxed select-none">
        {chars.map((char, i) => {
          if (i < typedChars.length) {
            const isCorrect = typedChars[i] === char;
            return (
              <span
                key={i}
                className={isCorrect ? 'text-text-main' : 'text-red-400 line-through'}
              >
                {char}
              </span>
            );
          }
          if (i === currentIndex) {
            return (
              <span key={i} className="border-l-2 border-accent animate-pulse">
                {char}
              </span>
            );
          }
          return (
            <span key={i} className="text-text-dim">
              {char}
            </span>
          );
        })}
        {extraChars.length > 0 && (
          <span className="text-red-400">{extraChars.join('')}</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        value=""
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        onPaste={e => e.preventDefault()}
        className="opacity-0 absolute w-0 h-0 pointer-events-none"
        readOnly={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );
}
