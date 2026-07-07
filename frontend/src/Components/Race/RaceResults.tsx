import type { RaceParticipant } from '../../types/race';

interface Props {
  participants: RaceParticipant[];
  currentUserId: number;
  onPlayAgain: () => void;
}

export default function RaceResults({ participants, currentUserId, onPlayAgain }: Props) {
  const sorted = [...participants].sort((a, b) => {
    if (a.finishRank > 0 && b.finishRank > 0) return a.finishRank - b.finishRank;
    if (a.finishRank > 0) return -1;
    if (b.finishRank > 0) return 1;
    return 0;
  });

  return (
    <div className="bg-card border border-line rounded-2xl shadow-sm p-6 transition-theme max-w-lg mx-auto">
      <h2 className="text-xl font-display font-semibold text-text-main text-center mb-6">Race Results</h2>

      <div className="space-y-2 mb-6">
        {sorted.map((p, i) => {
          const isMe = p.userId === currentUserId;
          const isDnf = p.finishRank === 0;

          return (
            <div
              key={p.userId}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-theme ${
                isMe ? 'bg-muted border-l-4 border-accent' : ''
              }`}
            >
              <span className="w-8 shrink-0 text-center">
                {isDnf ? (
                  <span className="text-xs font-sans font-semibold text-red-500">DNF</span>
                ) : p.finishRank === 1 ? (
                  <span className="text-lg">🏆</span>
                ) : (
                  <span className="text-sm font-sans font-bold text-text-dim">#{p.finishRank}</span>
                )}
              </span>

              <span className="text-sm font-sans text-text-main flex-1 truncate">{p.username}</span>

              {!isDnf && (
                <>
                  <span className="text-sm font-sans font-semibold text-accent w-14 text-right">{p.currentWpm}</span>
                  <span className="text-sm font-sans text-text-dim w-10 text-right">{p.errors}</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onPlayAgain}
        className="w-full py-3 rounded-xl font-sans font-semibold text-sm bg-accent text-white hover:bg-accent-hover transition-colors hover:cursor-pointer"
      >
        Play Again
      </button>
    </div>
  );
}
