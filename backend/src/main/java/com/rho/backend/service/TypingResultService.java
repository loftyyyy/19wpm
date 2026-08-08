package com.rho.backend.service;

import com.rho.backend.dto.typingResult.request.TypingResultRequestDTO;
import com.rho.backend.dto.typingResult.response.TypingResultResponseDTO;
import com.rho.backend.enums.Mode;
import com.rho.backend.exception.user.DuplicateResourceException;
import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.model.Text;
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
    private final StreakService streakService;

    public TypingResultService(TypingResultRepository typingResultRepository, UserRepository userRepository, UserStatService userStatService, TextRepository textRepository, StreakService streakService){
        this.typingResultRepository = typingResultRepository;
        this.userRepository = userRepository;
        this.userStatService = userStatService;
        this.textRepository = textRepository;
        this.streakService = streakService;
    }

    @Transactional
    public TypingResultResponseDTO saveTypingResult(TypingResultRequestDTO typingResultRequestDTO, long userId) {
        User user = userRepository.findByIdWithRole(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        boolean isWordsMode = typingResultRequestDTO.mode() == Mode.WORDS;

        Text text = isWordsMode ? null : textRepository.findByTextId(typingResultRequestDTO.textId())
                .orElseThrow(() -> new ResourceNotFoundException("Text doesn't exist"));

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
                .textId(isWordsMode ? null : text.getTextId())
                .finishedAt(typingResultRequestDTO.finishedAt())
                .durationMs(typingResultRequestDTO.durationMs())
                .timeConstraintMs(typingResultRequestDTO.timeConstraintMs())
                .wpm(typingResultRequestDTO.wpm())
                .accuracy(typingResultRequestDTO.accuracy())
                .textTitle(isWordsMode ? "Generated Words" : text.getTitle())
                .textContent(isWordsMode ? typingResultRequestDTO.textContent() : text.getContent())
                .mode(typingResultRequestDTO.mode())
                .build();

        typingResultRepository.save(typingResult);
        userStatService.updateUserStats(userId, typingResultRequestDTO.wpm());
        Integer streak = streakService.recordActivity(userId);
        return new TypingResultResponseDTO(typingResult, streak);
    }

    public List<TypingResultResponseDTO> getResultsByUser(long userId){
        return typingResultRepository.findByUserWithUser(userId)
                .stream()
                .map(TypingResultResponseDTO::new)
                .toList();
    }

}
