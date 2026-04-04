package com.rho.backend.model;

import jakarta.persistence.*;
import lombok.Generated;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "user_stats")
public class UserStat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_stats_id", nullable = false)
    private Long userStatsId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "average_speed", precision = 5, scale = 2)
    private BigDecimal averageSpeed;

    @Column(name = "best_speed", precision = 5, scale = 2)
    private BigDecimal bestSpeed;

    @Column(name = "last_speed", precision = 5, scale = 2)
    private BigDecimal lastSpeed;

    @Column(name = "text_completed")
    private Integer textCompleted;

}
