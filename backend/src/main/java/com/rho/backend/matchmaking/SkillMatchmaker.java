package com.rho.backend.matchmaking;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Pure grouping policy for a single queue, kept free of Redis so the tolerance/fallback rules
 * can be unit tested directly.
 */
public final class SkillMatchmaker {

    /** Smallest room matchmaking will create. */
    public static final int MIN_GROUP_SIZE = 2;

    /**
     * Largest room matchmaking will create. Public race rooms can hold more, but a group of five
     * keeps a race readable and still leaves room for a group of friends plus one stranger.
     */
    public static final int MAX_GROUP_SIZE = 5;

    public static final int BASE_WPM_TOLERANCE = 15;
    public static final int TOLERANCE_GROWTH_PER_10S = 10;
    public static final int MAX_WPM_TOLERANCE = 100;

    /**
     * How long a full queue may hold an ineligible group before it is matched regardless of
     * skill spread. Only used when more than {@link #MAX_GROUP_SIZE} players are queued.
     */
    public static final long FORCE_GROUP_AFTER_MS = 20_000L;

    /**
     * A partial queue waits this long for near-simultaneous joins before it is matched as a
     * smaller group. This is what keeps four friends who search together in one room instead
     * of being split into two pairs by the first two arrivals.
     */
    public static final long PARTIAL_GROUP_GATHER_MS = 3_500L;

    public SkillMatchmaker() {
    }

    /**
     * Selects a group of up to {@link #MAX_GROUP_SIZE} entries from {@code oldestFirst} (oldest
     * enqueued entry at index 0). Returns the indices so the caller can remove the exact
     * serialized entries.
     */
    public Optional<Group> selectGroup(List<MatchmakingEntry> oldestFirst, long nowMillis) {
        if (oldestFirst.size() < MIN_GROUP_SIZE) {
            return Optional.empty();
        }

        Optional<Group> requestedGroup = selectRequestedGroup(oldestFirst);
        if (requestedGroup.isPresent()) {
            return requestedGroup;
        }

        int queueSize = oldestFirst.size();

        // A queue that exactly fills one room has nothing to gain by waiting.
        if (queueSize == MAX_GROUP_SIZE) {
            return Optional.of(allOf(oldestFirst));
        }

        if (queueSize > MAX_GROUP_SIZE) {
            // Once the oldest player has waited out the fallback, force them into a group with
            // the closest available racers. Checking this first prevents a steady stream of
            // new, tightly matched players from starving the oldest entry forever.
            long oldestWait = nowMillis - oldestFirst.get(0).enqueuedAt();
            if (oldestWait >= FORCE_GROUP_AFTER_MS) {
                return Optional.of(selectClosestGroup(oldestFirst, 0));
            }

            return selectClosestEligibleGroup(oldestFirst, nowMillis);
        }

        // Partial queue: give the rest of a group a brief window to arrive before committing
        // to a smaller match. After the window, match everyone who is waiting.
        long oldestWait = nowMillis - oldestFirst.get(0).enqueuedAt();
        if (oldestWait < PARTIAL_GROUP_GATHER_MS) {
            return Optional.empty();
        }
        return Optional.of(allOf(oldestFirst));
    }

    /**
     * A player who explicitly asked to match with anyone is grouped immediately with the closest
     * available racers, ignoring both the gather window and the WPM tolerance. The caller still
     * takes the queue lock, so the player is removed from the queue exactly once.
     */
    private Optional<Group> selectRequestedGroup(List<MatchmakingEntry> oldestFirst) {
        for (int i = 0; i < oldestFirst.size(); i++) {
            if (oldestFirst.get(i).matchNow()) {
                return Optional.of(selectClosestGroup(oldestFirst, i));
            }
        }
        return Optional.empty();
    }

