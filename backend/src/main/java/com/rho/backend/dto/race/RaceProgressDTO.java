package com.rho.backend.dto.race;

/**
 * Lightweight delta broadcast on every progress tick.
 *
 * <p>Replaces the previous behaviour of pushing the entire {@code RaceRoom} (all participants
 * + passage text) to every subscriber on every tick, which produced O(N^2) payload fan-out.
 */
public record RaceProgressDTO(
        Long userId,
        double progressPercent,
        int currentWpm,
        int errors
) {}
