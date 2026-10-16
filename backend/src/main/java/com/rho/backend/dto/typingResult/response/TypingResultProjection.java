package com.rho.backend.dto.typingResult.response;

import com.rho.backend.enums.Mode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Read-only projection for a user's typing-result history.
 *
 * <p>Carries only the columns the response needs plus {@code userId}/{@code username}, so the
 * paginated query never materializes a full {@code User} entity.
 */
public interface TypingResultProjection {
    Long getTypingResultId();
    Long getTextId();
    LocalDateTime getFinishedAt();
    Integer getDurationMs();
    Integer getTimeConstraintMs();
    BigDecimal getWpm();
    BigDecimal getAccuracy();
    LocalDateTime getCreatedAt();
    String getTextTitle();
    String getTextContent();
    Mode getMode();
    Long getUserId();
    String getUsername();
}
