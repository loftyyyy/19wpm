package com.rho.backend.matchmaking;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SkillMatchmakerTest {

    private final SkillMatchmaker matchmaker = new SkillMatchmaker();
    private final long now = 30_000L;

    @Test
    @DisplayName("Needs at least two queued players")
    void needsTwoPlayers() {
        assertThat(matchmaker.selectGroup(List.of(entry(1, 60, 95, now)), now)).isEmpty();
        assertThat(matchmaker.selectGroup(List.of(), now)).isEmpty();
    }

    @Test
    @DisplayName("Waits for the gather window before splitting a partial queue")
    void waitsForGatherWindowBeforeSplittingPartialQueue() {
        var justBeforeWindow = List.of(
                entry(1, 60, 95, now - SkillMatchmaker.PARTIAL_GROUP_GATHER_MS + 1),
                entry(2, 65, 95, now),
                entry(3, 70, 95, now),
                entry(4, 75, 95, now));

        assertThat(matchmaker.selectGroup(justBeforeWindow, now)).isEmpty();
    }

    @Test
    @DisplayName("Groups four friends who search together into one race")
    void groupsNearSimultaneousFriends() {
        var entries = List.of(
                entry(1, 45, 92, now - SkillMatchmaker.PARTIAL_GROUP_GATHER_MS),
                entry(2, 70, 96, now),
                entry(3, 105, 98, now),
                entry(4, 140, 94, now));

        assertThat(matchmaker.selectGroup(entries, now))
                .contains(new SkillMatchmaker.Group(List.of(0, 1, 2, 3)));
    }

    @Test
    @DisplayName("Groups a full queue immediately even when the skill spread is wide")
    void groupsFullQueueImmediately() {
        var entries = List.of(
                entry(1, 30, 80, now),
                entry(2, 90, 90, now),
                entry(3, 150, 95, now),
                entry(4, 210, 97, now),
                entry(5, 270, 99, now));

        assertThat(matchmaker.selectGroup(entries, now))
                .contains(new SkillMatchmaker.Group(List.of(0, 1, 2, 3, 4)));
    }

    @Test
    @DisplayName("Groups the five closest players when more than a full group is queued")
    void groupsClosestFiveFromLargerQueue() {
        var entries = List.of(
                entry(1, 60, 95, now),
                entry(2, 62, 95, now),
                entry(3, 65, 95, now),
                entry(4, 68, 95, now),
                entry(5, 70, 95, now),
                entry(6, 200, 95, now));

        assertThat(matchmaker.selectGroup(entries, now))
                .contains(new SkillMatchmaker.Group(List.of(0, 1, 2, 3, 4)));
    }

    @Test
    @DisplayName("Does not form an ineligible group from a larger queue before the fallback")
    void waitsForFallbackWhenLargerQueueHasNoCloseGroup() {
        var entries = List.of(
                entry(1, 30, 80, now - SkillMatchmaker.FORCE_GROUP_AFTER_MS + 1),
                entry(2, 120, 95, now),
                entry(3, 160, 95, now),
                entry(4, 200, 95, now),
                entry(5, 240, 95, now),
                entry(6, 280, 95, now));

        assertThat(matchmaker.selectGroup(entries, now)).isEmpty();
    }

    @Test
    @DisplayName("Forces the closest group from a larger queue after the fallback deadline")
    void forcesClosestGroupAfterFallback() {
        var entries = List.of(
                entry(1, 30, 80, now - SkillMatchmaker.FORCE_GROUP_AFTER_MS),
                entry(2, 120, 95, now),
                entry(3, 160, 95, now),
                entry(4, 200, 95, now),
                entry(5, 240, 95, now),
                entry(6, 280, 95, now));

        assertThat(matchmaker.selectGroup(entries, now))
                .contains(new SkillMatchmaker.Group(List.of(0, 1, 2, 3, 4)));
    }

    @Test
    @DisplayName("Honors an immediate-match request without waiting for the gather window")
    void honorsImmediateMatchRequest() {
        var entries = List.of(
                requested(1, 30, 80, now),
                entry(2, 100, 95, now),
                entry(3, 160, 97, now));

        assertThat(matchmaker.selectGroup(entries, now))
                .contains(new SkillMatchmaker.Group(List.of(0, 1, 2)));
    }

    @Test
    @DisplayName("Groups an immediate-match request with the closest racers in a larger queue")
    void immediateMatchUsesClosestRacersFromLargerQueue() {
        var entries = List.of(
                entry(1, 60, 95, now),
                entry(2, 80, 95, now),
                entry(3, 120, 95, now),
                requested(4, 100, 95, now),
                entry(5, 140, 95, now),
                entry(6, 200, 95, now),
                entry(7, 300, 95, now));

        var group = matchmaker.selectGroup(entries, now).orElseThrow();

        assertThat(group.indices()).hasSize(SkillMatchmaker.MAX_GROUP_SIZE);
        assertThat(group.indices()).containsExactlyInAnyOrder(3, 1, 2, 4, 0);
    }

    @Test
    @DisplayName("An immediate-match request cannot group a lone player")
    void immediateMatchNeedsAnotherPlayer() {
        assertThat(matchmaker.selectGroup(List.of(requested(1, 60, 95, now)), now)).isEmpty();
    }

    @Test
    @DisplayName("Widens the tolerance as players wait")
    void widensToleranceOverTime() {
        assertThat(SkillMatchmaker.toleranceFor(0)).isEqualTo(15);
        assertThat(SkillMatchmaker.toleranceFor(9_999)).isEqualTo(15);
        assertThat(SkillMatchmaker.toleranceFor(10_000)).isEqualTo(25);
        assertThat(SkillMatchmaker.toleranceFor(30_000)).isEqualTo(45);
        assertThat(SkillMatchmaker.toleranceFor(200_000)).isEqualTo(100);
    }

    private MatchmakingEntry entry(long userId, int wpm, int accuracy, long enqueuedAt) {
        return new MatchmakingEntry(userId, wpm, accuracy, enqueuedAt);
    }

    private MatchmakingEntry requested(long userId, int wpm, int accuracy, long enqueuedAt) {
        return new MatchmakingEntry(userId, wpm, accuracy, enqueuedAt, true);
    }
}
