package com.rho.backend.controller;

import com.rho.backend.config.CustomUserDetails;
import com.rho.backend.dto.text.request.TextRequestDTO;
import com.rho.backend.dto.text.request.TextUpdateRequestDTO;
import com.rho.backend.dto.text.response.TextResponseDTO;
import com.rho.backend.enums.TextDifficulty;
import com.rho.backend.enums.TextType;
import com.rho.backend.service.TextService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/texts")
public class TextController {
    private final TextService textService;

    public TextController(TextService textService){
        this.textService = textService;
    }

    @GetMapping("/{textId}")
    public ResponseEntity<TextResponseDTO> getTextById(
            @PathVariable long textId,
            @AuthenticationPrincipal CustomUserDetails customUserDetails){
        return ResponseEntity.ok(textService.getTextById(textId, customUserDetails.getUserId()));
    }

    @GetMapping
    public ResponseEntity<List<TextResponseDTO>> getTexts(
            @RequestParam String language,
            @RequestParam TextType textType,
            @RequestParam int count)
    {
        return ResponseEntity.ok(textService.getRandomTexts(language, textType, count));
    }



    @GetMapping("/preset-texts")
    public ResponseEntity<List<TextResponseDTO>> getPresetTexts(){
        return ResponseEntity.ok(textService.getPresetTexts());
    }

    @GetMapping("/user-texts")
    public ResponseEntity<List<TextResponseDTO>> getUserTexts(
            @AuthenticationPrincipal CustomUserDetails customUserDetails){
        return ResponseEntity.ok(textService.getUserTexts(customUserDetails.getUserId()));
    }

    @GetMapping("/language")
    public ResponseEntity<List<TextResponseDTO>> getTextsByLanguage(
            @RequestParam String language){
        return ResponseEntity.ok(textService.getTextsByLanguage(language));
    }

    @GetMapping("/random")
    public ResponseEntity<TextResponseDTO> getRandomTextByType(
            @RequestParam(required = false) TextType type){
        if(type == null){
            return ResponseEntity.ok(textService.getRandomText());
        }
        return ResponseEntity.ok(textService.getRandomTextByType(type));
    }

    @GetMapping("/short")
    public ResponseEntity<List<TextResponseDTO>> getShortTexts(){
        return ResponseEntity.ok(textService.getShortTexts());
    }

    @GetMapping("/medium")
    public ResponseEntity<List<TextResponseDTO>> getMediumTexts(){
        return ResponseEntity.ok(textService.getMediumTexts());
    }

    @GetMapping("/long")
    public ResponseEntity<List<TextResponseDTO>> getLongTexts(){
        return ResponseEntity.ok(textService.getLongTexts());
    }

    @GetMapping("/thicc")
    public ResponseEntity<List<TextResponseDTO>> getThiccTexts(){
        return ResponseEntity.ok(textService.getThiccTexts());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/text")
    public ResponseEntity<TextResponseDTO> createText(
            @Valid @RequestBody TextRequestDTO textRequestDTO,
            @AuthenticationPrincipal CustomUserDetails customUserDetails){
        return ResponseEntity.status(HttpStatus.CREATED).body(textService.saveText(textRequestDTO, customUserDetails.getUserId()));
    }

    @PostMapping("/custom-text")
    public ResponseEntity<TextResponseDTO> createCustomText(
            @Valid @RequestBody TextRequestDTO textRequestDTO,
            @AuthenticationPrincipal CustomUserDetails customUserDetails){
        return ResponseEntity.status(HttpStatus.CREATED).body(textService.saveCustomText(textRequestDTO, customUserDetails.getUserId()));
    }

    @PutMapping("/{textId}")
    public ResponseEntity<TextResponseDTO> modifyText(
            @Valid @RequestBody TextUpdateRequestDTO textUpdateRequestDTO,
            @AuthenticationPrincipal CustomUserDetails customUserDetails,
            @PathVariable long textId){
        return ResponseEntity.ok(textService.modifyText(textUpdateRequestDTO, customUserDetails.getUserId(), textId));
    }
}
