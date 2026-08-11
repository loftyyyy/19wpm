package com.rho.backend.service;

import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.model.StreakState;
import com.rho.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;

@Service
public class StreakService {

    private static final int MAX_ATTEMPTS = 3;

    private final UserRepository userRepository;
    private final Clock clock;

    @Autowired
    public StreakService(UserRepository userRepository) {
        this(userRepository, Clock.systemDefaultZone());
    }

    public StreakService(UserRepository userRepository, Clock clock) {
        this.userRepository = userRepository;
        this.clock = clock;
    }

    @Transactional
    public Integer recordActivity(Long userId) {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            StreakState state = userRepository.findStreakState(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found"));

            LocalDate today = LocalDate.now(clock.withZone(zoneIdOf(state.timezone())));
            LocalDate lastPlayed = state.lastPlayedDate();
            int currentStreak = state.streak() == null ? 0 : state.streak();

            if (today.equals(lastPlayed)) {
                return Math.max(currentStreak, 1);
            }

            boolean consecutiveDay = lastPlayed != null && today.minusDays(1).equals(lastPlayed);
            int newStreak = consecutiveDay ? currentStreak + 1 : 1;

            int updatedRows = userRepository.updateStreakConditionally(userId, newStreak, today, lastPlayed);
            if (updatedRows == 1) {
                return newStreak;
            }
        }

        StreakState fallback = userRepository.findStreakState(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return fallback.streak() == null ? 1 : fallback.streak();
    }

    private ZoneId zoneIdOf(String timezone) {
        if (timezone == null || timezone.isBlank()) {
            return ZoneId.of("UTC");
        }
        try {
            return ZoneId.of(timezone);
        } catch (Exception e) {
            return ZoneId.of("UTC");
        }
    }
}
