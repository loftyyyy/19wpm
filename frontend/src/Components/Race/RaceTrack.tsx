import type { RaceParticipant, RaceRoom } from '../../types/race';
import { useRaceRoomValue, type RaceRoomStore } from '../../utils/raceRoomStore';

interface Props {
  /** Room store, not the participant array: this component owns the subscription. */
  store: RaceRoomStore;
  currentUserId: number;
}

const EMPTY_PARTICIPANTS: RaceParticipant[] = [];

const selectParticipants = (room: RaceRoom | null): RaceParticipant[] =>
  room?.participants ?? EMPTY_PARTICIPANTS;

export default function RaceTrack({ store, currentUserId }: Props) {
  const participants = useRaceRoomValue(store, selectParticipants);

  const sorted = [...participants].sort((a, b) => {
    if (a.finishRank > 0 && b.finishRank > 0) return a.finishRank - b.finishRank;
    if (a.finishRank > 0) return -1;
    if (b.finishRank > 0) return 1;
    return b.progressPercent - a.progressPercent;
  });

  const firstRacingIndex = sorted.findIndex(p => p.finishRank === 0 && !p.disconnected);

  return (
    <div className="bg-card border border-line rounded-2xl shadow-sm p-4 transition-theme">
      <div className="flex items-center gap-3 px-4 py-1 mb-1">
        <span className="w-6 shrink-0" />
        <span className="text-[10px] font-sans font-semibold text-text-dim uppercase tracking-wider w-28 shrink-0">
          Player
        </span>
        <span className="text-[10px] font-sans font-semibold text-text-sub uppercase tracking-wider w-14 shrink-0 text-right">
          WPM
        </span>
        <span className="text-[10px] font-sans font-semibold text-text-dim uppercase tracking-wider flex-1">
          Progress
        </span>
      </div>
      {sorted.map((p, i) => {
        const isMe = p.userId === currentUserId;
        const showDivider = firstRacingIndex > 0 && i === firstRacingIndex;
        return (
          <div key={p.userId}>
            {showDivider && (
              <div className="border-t border-line my-1 mx-4" />
            )}
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-theme ${
                isMe ? 'bg-muted border-l-4 border-accent' : ''
              } ${p.disconnected ? 'opacity-40' : ''}`}
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

              <div className="w-14 shrink-0 text-right">
                <span className="text-sm font-sans font-semibold text-accent">
                  {p.currentWpm}
                </span>
                <span className="text-[9px] font-sans text-text-sub block leading-none">
                  {p.finishRank > 0 ? 'finished' : 'wpm'}
                </span>
              </div>

              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(p.progressPercent * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-sans text-text-dim w-8 shrink-0 text-right">
                  {Math.round(p.progressPercent * 100)}%
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
