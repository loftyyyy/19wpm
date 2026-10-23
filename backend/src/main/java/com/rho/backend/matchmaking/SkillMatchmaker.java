package com.rho.backend.matchmaking;

import java.util.List;
import java.util.Optional;

/**
 * Pure pairing policy for a single queue, kept free of Redis so the tolerance/fallback rules can
 * be unit tested directly.
 */
public final class SkillMatchmaker {

    public static final int BASE_WPM_TOLERANCE = 15;
    public static final int TOLERANCE_GROWTH_PER_10S = 10;
    public static final int MAX_WPM_TOLERANCE = 100;
    public static final long FORCE_PAIR_AFTER_MS = 20_000L;

    public SkillMatchmaker() {
    }

    /**
     * Selects a pair from {@code oldestFirst} (oldest enqueued entry at index 0). Returns the two
     * indices so the caller can remove the exact serialized entries.
     */
    public Optional<Pair> selectPair(List<MatchmakingEntry> oldestFirst, long nowMillis) {
        if (oldestFirst.size() < 2) {
            return Optional.empty();
        }

        long oldestWait = nowMillis - oldestFirst.get(0).enqueuedAt();
        if (oldestWait >= FORCE_PAIR_AFTER_MS) {
            return Optional.of(new Pair(0, 1));
        }

        Pair best = null;
        long bestScore = Long.MAX_VALUE;

        for (int i = 0; i < oldestFirst.size() - 1; i++) {
            MatchmakingEntry first = oldestFirst.get(i);
            for (int j = i + 1; j < oldestFirst.size(); j++) {
                MatchmakingEntry second = oldestFirst.get(j);
                int wpmGap = Math.abs(first.wpm() - second.wpm());
                long wait = Math.max(nowMillis - first.enqueuedAt(), nowMillis - second.enqueuedAt());
                int tolerance = toleranceFor(wait);
                if (wpmGap > tolerance) {
                    continue;
                }
                long score = (long) wpmGap * 10
                        + Math.abs(first.skillTier() - second.skillTier())
                        + Math.abs(first.accuracy() - second.accuracy());
                if (score < bestScore) {
                    bestScore = score;
                    best = new Pair(i, j);
                }
            }
        }
        return Optional.ofNullable(best);
    }

    public static int toleranceFor(long waitedMillis) {
        long steps = Math.max(0, waitedMillis) / 10_000L;
        return (int) Math.min(MAX_WPM_TOLERANCE, BASE_WPM_TOLERANCE + steps * TOLERANCE_GROWTH_PER_10S);
    }

    public record Pair(int firstIndex, int secondIndex) {
    }
}
