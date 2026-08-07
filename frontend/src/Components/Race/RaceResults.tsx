import type { RaceParticipant, RaceRoom } from '../../types/race';
import type { WpmPoint } from '../../types';
import WpmBurstChart from '../TypingTest/WpmBurstChart';

interface Props {
  participants: RaceParticipant[];
  currentUserId: number;
  onPlayAgain: () => void;
  room?: RaceRoom;
  wpmHistory?: WpmPoint[];
}

export default function RaceResults({ participants, currentUserId, onPlayAgain, room, wpmHistory }: Props) {
  const sorted = [...participants].sort((a, b) => {
    if (a.finishRank > 0 && b.finishRank > 0) return a.finishRank - b.finishRank;
    if (a.finishRank > 0) return -1;
    if (b.finishRank > 0) return 1;
    return 0;
  });

  const winner = sorted.find(p => p.finishRank === 1 && p.finished);
  const myResult = participants.find(p => p.userId === currentUserId);

  const accuracyClass = (accuracy: number) =>
    accuracy >= 95 ? 'text-success' : accuracy >= 80 ? 'text-accent' : 'text-error';

  const formatDuration = (seconds: number) => {
    if (seconds <= 0) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
  };

  return (
    <div className="bg-card border border-line rounded-2xl shadow-sm p-6 transition-theme max-w-lg mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-display font-bold text-text-main mb-1">Race Results</h2>
        {room?.text && (
          <p className="text-xs font-sans text-text-dim">
            {room.text.title} · {room.text.author} · {room.text.wordCount} words
            {room.durationSeconds > 0 && ` · ${formatDuration(room.durationSeconds)}`}
          </p>
        )}
      </div>

      {winner && (
        <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4 mb-4 text-center">
          <p className="text-3xl mb-1">🏆</p>
          <p className="text-lg font-display font-bold text-accent">{winner.username}</p>
          <p className="text-xs font-sans text-text-dim mt-1">
            {winner.userId === currentUserId ? 'You won!' : 'Wins this race'}
          </p>
          <div className="flex justify-center gap-6 mt-3">
            <div className="text-center">
              <p className="text-2xl font-display font-bold text-text-main">{winner.currentWpm}</p>
              <p className="text-xs font-sans text-text-dim">WPM</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-display font-bold ${accuracyClass(winner.accuracy)}`}>
                {winner.accuracy}%
              </p>
              <p className="text-xs font-sans text-text-dim">Accuracy</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-display font-bold text-text-main">{winner.errors}</p>
              <p className="text-xs font-sans text-text-dim">Errors</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1 mb-4">
        {sorted.map((p) => {
          const isMe = p.userId === currentUserId;
          const isDnf = !p.finished || p.disconnected;

          return (
            <div
              key={p.userId}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-theme ${
                isMe && !isDnf ? 'bg-muted border-l-4 border-accent' : ''
              } ${isDnf ? 'opacity-50' : ''}`}
            >
              <span className="w-8 shrink-0 text-center text-sm font-sans font-bold">
                {isDnf ? (
                  <span className="text-error">DNF</span>
                ) : (
                  <span className={p.finishRank === 1 ? 'text-accent' : 'text-text-dim'}>
                    #{p.finishRank}
                  </span>
                )}
              </span>

              <span className="text-sm font-sans text-text-main flex-1 truncate">
                {p.username}
                {isMe && ' (You)'}
              </span>

              {!isDnf && (
                <>
                  <span className="text-sm font-sans font-semibold text-accent w-14 text-right">{p.currentWpm}</span>
                  <span className={`text-sm font-sans font-semibold ${accuracyClass(p.accuracy)} w-12 text-right`}>
                    {p.accuracy}%
                  </span>
                  <span className="text-sm font-sans text-text-dim w-10 text-right">{p.errors}</span>
                </>
              )}

              {isDnf && (
                <span className="text-xs font-sans text-text-dim w-28 text-right">
                  {Math.round(p.progressPercent * 100)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {myResult && (
        <div className="bg-muted rounded-2xl p-4 mt-4">
          <p className="text-xs font-sans font-semibold text-text-dim uppercase tracking-wider mb-3">Your Performance</p>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xl font-display font-bold text-accent">{myResult.currentWpm}</p>
              <p className="text-xs font-sans text-text-dim">WPM</p>
            </div>
            <div>
              <p className={`text-xl font-display font-bold ${accuracyClass(myResult.accuracy)}`}>
                {myResult.accuracy}%
              </p>
              <p className="text-xs font-sans text-text-dim">Accuracy</p>
            </div>
            <div>
              <p className="text-xl font-display font-bold text-text-main">#{myResult.finishRank || 'DNF'}</p>
              <p className="text-xs font-sans text-text-dim">Rank</p>
            </div>
            <div>
              <p className="text-xl font-display font-bold text-text-main">{myResult.errors}</p>
              <p className="text-xs font-sans text-text-dim">Errors</p>
            </div>
          </div>

          {wpmHistory && wpmHistory.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-sans font-semibold text-text-dim uppercase tracking-wider mb-3">WPM Burst Chart</p>
              <div className="bg-card border border-line rounded-xl p-4 transition-theme">
                {/* Note: race history is per-keystroke instantaneous WPM, not practice mode's per-second bins — intentional, matches the live race track */}
                <WpmBurstChart data={wpmHistory} />
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={onPlayAgain}
        className="w-full py-3 rounded-xl font-sans font-semibold text-sm bg-accent text-white hover:bg-accent-hover transition-colors hover:cursor-pointer mt-4"
      >
        Play Again
      </button>
    </div>
  );
}
