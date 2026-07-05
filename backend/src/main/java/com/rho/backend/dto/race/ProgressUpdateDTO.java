package com.rho.backend.dto.race;

public record ProgressUpdateDTO(
        double progressPercent,
        int currentWpm,
        String typedContent
) {}
