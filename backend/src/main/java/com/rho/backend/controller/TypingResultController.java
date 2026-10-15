package com.rho.backend.controller;

import com.rho.backend.config.CustomUserDetails;
import com.rho.backend.dto.common.PageResponseDTO;
import com.rho.backend.dto.typingResult.request.TypingResultRequestDTO;
import com.rho.backend.dto.typingResult.response.TypingResultResponseDTO;
import com.rho.backend.service.TypingResultService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/result")
public class TypingResultController {

    private final TypingResultService typingResultService;

    public TypingResultController(TypingResultService typingResultService){
        this.typingResultService = typingResultService;
    }

    @PostMapping
    public ResponseEntity<TypingResultResponseDTO> createTypingResult(@Valid @RequestBody TypingResultRequestDTO typingResultRequestDTO, @AuthenticationPrincipal CustomUserDetails customUserDetails){
        return ResponseEntity.status(HttpStatus.CREATED).body(typingResultService.saveTypingResult(typingResultRequestDTO, customUserDetails.getUserId()));
    }

    @GetMapping
    public ResponseEntity<PageResponseDTO<TypingResultResponseDTO>> getMyResults(
            @AuthenticationPrincipal CustomUserDetails customUserDetails,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable){
        return ResponseEntity.ok(typingResultService.getResultsByUser(customUserDetails.getUserId(), pageable));
    }

}
