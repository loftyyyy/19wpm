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
import { createRoom, joinMatchmaking } from '../services/race';
import type { TextType } from '../types/race';

const TEXT_TYPES: TextType[] = ['SHORT', 'MEDIUM', 'LONG', 'THICC'];

function calcWpm(typed: string, startTime: string): number {
  const minutes = (Date.now() - new Date(startTime).getTime()) / 60000;
  if (minutes <= 0) return 0;
  const words = typed.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words / minutes);
}

export default function Race() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth();

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [phase, setPhase] = useState<'setup' | 'lobby' | 'countdown' | 'racing' | 'finished'>('setup');
  const [selectedTextType, setSelectedTextType] = useState<TextType>('SHORT');
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [typedContent, setTypedContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    if (phase === 'racing' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [phase]);

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

  const handleStart = useCallback(() => {
    socket.sendStart();
  }, [socket]);

  const handleCountdownComplete = useCallback(() => {
    setPhase('racing');
  }, []);

  const handlePlayAgain = useCallback(() => {
    setRoomCode(null);
    setPhase('setup');
    setTypedContent('');
    setIsMatchmaking(false);
  }, []);

  const handleTyping = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setTypedContent(text);

    if (!socket.room?.text || !socket.room?.startTime) return;
    const progress = text.length / socket.room.text.charLength;
    const wpm = calcWpm(text, socket.room.startTime);

    socket.sendProgress(Math.min(progress, 1), wpm, text);

    if (text.length >= socket.room.text.charLength) {
      socket.sendFinish(wpm);
    }
  }, [socket]);

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
              <p className="text-xs font-sans text-text-dim mb-2">
                {socket.room.text.title} &middot; {socket.room.text.author}
              </p>
              <p className="text-sm font-sans text-text-sub mb-3 leading-relaxed">
                {socket.room.text.content}
              </p>
              <textarea
                ref={textareaRef}
                value={typedContent}
                onChange={handleTyping}
                className="w-full h-32 p-3 bg-muted border border-line rounded-xl text-sm font-sans text-text-main placeholder:text-text-dim resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 transition-theme"
                placeholder="Start typing here..."
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
