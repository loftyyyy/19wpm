package com.rho.backend.dto.typingResult.response;

import com.rho.backend.enums.Mode;
import com.rho.backend.model.TypingResult;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.regex.Pattern;

public record TypingResultResponseDTO(
        long typingResultId,
        long userId,
        String username,
        Long textId,
        LocalDateTime finishedAt,
        int durationMs,
        Integer timeConstraintMs,
        BigDecimal wpm,
        BigDecimal accuracy,
        LocalDateTime createdAt,
        String textTitle,
        String textContent,
        Mode mode,
        int wordCount,
        Integer streak
) {
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private static int wordCount(String content) {
        if (content == null || content.isBlank()) {
            return 0;
        }
        return WHITESPACE.split(content.trim()).length;
    }

    public TypingResultResponseDTO(TypingResult typingResult){
        this(
                typingResult.getTypingResultId(),
                typingResult.getUser().getUserId(),
                typingResult.getUser().getUsername(),
                typingResult.getTextId(),
                typingResult.getFinishedAt(),
                typingResult.getDurationMs(),
                typingResult.getTimeConstraintMs(),
                typingResult.getWpm(),
                typingResult.getAccuracy(),
                typingResult.getCreatedAt(),
                typingResult.getTextTitle(),
                typingResult.getTextContent(),
                typingResult.getMode(),
                wordCount(typingResult.getTextContent()),
                null
        );
    }

    public TypingResultResponseDTO(TypingResult typingResult, Integer streak){
        this(
                typingResult.getTypingResultId(),
                typingResult.getUser().getUserId(),
                typingResult.getUser().getUsername(),
                typingResult.getTextId(),
                typingResult.getFinishedAt(),
                typingResult.getDurationMs(),
                typingResult.getTimeConstraintMs(),
                typingResult.getWpm(),
                typingResult.getAccuracy(),
                typingResult.getCreatedAt(),
                typingResult.getTextTitle(),
                typingResult.getTextContent(),
                typingResult.getMode(),
                wordCount(typingResult.getTextContent()),
                streak
        );
    }
}
