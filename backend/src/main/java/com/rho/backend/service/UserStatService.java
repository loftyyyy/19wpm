package com.rho.backend.service;

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
        User user = userRepository.findById(userId).orElseThrow(() -> new  ResourceNotFoundException("User not found"));

        UserStat userStat = UserStat.builder()
                .userId(userId)
                .bestSpeed(BigDecimal.valueOf(0))
                .averageSpeed(BigDecimal.valueOf(0))
                .textCompleted(0)
                .build();
        userStatRepository.save(userStat);
    }

    @Transactional
    public void updateUserStats(long userId, int newWpm){
        UserStat userStat = userStatRepository.findByUserId(userId).orElseThrow(() -> new ResourceNotFoundException("User Statistics not found"));
        int oldCount = userStat.getTextCompleted();
        int newCount = oldCount + 1;

        userStat.setLastSpeed(BigDecimal.valueOf(newWpm));

        if(BigDecimal.valueOf(newWpm).compareTo(userStat.getBestSpeed()) > 0){
            userStat.setBestSpeed(BigDecimal.valueOf(newWpm));
        }

        BigDecimal totalWpm = userStat.getAverageSpeed().multiply(BigDecimal.valueOf(oldCount)).add(BigDecimal.valueOf(newWpm));

        userStat.setAverageSpeed(totalWpm.divide(BigDecimal.valueOf(newCount), 2, RoundingMode.HALF_UP));
        userStat.setTextCompleted(newCount);

        userStatRepository.save(userStat);
    }


}
