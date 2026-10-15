package com.rho.backend.service;

import com.rho.backend.dto.userStat.response.UserStatResponseDTO;
import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.model.User;
import com.rho.backend.model.UserStat;
import com.rho.backend.repository.UserRepository;
import com.rho.backend.repository.UserStatRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
public class UserStatService {

    private final UserStatRepository userStatRepository;
    private final UserRepository userRepository;

    public UserStatService(UserStatRepository userStatRepository, UserRepository userRepository){
        this.userStatRepository = userStatRepository;
        this.userRepository = userRepository;
    }


    public void initializeUserStats(long userId){
        User user = userRepository.findByIdWithRole(userId).orElseThrow(() -> new  ResourceNotFoundException("User not found"));

        UserStat userStat = UserStat.builder()
                .user(user)
                .bestSpeed(BigDecimal.valueOf(0))
                .averageSpeed(BigDecimal.valueOf(0))
                .textCompleted(0)
                .build();
        userStatRepository.save(userStat);
    }

    @Transactional(readOnly = true)
    public UserStatResponseDTO getStat(long userId){
        UserStat userStat = userStatRepository.findByUser_UserId(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return new UserStatResponseDTO(userStat);
    }


    @Transactional
    public void updateUserStats(long userId, BigDecimal newWpm){
        int updatedRows = userStatRepository.applyResult(userId, newWpm);
        if (updatedRows == 0) {
            throw new ResourceNotFoundException("User Statistics not found");
        }
    }


}
