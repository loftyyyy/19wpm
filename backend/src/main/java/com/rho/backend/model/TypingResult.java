package com.rho.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Table(name = "typing_results")
@Entity
public class TypingResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "typing_result_id")
    private Long typingResultId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "text_id", nullable = false)
    private Long textId;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    @Column(name = "duration_ms", nullable = false)
    private Integer durationMs;

    @Column(name = "time_constraint_ms")
    private Integer timeConstraintMs;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal wpm;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal accuracy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private LocalDateTime createdAt;

}
