package com.rho.backend.dto.telemetry;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record WebVitalsRequestDTO(
        @NotBlank @Size(max = 32) String name,
        @PositiveOrZero double value,
        @NotBlank @Size(max = 32) String rating,
        @Size(max = 32) String navigationType,
        @NotBlank @Size(max = 128) String path
) {
}
