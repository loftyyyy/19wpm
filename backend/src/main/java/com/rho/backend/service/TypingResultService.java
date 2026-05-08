package com.rho.backend.service;

import com.rho.backend.dto.typingResult.request.TypingResultRequestDTO;
import com.rho.backend.dto.typingResult.response.TypingResultResponseDTO;
import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.model.TypingResult;
import com.rho.backend.model.User;
import com.rho.backend.repository.TypingResultRepository;
import com.rho.backend.repository.UserRepository;
import com.rho.backend.repository.UserStatRepository;
import org.springframework.stereotype.Service;

@Service
public class TypingResultService {
    private final TypingResultRepository typingResultRepository;
    private final UserRepository userRepository;
    private final UserStatService userStatService;

    public TypingResultService(TypingResultRepository typingResultRepository, UserRepository userRepository, UserStatService userStatService){
        this.typingResultRepository = typingResultRepository;
        this.userRepository = userRepository;
        this.userStatService = userStatService;
    }

    public TypingResultResponseDTO saveTypingResult(TypingResultRequestDTO typingResultRequestDTO, long userId){
        if(!typingResultRepository.existsById(typingResultRequestDTO.textId())){
            throw new ResourceNotFoundException("Text doesn't exist");
        }

        userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));

        TypingResult typingResult = TypingResult.builder()
                .userId(userId)
                .textId(typingResultRequestDTO.textId())
                .finishedAt(typingResultRequestDTO.finishedAt())
                .durationMs(typingResultRequestDTO.durationMs())
                .timeConstraintMs(typingResultRequestDTO.timeConstraintMs())
                .wpm(typingResultRequestDTO.wpm())
                .accuracy(typingResultRequestDTO.accuracy())
                .build();

        typingResultRepository.save(typingResult);
        userStatService.updateUserStats(userId, typingResultRequestDTO.wpm());

        return new TypingResultResponseDTO(typingResult);
    }

}
