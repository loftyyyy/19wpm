package com.rho.backend.dto.typingResult.request;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record TypingResultRequestDTO(

        @Positive(message = "textId must be positive")
        long textId,

        @NotNull(message = "finishedAt is required")
        LocalDateTime finishedAt,

        @Positive(message = "durationMs must be positive")
        int durationMs,

        @Positive(message = "timeConstraintMs must be positive")
        Integer timeConstraintMs,

        @NotNull(message = "wpm is required")
        @Positive(message = "WPM must be positive")
        @DecimalMin(value = "0.0", inclusive = false, message = "wpm must be greater than 0")
        @Digits(integer = 3, fraction = 2, message = "wpm must have up to 3 integer digits and 2 decimal places")
        BigDecimal wpm,

        @NotNull(message = "accuracy is required")
        @DecimalMin(value = "0.0", message = "accuracy cannot be negative")
        @DecimalMax(value = "100.0", message = "accuracy cannot exceed 100")
        @Digits(integer = 3, fraction = 2, message = "accuracy must have up to 3 integer digits and 2 decimal places")
        BigDecimal accuracy

) {}
