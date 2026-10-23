package com.rho.backend.matchmaking;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SkillMatchmakerTest {

    private final SkillMatchmaker matchmaker = new SkillMatchmaker();
    private final long now = 10_000L;

    @Test
    @DisplayName("Pairs players within the base WPM tolerance")
    void pairsWithinBaseTolerance() {
        var pair = matchmaker.selectPair(List.of(
                entry(1, 60, 95, now),
                entry(2, 150, 95, now),
                entry(3, 70, 96, now)), now);

        assertThat(pair).contains(new SkillMatchmaker.Pair(0, 2));
    }

    @Test
    @DisplayName("Prefers the closest skill instead of simply the oldest pair")
    void prefersClosestSkill() {
        var pair = matchmaker.selectPair(List.of(
                entry(1, 60, 95, now),
                entry(2, 45, 95, now),
                entry(3, 62, 96, now)), now);

        assertThat(pair).contains(new SkillMatchmaker.Pair(0, 2));
    }

    @Test
    @DisplayName("Pairs the only two queued players immediately regardless of skill gap")
    void pairsTwoPlayersImmediately() {
        var pair = matchmaker.selectPair(List.of(
                entry(1, 30, 80, now),
                entry(2, 150, 99, now)), now);

        assertThat(pair).contains(new SkillMatchmaker.Pair(0, 1));
    }

    @Test
    @DisplayName("Widens tolerance as the oldest player waits in a large queue")
    void widensToleranceOverTime() {
        var entries = List.of(
                entry(1, 70, 95, now - 10_000),
                entry(2, 95, 95, now - 10_000),
                entry(3, 300, 95, now),
                entry(4, 260, 95, now),
                entry(5, 220, 95, now),
                entry(6, 180, 95, now));

        assertThat(matchmaker.selectPair(entries, now)).contains(new SkillMatchmaker.Pair(0, 1));
        assertThat(SkillMatchmaker.toleranceFor(10_000)).isEqualTo(25);
    }

    @Test
    @DisplayName("Does not pair a large skill gap before the sparse-queue deadline")
    void waitsForFallbackWhenGapIsLarge() {
        var entries = List.of(
                entry(1, 30, 80, now),
                entry(2, 150, 99, now),
                entry(3, 300, 99, now));

        assertThat(matchmaker.selectPair(entries, now)).isEmpty();
    }

    @Test
    @DisplayName("Forces a sparse three-to-five player queue together after five seconds")
    void forcesSparseQueueAfterFiveSeconds() {
        var entries = List.of(
                entry(1, 30, 80, now - SkillMatchmaker.SMALL_QUEUE_FORCE_PAIR_AFTER_MS),
                entry(2, 150, 99, now),
                entry(3, 300, 99, now));

        assertThat(matchmaker.selectPair(entries, now)).contains(new SkillMatchmaker.Pair(0, 1));

        var justBeforeDeadline = List.of(
                entry(1, 30, 80, now - SkillMatchmaker.SMALL_QUEUE_FORCE_PAIR_AFTER_MS + 1),
                entry(2, 150, 99, now),
                entry(3, 300, 99, now));

        assertThat(matchmaker.selectPair(justBeforeDeadline, now)).isEmpty();
    }

    @Test
    @DisplayName("Keeps the twenty-second fallback for larger queues")
    void forcesLargeQueueAfterTwentySeconds() {
        var entries = List.of(
                entry(1, 30, 80, now - SkillMatchmaker.FORCE_PAIR_AFTER_MS),
                entry(2, 150, 99, now),
                entry(3, 300, 99, now),
                entry(4, 260, 99, now),
                entry(5, 220, 99, now),
                entry(6, 180, 99, now));

        assertThat(matchmaker.selectPair(entries, now)).contains(new SkillMatchmaker.Pair(0, 1));

        var justBeforeDeadline = List.of(
                entry(1, 30, 80, now - SkillMatchmaker.FORCE_PAIR_AFTER_MS + 1),
                entry(2, 150, 99, now),
                entry(3, 300, 99, now),
                entry(4, 260, 99, now),
                entry(5, 220, 99, now),
                entry(6, 180, 99, now));

        assertThat(matchmaker.selectPair(justBeforeDeadline, now)).isEmpty();
    }

    @Test
    @DisplayName("Honors an immediate-match request outside the tolerance")
    void honorsImmediateMatchRequest() {
        var entries = List.of(
                requested(1, 30, 80, now),
                entry(2, 100, 99, now),
                entry(3, 160, 99, now));

        assertThat(matchmaker.selectPair(entries, now)).contains(new SkillMatchmaker.Pair(0, 1));
    }

    @Test
    @DisplayName("Matches a flagged entry with the closest available opponent")
    void matchesFlaggedEntryWithClosestOpponent() {
        var entries = List.of(
                entry(1, 160, 99, now),
                requested(2, 30, 80, now),
                entry(3, 100, 99, now));

        assertThat(matchmaker.selectPair(entries, now)).contains(new SkillMatchmaker.Pair(1, 2));
    }

    @Test
    @DisplayName("An immediate-match request cannot pair a lone player")
    void immediateMatchNeedsAnotherPlayer() {
        assertThat(matchmaker.selectPair(List.of(requested(1, 60, 95, now)), now)).isEmpty();
    }

    @Test
    @DisplayName("Needs at least two queued players")
    void needsTwoPlayers() {
        assertThat(matchmaker.selectPair(List.of(entry(1, 60, 95, now)), now)).isEmpty();
        assertThat(matchmaker.selectPair(List.of(), now)).isEmpty();
    }

    private MatchmakingEntry entry(long userId, int wpm, int accuracy, long enqueuedAt) {
        return new MatchmakingEntry(userId, wpm, accuracy, enqueuedAt);
    }

    private MatchmakingEntry requested(long userId, int wpm, int accuracy, long enqueuedAt) {
        return new MatchmakingEntry(userId, wpm, accuracy, enqueuedAt, true);
    }
}
