package com.rho.backend.model;


import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "race_results")
public class RaceResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long resultId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private RaceSession session;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private int finishRank;     // 1 = first to finish, 2 = second, etc.

    @Column(nullable = false)
    private int finalWpm;

    @Column(nullable = false)
    private int errorCount;

    @Column(nullable = false)
    private boolean finished;   // false = disconnected before finishing

}