    /**
     * Returns the tightest group of {@link #MAX_GROUP_SIZE} sorted by WPM, provided its total
     * spread is within the tolerance earned by the group's longest wait. If the tightest group
     * is outside tolerance, every other group is too.
     */
    private Optional<Group> selectClosestEligibleGroup(List<MatchmakingEntry> entries, long nowMillis) {
        Group best = bestGroupByWpm(entries, MAX_GROUP_SIZE);
        int minWpm = best.indices().stream()
                .mapToInt(index -> entries.get(index).wpm())
                .min()
                .orElse(0);
        int maxWpm = best.indices().stream()
                .mapToInt(index -> entries.get(index).wpm())
                .max()
                .orElse(0);
        int spread = maxWpm - minWpm;
        long longestWait = best.indices().stream()
                .mapToLong(index -> nowMillis - entries.get(index).enqueuedAt())
                .max()
                .orElse(0L);
        return spread <= toleranceFor(longestWait) ? Optional.of(best) : Optional.empty();
    }

    /**
     * Grows a group from {@code seedIndex}, adding players in ascending score order. Used for an
     * explicit immediate-match request, which intentionally ignores the WPM tolerance.
     */
    private static Group selectClosestGroup(List<MatchmakingEntry> entries, int seedIndex) {
        MatchmakingEntry seed = entries.get(seedIndex);
        List<Integer> candidates = new ArrayList<>(entries.size() - 1);
        for (int i = 0; i < entries.size(); i++) {
            if (i != seedIndex) {
                candidates.add(i);
            }
        }
        candidates.sort(Comparator
                .comparingLong((Integer index) -> score(seed, entries.get(index)))
                .thenComparingInt(index -> index));

        List<Integer> group = new ArrayList<>(MAX_GROUP_SIZE);
        group.add(seedIndex);
        for (int i = 0; i < candidates.size() && group.size() < MAX_GROUP_SIZE; i++) {
            group.add(candidates.get(i));
        }
        return new Group(List.copyOf(group));
    }

    /**
     * Finds the group of {@code size} with the smallest WPM spread. Sorting by WPM first turns
     * the search into a sliding window, so the result is deterministic and O(n log n).
     */
    private static Group bestGroupByWpm(List<MatchmakingEntry> entries, int size) {
        if (entries.size() <= size) {
            return allOf(entries);
        }

        List<Integer> byWpm = new ArrayList<>(entries.size());
        for (int i = 0; i < entries.size(); i++) {
            byWpm.add(i);
        }
        byWpm.sort(Comparator
                .comparingInt((Integer index) -> entries.get(index).wpm())
                .thenComparingInt(index -> index));

        List<Integer> best = null;
        int bestSpread = Integer.MAX_VALUE;
        long bestOldestEnqueuedAt = Long.MAX_VALUE;

        for (int start = 0; start + size <= byWpm.size(); start++) {
            List<Integer> window = byWpm.subList(start, start + size);
            int spread = entries.get(window.get(window.size() - 1)).wpm()
                    - entries.get(window.get(0)).wpm();
            long oldestEnqueuedAt = window.stream()
                    .mapToLong(index -> entries.get(index).enqueuedAt())
                    .min()
                    .orElse(0L);
            if (spread < bestSpread
                    || (spread == bestSpread && oldestEnqueuedAt < bestOldestEnqueuedAt)) {
                bestSpread = spread;
                bestOldestEnqueuedAt = oldestEnqueuedAt;
                best = window;
            }
        }

        return new Group(List.copyOf(best));
    }

    private static Group allOf(List<MatchmakingEntry> entries) {
        List<Integer> indices = new ArrayList<>(entries.size());
        for (int i = 0; i < entries.size(); i++) {
            indices.add(i);
        }
        return new Group(List.copyOf(indices));
    }

    private static long score(MatchmakingEntry first, MatchmakingEntry second) {
        return (long) Math.abs(first.wpm() - second.wpm()) * 10
                + Math.abs(first.skillTier() - second.skillTier())
                + Math.abs(first.accuracy() - second.accuracy());
    }

    public static int toleranceFor(long waitedMillis) {
        long steps = Math.max(0, waitedMillis) / 10_000L;
        return (int) Math.min(MAX_WPM_TOLERANCE, BASE_WPM_TOLERANCE + steps * TOLERANCE_GROWTH_PER_10S);
    }

    /**
     * The indices of the queued entries that should share a room.
     */
    public record Group(List<Integer> indices) {
    }
}
