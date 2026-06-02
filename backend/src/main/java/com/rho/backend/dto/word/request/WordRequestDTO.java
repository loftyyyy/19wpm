package com.rho.backend.dto.word.request;

import com.rho.backend.enums.TextDifficulty;
import jakarta.persistence.Enumerated;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record WordRequestDTO(

        @NotBlank(message = "Word is required")
        @Size(max = 255, message = "Word must not exceed 255 characters")
        String word,

        @NotBlank(message = "Language is required")
        @Size(max = 50, message = "Language must not exceed 50 characters")
        String language,

        @NotNull(message = "Difficulty is required")
        TextDifficulty difficulty

) {}
