package com.rho.backend.controller;

import com.rho.backend.config.CustomUserDetails;
import com.rho.backend.dto.text.request.TextRequestDTO;
import com.rho.backend.dto.text.response.TextResponseDTO;
import com.rho.backend.service.TextService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController("/api/v1/texts")
public class TextController {

    private final TextService textService;

    public TextController(TextService textService){
        this.textService = textService;
    }

    @PostMapping("/custom-text")
    public ResponseEntity<TextResponseDTO> createCustomText(@Valid @RequestBody TextRequestDTO textRequestDTO, @AuthenticationPrincipal CustomUserDetails customUserDetails){
        return ResponseEntity.ok(textService.saveCustomText(textRequestDTO, customUserDetails.getUserId()));
    }

    @PostMapping("text")
    public ResponseEntity<TextResponseDTO> createText(@Valid @RequestBody TextRequestDTO textRequestDTO, @AuthenticationPrincipal CustomUserDetails customUserDetails){
        return ResponseEntity.ok(textService.saveText(textRequestDTO, customUserDetails.getUserId()));
    }


}
