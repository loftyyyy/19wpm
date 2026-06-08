package com.rho.backend.dto.typingResult.response;

import com.rho.backend.model.TypingResult;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record TypingResultResponseDTO(
        long typingResultId,
        long userId,
        String username,
        long textId,
        LocalDateTime finishedAt,
        int durationMs,
        Integer timeConstraintMs,
        BigDecimal wpm,
        BigDecimal accuracy,
        LocalDateTime createdAt,
        String textTitle,
        String textContent,
        int wordCount
) {
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
                typingResult.getTextContent() != null ? typingResult.getTextContent().split("\\s+").length : 0
        );
    }
}
