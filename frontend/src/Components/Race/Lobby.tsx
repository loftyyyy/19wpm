import { useCallback } from 'react';
import type { RaceRoom } from '../../types/race';

interface Props {
  room: RaceRoom;
  currentUserId: number;
  onStart: () => void;
}

export default function Lobby({ room, currentUserId, onStart }: Props) {
  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(room.roomCode);
  }, [room.roomCode]);

  const isHost = currentUserId === room.hostUserId;
  const canStart = room.participants.length >= 2;

  return (
    <div className="bg-card border border-line rounded-2xl shadow-sm p-6 transition-theme max-w-lg mx-auto">
      <div className="text-center mb-6">
        <p className="text-xs font-sans font-semibold text-text-dim uppercase tracking-wider mb-1">Room Code</p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl font-display font-bold text-accent tracking-widest">{room.roomCode}</span>
          <button
            onClick={handleCopyCode}
            className="p-2 text-text-dim hover:text-accent transition-colors hover:cursor-pointer"
            title="Copy room code"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-xs font-sans font-semibold text-text-dim uppercase tracking-wider mb-3">
          Participants ({room.participants.length})
        </p>
        <div className="space-y-2">
          {room.participants.map((p) => (
            <div
              key={p.userId}
              className="flex items-center justify-between bg-muted rounded-xl px-4 py-3 transition-theme"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-sans text-text-main">{p.username}</span>
                {p.userId === currentUserId && (
                  <span className="text-[10px] font-sans font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded">You</span>
                )}
                {p.userId === room.hostUserId && (
                  <span className="text-[10px] font-sans font-semibold text-text-dim bg-muted border border-line px-1.5 py-0.5 rounded">Host</span>
                )}
              </div>
              {p.ready && (
                <span className="text-xs font-sans text-green-500">Ready</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <button
          onClick={onStart}
          disabled={!canStart}
          className="w-full py-3 rounded-xl font-sans font-semibold text-sm transition-colors hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 bg-accent text-white hover:bg-accent-hover"
        >
          Start Race
        </button>
      ) : (
        <p className="text-center text-sm font-sans text-text-dim">Waiting for host to start...</p>
      )}
    </div>
  );
}
