package com.rho.backend.dto.userStat.response;

import com.rho.backend.dto.user.request.UserResponseDTO;
import com.rho.backend.model.UserStat;

import java.math.BigDecimal;

public record UserStatResponseDTO(
        long userStatId,
        UserResponseDTO user,
        BigDecimal averageSpeed,
        BigDecimal bestSpeed,
        BigDecimal lastSpeed,
        int textCompleted
) {
    public UserStatResponseDTO(UserStat userStat){
        this(
                userStat.getUserStatsId(),
                UserResponseDTO.from(userStat.getUser()),
                userStat.getAverageSpeed(),
                userStat.getBestSpeed(),
                userStat.getLastSpeed(),
                userStat.getTextCompleted()
        );

    }

}
