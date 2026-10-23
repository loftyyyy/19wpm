package com.rho.backend.matchmaking;

/**
 * A queued player's matchmaking profile plus the time they entered the queue.
 *
 * <p>{@code matchNow} records an explicit "match with anyone" request. It is persisted with the
 * queue entry so it survives until the next player joins, and it is ignored once the entry is
 * paired. Older serialized entries that do not carry the field deserialize as {@code false}.</p>
 */
public record MatchmakingEntry(long userId, int wpm, int accuracy, long enqueuedAt, boolean matchNow) {

    public MatchmakingEntry(long userId, int wpm, int accuracy, long enqueuedAt) {
        this(userId, wpm, accuracy, enqueuedAt, false);
    }

    public MatchmakingEntry withMatchNow(boolean matchNow) {
        return new MatchmakingEntry(userId, wpm, accuracy, enqueuedAt, matchNow);
    }

    public int skillTier() {
        return wpmTier() * 4 + accuracyTier();
    }

    private int wpmTier() {
        if (wpm < 30) return 0;
        if (wpm < 60) return 1;
        if (wpm < 90) return 2;
        if (wpm < 120) return 3;
        return 4;
    }

    private int accuracyTier() {
        if (accuracy < 85) return 0;
        if (accuracy < 92) return 1;
        if (accuracy < 97) return 2;
        return 3;
    }
}
