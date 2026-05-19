package com.rho.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "user_stats")
public class UserStat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_stats_id", nullable = false)
    private Long userStatsId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "average_speed", precision = 5, scale = 2)
    private BigDecimal averageSpeed;

    @Column(name = "best_speed", precision = 5, scale = 2)
    private BigDecimal bestSpeed;

    @Column(name = "last_speed", precision = 5, scale = 2)
    private BigDecimal lastSpeed;

    @Column(name = "text_completed")
    private Integer textCompleted;

}
