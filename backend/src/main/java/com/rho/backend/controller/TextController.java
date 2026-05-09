package com.rho.backend.controller;

import com.rho.backend.config.CustomUserDetails;
import com.rho.backend.dto.text.request.TextRequestDTO;
import com.rho.backend.dto.text.request.TextUpdateRequestDTO;
import com.rho.backend.dto.text.response.TextResponseDTO;
import com.rho.backend.service.TextService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController("/api/v1/texts")
public class TextController {

    private final TextService textService;

    public TextController(TextService textService){
        this.textService = textService;
    }

    @GetMapping("/{textId}")
    public ResponseEntity<TextResponseDTO> getTextById(@PathVariable long textId, @AuthenticationPrincipal CustomUserDetails customUserDetails){
        return ResponseEntity.ok(textService.getTextById(textId, customUserDetails.getUserId()));
    }

    @GetMapping("/preset-texts")
    public ResponseEntity<List<TextResponseDTO>> getPresetTexts(){
        List<TextResponseDTO> presetTexts = textService.getPresetTexts();
        return ResponseEntity.ok(presetTexts);
    }

    @GetMapping("/user-texts")
    public ResponseEntity<List<TextResponseDTO>> getUserTexts(@AuthenticationPrincipal CustomUserDetails customUserDetails){
        List<TextResponseDTO> userTexts = textService.getUserTexts(customUserDetails.getUserId());
        return ResponseEntity.ok(userTexts);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/text")
    public ResponseEntity<TextResponseDTO> createText(@Valid @RequestBody TextRequestDTO textRequestDTO, @AuthenticationPrincipal CustomUserDetails customUserDetails){
        return ResponseEntity.ok(textService.saveText(textRequestDTO, customUserDetails.getUserId()));
    }

    @PostMapping("/custom-text")
    public ResponseEntity<TextResponseDTO> createCustomText(@Valid @RequestBody TextRequestDTO textRequestDTO, @AuthenticationPrincipal CustomUserDetails customUserDetails){
        return ResponseEntity.ok(textService.saveCustomText(textRequestDTO, customUserDetails.getUserId()));
    }

    @PostMapping("/{textId}")
    public ResponseEntity<TextResponseDTO> modifyText(@Valid @RequestBody TextUpdateRequestDTO textUpdateRequestDTO, @AuthenticationPrincipal CustomUserDetails customUserDetails, @PathVariable long textId){
        return ResponseEntity.ok(textService.modifyText(textUpdateRequestDTO, customUserDetails.getUserId(), textId));
    }


}
