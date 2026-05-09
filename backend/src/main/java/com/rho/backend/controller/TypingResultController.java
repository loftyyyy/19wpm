package com.rho.backend.controller;

import com.rho.backend.config.CustomUserDetails;
import com.rho.backend.dto.typingResult.request.TypingResultRequestDTO;
import com.rho.backend.dto.typingResult.response.TypingResultResponseDTO;
import com.rho.backend.service.TypingResultService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController("/api/v1/result")
public class TypingResultController {

    private final TypingResultService typingResultService;

    public TypingResultController(TypingResultService typingResultService){
        this.typingResultService = typingResultService;
    }

    @PostMapping
    public ResponseEntity<TypingResultResponseDTO> createTypingResult(@Valid @RequestBody TypingResultRequestDTO typingResultRequestDTO, @AuthenticationPrincipal CustomUserDetails customUserDetails){
        return ResponseEntity.ok(typingResultService.saveTypingResult(typingResultRequestDTO, customUserDetails.getUserId()));
    }


}
