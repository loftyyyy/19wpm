package com.rho.backend.service;

import com.rho.backend.dto.typingResult.request.TypingResultRequestDTO;
import com.rho.backend.dto.typingResult.response.TypingResultResponseDTO;
import com.rho.backend.exception.user.DuplicateResourceException;
import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.model.TypingResult;
import com.rho.backend.model.User;
import com.rho.backend.repository.TextRepository;
import com.rho.backend.repository.TypingResultRepository;
import com.rho.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TypingResultService {
    private final TypingResultRepository typingResultRepository;
    private final UserRepository userRepository;
    private final UserStatService userStatService;
    private final TextRepository textRepository;

    public TypingResultService(TypingResultRepository typingResultRepository, UserRepository userRepository, UserStatService userStatService, TextRepository textRepository){
        this.typingResultRepository = typingResultRepository;
        this.userRepository = userRepository;
        this.userStatService = userStatService;
        this.textRepository = textRepository;
    }

    @Transactional
    public TypingResultResponseDTO saveTypingResult(TypingResultRequestDTO typingResultRequestDTO, long userId){
        if(!textRepository.existsById(typingResultRequestDTO.textId())){
            throw new ResourceNotFoundException("Text doesn't exist");
        }

        User user = userRepository.findByIdWithRole(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (typingResultRepository.existsByUser_UserIdAndTextIdAndFinishedAtAndWpmAndAccuracy(
                userId,
                typingResultRequestDTO.textId(),
                typingResultRequestDTO.finishedAt(),
                typingResultRequestDTO.wpm(),
                typingResultRequestDTO.accuracy()
        )) {
            throw new DuplicateResourceException("Result already exists");
        }

        TypingResult typingResult = TypingResult.builder()
                .user(user)
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

    public List<TypingResultResponseDTO> getResultsByUser(long userId){
        return typingResultRepository.findByUserWithUser(userId)
                .stream()
                .map(TypingResultResponseDTO::new)
                .toList();
    }

}
