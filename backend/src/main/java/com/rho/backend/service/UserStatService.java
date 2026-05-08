package com.rho.backend.service;

import com.rho.backend.dto.userStat.response.UserStatResponseDTO;
import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.model.User;
import com.rho.backend.model.UserStat;
import com.rho.backend.repository.UserRepository;
import com.rho.backend.repository.UserStatRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class UserStatService {

    private final UserStatRepository userStatRepository;
    private final UserRepository userRepository;

    public UserStatService(UserStatRepository userStatRepository, UserRepository userRepository){
        this.userStatRepository = userStatRepository;
        this.userRepository = userRepository;
    }


    public void initializeUserStats(long userId){
        userRepository.findById(userId).orElseThrow(() -> new  ResourceNotFoundException("User not found"));

        UserStat userStat = UserStat.builder()
                .userId(userId)
                .bestSpeed(BigDecimal.valueOf(0))
                .averageSpeed(BigDecimal.valueOf(0))
                .textCompleted(0)
                .build();
        userStatRepository.save(userStat);
    }

    public UserStatResponseDTO getStat(long userId){
        UserStat userStat = userStatRepository.findByUserId(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return new UserStatResponseDTO(userStat);
    }


    @Transactional
    public void updateUserStats(long userId, BigDecimal newWpm){
        UserStat userStat = userStatRepository.findByUserId(userId).orElseThrow(() -> new ResourceNotFoundException("User Statistics not found"));
        int oldCount = userStat.getTextCompleted();
        int newCount = oldCount + 1;

        userStat.setLastSpeed(newWpm);

        if(newWpm.compareTo(userStat.getBestSpeed()) > 0){
            userStat.setBestSpeed(newWpm);
        }

        BigDecimal totalWpm = userStat.getAverageSpeed().multiply(BigDecimal.valueOf(oldCount)).add(newWpm);

        userStat.setAverageSpeed(totalWpm.divide(BigDecimal.valueOf(newCount), 2, RoundingMode.HALF_UP));
        userStat.setTextCompleted(newCount);

        userStatRepository.save(userStat);
    }


}
