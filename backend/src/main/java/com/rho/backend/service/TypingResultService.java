package com.rho.backend.service;

import com.rho.backend.dto.typingResult.request.TypingResultRequestDTO;
import com.rho.backend.dto.typingResult.response.TypingResultResponseDTO;
import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.model.TypingResult;
import com.rho.backend.repository.TypingResultRepository;
import org.springframework.stereotype.Service;

@Service
public class TypingResultService {
    private final TypingResultRepository typingResultRepository;

    public TypingResultService(TypingResultRepository typingResultRepository){
        this.typingResultRepository = typingResultRepository;
    }

    public TypingResultResponseDTO saveTypingResult(TypingResultRequestDTO typingResultRequestDTO, long userId){
        if(!typingResultRepository.existsById(typingResultRequestDTO.textId())){
            throw new ResourceNotFoundException("Text doesn't exist");
        }

        TypingResult typingResult = TypingResult.builder()
                .userId(userId)
                .textId(typingResultRequestDTO.textId())
                .finishedAt(typingResultRequestDTO.finishedAt())
                .durationMs(typingResultRequestDTO.durationMs())
                .timeConstraintMs(typingResultRequestDTO.timeConstraintMs())
                .wpm(typingResultRequestDTO.wpm())
                .accuracy(typingResultRequestDTO.accuracy())
                .build();

        return new TypingResultResponseDTO(typingResult);
    }


}
