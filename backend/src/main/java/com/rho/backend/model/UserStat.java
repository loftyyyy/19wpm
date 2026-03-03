package com.rho.backend.model;

import jakarta.persistence.*;
import lombok.Generated;
import lombok.Getter;
import lombok.Setter;

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

    @Column(name = "average_speed", nullable = false, precision = 5, scale = 2)
    private Double averageSpeed;

    @Column(name = "best_speed", nullable = false, precision = 5, scale = 2)
    private Double bestSpeed;

    @Column(name = "last_speed", nullable = false, precision = 5, scale = 2)
    private Double lastSpeed;

    @Column(name = "text_completed", nullable = false)
    private Long textCompleted;

}
