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
    public static final long SMALL_QUEUE_FORCE_PAIR_AFTER_MS = 5_000L;
    public static final int SMALL_QUEUE_MAX_SIZE = 5;

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

        Optional<Pair> requestedPair = selectRequestedPair(oldestFirst);
        if (requestedPair.isPresent()) {
            return requestedPair;
        }

        // With only two players available, waiting cannot improve the match: there is no third
        // candidate to prefer. Pair them immediately instead of making both sit through the
        // tolerance/fallback timers.
        if (oldestFirst.size() == 2) {
            return Optional.of(new Pair(0, 1));
        }

        long oldestWait = nowMillis - oldestFirst.get(0).enqueuedAt();
        if (oldestWait >= forcePairAfterMillis(oldestFirst.size())) {
            return Optional.of(new Pair(0, 1));
        }

        return selectClosestEligiblePair(oldestFirst, nowMillis);
    }

    /**
     * A player who explicitly asked to match with anyone is paired with the closest available
     * opponent, ignoring the WPM tolerance. The caller still takes the queue lock, so the player
     * is removed from the queue exactly once.
     */
    private Optional<Pair> selectRequestedPair(List<MatchmakingEntry> oldestFirst) {
        for (int i = 0; i < oldestFirst.size(); i++) {
            if (!oldestFirst.get(i).matchNow()) {
                continue;
            }

            int bestIndex = -1;
            long bestScore = Long.MAX_VALUE;
            for (int j = 0; j < oldestFirst.size(); j++) {
                if (i == j) {
                    continue;
                }
                long score = score(oldestFirst.get(i), oldestFirst.get(j));
                if (score < bestScore) {
                    bestScore = score;
                    bestIndex = j;
                }
            }
            if (bestIndex >= 0) {
                return Optional.of(new Pair(i, bestIndex));
            }
        }
        return Optional.empty();
    }

    private Optional<Pair> selectClosestEligiblePair(List<MatchmakingEntry> oldestFirst, long nowMillis) {
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
                long score = score(first, second);
                if (score < bestScore) {
                    bestScore = score;
                    best = new Pair(i, j);
                }
            }
        }
        return Optional.ofNullable(best);
    }

    private static long score(MatchmakingEntry first, MatchmakingEntry second) {
        return (long) Math.abs(first.wpm() - second.wpm()) * 10
                + Math.abs(first.skillTier() - second.skillTier())
                + Math.abs(first.accuracy() - second.accuracy());
    }

    private static long forcePairAfterMillis(int queueSize) {
        return queueSize <= SMALL_QUEUE_MAX_SIZE
                ? SMALL_QUEUE_FORCE_PAIR_AFTER_MS
                : FORCE_PAIR_AFTER_MS;
    }

    public static int toleranceFor(long waitedMillis) {
        long steps = Math.max(0, waitedMillis) / 10_000L;
        return (int) Math.min(MAX_WPM_TOLERANCE, BASE_WPM_TOLERANCE + steps * TOLERANCE_GROWTH_PER_10S);
    }

    public record Pair(int firstIndex, int secondIndex) {
    }
}
