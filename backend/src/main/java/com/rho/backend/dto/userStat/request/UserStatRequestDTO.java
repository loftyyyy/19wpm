package com.rho.backend.dto.userStat.request;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record UserStatRequestDTO(
        @NotNull(message = "Average speed must not be empty")
        BigDecimal averageSpeed,

        @NotNull(message = "Best speed must not be empty")
        BigDecimal bestSpeed,

        @NotNull(message = "Last speed must not be empty")
        BigDecimal lastSpeed
) {}
