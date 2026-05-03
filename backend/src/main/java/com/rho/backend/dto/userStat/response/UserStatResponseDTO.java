package com.rho.backend.dto.userStat.response;

import com.rho.backend.model.UserStat;

import java.math.BigDecimal;

public record UserStatResponseDTO(
        long userStatId,
        long userId,
        BigDecimal averageSpeed,
        BigDecimal bestSpeed,
        BigDecimal lastSpeed,
        int textCompleted
) {
    public UserStatResponseDTO(UserStat userStat){
        this(
                userStat.getUserStatsId(),
                userStat.getUserId(),
                userStat.getAverageSpeed(),
                userStat.getBestSpeed(),
                userStat.getLastSpeed(),
                userStat.getTextCompleted()
        );

    }

}
