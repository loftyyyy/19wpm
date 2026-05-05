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

    public TypingResultService(TypingResultRepository typingResultRepository, UserRepository userRepository){
        this.typingResultRepository = typingResultRepository;
        this.userRepository = userRepository;
    }

    public TypingResultResponseDTO saveTypingResult(TypingResultRequestDTO typingResultRequestDTO, long userId){
        if(!typingResultRepository.existsById(typingResultRequestDTO.textId())){
            throw new ResourceNotFoundException("Text doesn't exist");
        }

        User user = userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));

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

        // TODO: I should think about how I should increment the textCompleted and its analytics(e.g best speed, average speed, and last speed) from the user stats


        return new TypingResultResponseDTO(typingResult);
    }


}
