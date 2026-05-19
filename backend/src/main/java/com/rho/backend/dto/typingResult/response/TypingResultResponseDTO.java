package com.rho.backend.dto.typingResult.response;


import com.rho.backend.model.TypingResult;
import com.rho.backend.model.User;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record TypingResultResponseDTO(
        long typingResultId,
        User user,
        long textId,
        LocalDateTime finishedAt,
        int durationMs,
        Integer timeConstraintMs,
        BigDecimal wpm,
        BigDecimal accuracy,
        LocalDateTime createdAt
) {
    public TypingResultResponseDTO(TypingResult typingResult){
        this(
                typingResult.getTypingResultId(),
                typingResult.getUser(),
                typingResult.getTextId(),
                typingResult.getFinishedAt(),
                typingResult.getDurationMs(),
                typingResult.getTimeConstraintMs(),
                typingResult.getWpm(),
                typingResult.getAccuracy(),
                typingResult.getCreatedAt()
        );
    }
}
