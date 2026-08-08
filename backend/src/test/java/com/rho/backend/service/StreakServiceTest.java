package com.rho.backend.service;

import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.model.StreakState;
import com.rho.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class StreakServiceTest {

    private static final ZoneId UTC = ZoneId.of("UTC");

    private UserRepository userRepository;
    private StreakService streakService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        streakService = new StreakService(userRepository);
    }

    @DisplayName("First-ever activity starts the streak at 1")
    @Test
    void firstActivityEverIsStreakOne() {
        LocalDate today = LocalDate.now(UTC);
        when(userRepository.findStreakState(1L))
                .thenReturn(Optional.of(new StreakState(null, null, "UTC")));
        when(userRepository.updateStreakConditionally(1L, 1, today, null)).thenReturn(1);

        assertThat(streakService.recordActivity(1L)).isEqualTo(1);
        verify(userRepository).updateStreakConditionally(1L, 1, today, null);
    }

    @DisplayName("Same-day activity is a no-op that keeps the current streak")
    @Test
    void sameDayReturnsCurrentStreakWithoutUpdate() {
        LocalDate today = LocalDate.now(UTC);
        when(userRepository.findStreakState(1L))
                .thenReturn(Optional.of(new StreakState(7, today, "UTC")));

        assertThat(streakService.recordActivity(1L)).isEqualTo(7);
        verify(userRepository, never()).updateStreakConditionally(anyLong(), anyInt(), any(), any());
    }

    @DisplayName("Same-day activity with a null stored streak returns 1")
    @Test
    void sameDayWithNullStreakReturnsOne() {
        LocalDate today = LocalDate.now(UTC);
        when(userRepository.findStreakState(1L))
                .thenReturn(Optional.of(new StreakState(null, today, "UTC")));

        assertThat(streakService.recordActivity(1L)).isEqualTo(1);
        verify(userRepository, never()).updateStreakConditionally(anyLong(), anyInt(), any(), any());
    }

    @DisplayName("Concurrent first-play: the CAS loser re-reads the winner's streak and no-ops at 1")
    @Test
    void concurrentFirstPlayLoserNoOpsAfterLostCas() {
        LocalDate today = LocalDate.now(UTC);
        StreakState staleFirstPlay = new StreakState(null, null, "UTC");
        StreakState winnerCommitted = new StreakState(1, today, "UTC");
        when(userRepository.findStreakState(1L))
                .thenReturn(Optional.of(staleFirstPlay))
                .thenReturn(Optional.of(winnerCommitted));
        when(userRepository.updateStreakConditionally(1L, 1, today, null)).thenReturn(0);

        assertThat(streakService.recordActivity(1L)).isEqualTo(1);
        verify(userRepository).updateStreakConditionally(1L, 1, today, null);
        verify(userRepository, times(2)).findStreakState(1L);
    }

    @DisplayName("Consecutive-day activity increments the streak")
    @Test
    void consecutiveDayIncrements() {
        LocalDate today = LocalDate.now(UTC);
        LocalDate yesterday = today.minusDays(1);
        when(userRepository.findStreakState(1L))
                .thenReturn(Optional.of(new StreakState(5, yesterday, "UTC")));
        when(userRepository.updateStreakConditionally(1L, 6, today, yesterday)).thenReturn(1);

        assertThat(streakService.recordActivity(1L)).isEqualTo(6);
        verify(userRepository).updateStreakConditionally(1L, 6, today, yesterday);
    }

    @DisplayName("A gap in days resets the streak to 1")
    @Test
    void gapResetsToOne() {
        LocalDate today = LocalDate.now(UTC);
        LocalDate twoDaysAgo = today.minusDays(2);
        when(userRepository.findStreakState(1L))
                .thenReturn(Optional.of(new StreakState(12, twoDaysAgo, "UTC")));
        when(userRepository.updateStreakConditionally(1L, 1, today, twoDaysAgo)).thenReturn(1);

        assertThat(streakService.recordActivity(1L)).isEqualTo(1);
        verify(userRepository).updateStreakConditionally(1L, 1, today, twoDaysAgo);
    }

    @DisplayName("Lost CAS race re-reads state and returns the concurrent value")
    @Test
    void staleCasReadRetriesAndAdoptsConcurrentValue() {
        LocalDate today = LocalDate.now(UTC);
        LocalDate yesterday = today.minusDays(1);
        StreakState stale = new StreakState(2, yesterday, "UTC");
        StreakState concurrent = new StreakState(3, today, "UTC");
        when(userRepository.findStreakState(1L)).thenReturn(Optional.of(stale), Optional.of(concurrent));
        when(userRepository.updateStreakConditionally(1L, 3, today, yesterday)).thenReturn(0);

        assertThat(streakService.recordActivity(1L)).isEqualTo(3);
        verify(userRepository).updateStreakConditionally(1L, 3, today, yesterday);
        verify(userRepository, times(2)).findStreakState(1L);
    }

    @DisplayName("Exhausted CAS retries fall back to the current stored streak")
    @Test
    void casExhaustedFallsBackToCurrentStreak() {
        LocalDate today = LocalDate.now(UTC);
        LocalDate yesterday = today.minusDays(1);
        StreakState state = new StreakState(2, yesterday, "UTC");
        when(userRepository.findStreakState(1L)).thenReturn(Optional.of(state));
        when(userRepository.updateStreakConditionally(anyLong(), anyInt(), any(), any())).thenReturn(0);

        assertThat(streakService.recordActivity(1L)).isEqualTo(2);
        verify(userRepository, times(3)).updateStreakConditionally(anyLong(), anyInt(), any(), any());
        verify(userRepository, times(4)).findStreakState(1L);
    }

    @DisplayName("Exhausted CAS retries with a null stored streak fall back to 1")
    @Test
    void casExhaustedWithNullStreakFallsBackToOne() {
        LocalDate today = LocalDate.now(UTC);
        StreakState state = new StreakState(null, today.minusDays(1), "UTC");
        when(userRepository.findStreakState(1L)).thenReturn(Optional.of(state));
        when(userRepository.updateStreakConditionally(anyLong(), anyInt(), any(), any())).thenReturn(0);

        assertThat(streakService.recordActivity(1L)).isEqualTo(1);
        verify(userRepository, times(3)).updateStreakConditionally(anyLong(), anyInt(), any(), any());
    }

    @DisplayName("Today is computed in the user's timezone, not UTC")
    @Test
    void todayIsComputedInUserTimezone() {
        ZoneId kiritimati = ZoneId.of("Pacific/Kiritimati");
        LocalDate todayKiri = LocalDate.now(kiritimati);
        LocalDate yesterdayKiri = todayKiri.minusDays(1);
        when(userRepository.findStreakState(1L))
                .thenReturn(Optional.of(new StreakState(4, yesterdayKiri, "Pacific/Kiritimati")));
        when(userRepository.updateStreakConditionally(1L, 5, todayKiri, yesterdayKiri)).thenReturn(1);

        assertThat(streakService.recordActivity(1L)).isEqualTo(5);
        verify(userRepository).updateStreakConditionally(1L, 5, todayKiri, yesterdayKiri);
    }

    @DisplayName("Invalid timezone falls back to UTC")
    @Test
    void invalidTimezoneFallsBackToUtc() {
        LocalDate today = LocalDate.now(UTC);
        when(userRepository.findStreakState(1L))
                .thenReturn(Optional.of(new StreakState(3, today, "Not/AZone")));

        assertThat(streakService.recordActivity(1L)).isEqualTo(3);
        verify(userRepository, never()).updateStreakConditionally(anyLong(), anyInt(), any(), any());
    }

    @DisplayName("Blank timezone falls back to UTC")
    @Test
    void blankTimezoneFallsBackToUtc() {
        LocalDate today = LocalDate.now(UTC);
        when(userRepository.findStreakState(1L))
                .thenReturn(Optional.of(new StreakState(3, today, "   ")));

        assertThat(streakService.recordActivity(1L)).isEqualTo(3);
        verify(userRepository, never()).updateStreakConditionally(anyLong(), anyInt(), any(), any());
    }

    @DisplayName("Missing user throws ResourceNotFoundException")
    @Test
    void missingUserThrows() {
        when(userRepository.findStreakState(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> streakService.recordActivity(99L))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
