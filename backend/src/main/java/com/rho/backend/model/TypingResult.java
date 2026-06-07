package com.rho.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "typing_results")
public class TypingResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "typing_result_id")
    private Long typingResultId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "text_id", nullable = false)
    private Long textId;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    @Column(name = "duration_ms", nullable = false)
    private Integer durationMs;

    @Column(name = "time_constraint_ms")
    private Integer timeConstraintMs;

    @Column(name = "text_title")
    private String textTitle;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal wpm;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal accuracy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private LocalDateTime createdAt;

}
