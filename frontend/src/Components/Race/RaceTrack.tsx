import type { RaceParticipant } from '../../types/race';

interface Props {
  participants: RaceParticipant[];
  currentUserId: number;
}

export default function RaceTrack({ participants, currentUserId }: Props) {
  const sorted = [...participants].sort((a, b) => {
    if (a.finishRank > 0 && b.finishRank > 0) return a.finishRank - b.finishRank;
    if (a.finishRank > 0) return -1;
    if (b.finishRank > 0) return 1;
    return b.progressPercent - a.progressPercent;
  });

  return (
    <div className="bg-card border border-line rounded-2xl shadow-sm p-4 transition-theme space-y-2">
      {sorted.map((p) => {
        const isMe = p.userId === currentUserId;
        return (
          <div
            key={p.userId}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-theme ${
              isMe ? 'bg-muted border-l-4 border-accent' : ''
            }`}
          >
            {p.finishRank > 0 ? (
              <span className="text-xs font-sans font-bold text-accent w-6 shrink-0">
                #{p.finishRank}
              </span>
            ) : p.disconnected ? (
              <span className="text-xs font-sans font-semibold text-red-500 w-6 shrink-0">
                DNF
              </span>
            ) : (
              <span className="w-6 shrink-0" />
            )}

            <span className="text-sm font-sans text-text-main w-28 truncate shrink-0">
              {p.username}
            </span>

            <span className="text-sm font-sans font-semibold text-accent w-14 shrink-0 text-right">
              {p.currentWpm}
            </span>

            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${Math.round(p.progressPercent * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
