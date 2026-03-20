package com.rho.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.Date;

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

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "text_id", nullable = false)
    private Long textId;

    @Column(name = "finished_at", nullable = false)
    private LocalDateTime finishedAt;

    @Column(name = "duration_ms", nullable = false)
    private Long durationMs;

    @Column(name = "time_constraint_ms", nullable = false)
    private Long timeConstraintMs;

    @Column(precision = 5, scale = 2)
    private Double wpm;

    @Column(precision = 5, scale = 2)
    private Double accuracy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

}
