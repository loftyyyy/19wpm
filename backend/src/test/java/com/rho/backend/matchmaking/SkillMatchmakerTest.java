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
                entry(1, 60, 95, 0),
                entry(2, 70, 96, 0)), now);

        assertThat(pair).contains(new SkillMatchmaker.Pair(0, 1));
    }

    @Test
    @DisplayName("Prefers the closest skill instead of simply the oldest pair")
    void prefersClosestSkill() {
        var pair = matchmaker.selectPair(List.of(
                entry(1, 60, 95, 0),
                entry(2, 45, 95, 0),
                entry(3, 62, 96, 0)), now);

        assertThat(pair).contains(new SkillMatchmaker.Pair(0, 2));
    }

    @Test
    @DisplayName("Widens tolerance as the oldest player waits")
    void widensToleranceOverTime() {
        var entries = List.of(
                entry(1, 70, 95, now - 10_000),
                entry(2, 95, 95, now - 10_000));

        assertThat(matchmaker.selectPair(entries, now)).contains(new SkillMatchmaker.Pair(0, 1));
        assertThat(SkillMatchmaker.toleranceFor(10_000)).isEqualTo(25);
    }

    @Test
    @DisplayName("Does not pair a large skill gap before the fallback deadline")
    void waitsForFallbackWhenGapIsLarge() {
        var entries = List.of(
                entry(1, 30, 80, now),
                entry(2, 150, 99, now));

        assertThat(matchmaker.selectPair(entries, now)).isEmpty();
    }

    @Test
    @DisplayName("Forces the oldest two together after 20 seconds")
    void forcesPairAfterFallback() {
        var entries = List.of(
                entry(1, 30, 80, now - SkillMatchmaker.FORCE_PAIR_AFTER_MS),
                entry(2, 150, 99, now));

        assertThat(matchmaker.selectPair(entries, now)).contains(new SkillMatchmaker.Pair(0, 1));
    }

    @Test
    @DisplayName("Needs at least two queued players")
    void needsTwoPlayers() {
        assertThat(matchmaker.selectPair(List.of(entry(1, 60, 95, 0)), now)).isEmpty();
        assertThat(matchmaker.selectPair(List.of(), now)).isEmpty();
    }

    private MatchmakingEntry entry(long userId, int wpm, int accuracy, long enqueuedAt) {
        return new MatchmakingEntry(userId, wpm, accuracy, enqueuedAt);
    }
}
