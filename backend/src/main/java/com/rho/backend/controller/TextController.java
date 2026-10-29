package com.rho.backend.controller;

import com.rho.backend.config.CustomUserDetails;
import com.rho.backend.dto.text.request.TextRequestDTO;
import com.rho.backend.dto.text.request.TextUpdateRequestDTO;
import com.rho.backend.dto.text.response.TextResponseDTO;
import com.rho.backend.enums.TextDifficulty;
import com.rho.backend.enums.TextType;
import com.rho.backend.service.TextService;
import com.rho.backend.util.ServerTiming;
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

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/{textId}")
    public ResponseEntity<TextResponseDTO> getTextById(
            @PathVariable long textId,
            @AuthenticationPrincipal CustomUserDetails customUserDetails){
        long startNanos = System.nanoTime();
        TextResponseDTO text = textService.getTextById(textId, customUserDetails.getUserId());
        return ResponseEntity.ok()
                .header(ServerTiming.HEADER, ServerTiming.measure("text", startNanos))
                .body(text);
    }

    @GetMapping
    public ResponseEntity<List<TextResponseDTO>> getTexts(
            @RequestParam String language,
            @RequestParam(required = false) TextType textType,
            @RequestParam int count)
    {
        long startNanos = System.nanoTime();
        // A missing textType is the "all" selection: sample a balanced mix across every type
        // instead of failing the required-parameter binding.
        List<TextResponseDTO> texts = textType == null
                ? textService.getRandomTexts(language, count)
                : textService.getRandomTexts(language, textType, count);
        return ResponseEntity.ok()
                .header(ServerTiming.HEADER, ServerTiming.measure("texts", startNanos))
                .body(texts);
    }



    @GetMapping("/preset-texts")
    public ResponseEntity<List<TextResponseDTO>> getPresetTexts(){
        return ResponseEntity.ok(textService.getPresetTexts());
    }

    @PreAuthorize("isAuthenticated()")
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
        long startNanos = System.nanoTime();
        TextResponseDTO text = type == null
                ? textService.getRandomText()
                : textService.getRandomTextByType(type);
        return ResponseEntity.ok()
                .header(ServerTiming.HEADER, ServerTiming.measure("text", startNanos))
                .body(text);
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

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/custom-text")
    public ResponseEntity<TextResponseDTO> createCustomText(
            @Valid @RequestBody TextRequestDTO textRequestDTO,
            @AuthenticationPrincipal CustomUserDetails customUserDetails){
        return ResponseEntity.status(HttpStatus.CREATED).body(textService.saveCustomText(textRequestDTO, customUserDetails.getUserId()));
    }

    @PreAuthorize("isAuthenticated()")
    @PutMapping("/{textId}")
    public ResponseEntity<TextResponseDTO> modifyText(
            @Valid @RequestBody TextUpdateRequestDTO textUpdateRequestDTO,
            @AuthenticationPrincipal CustomUserDetails customUserDetails,
            @PathVariable long textId){
        return ResponseEntity.ok(textService.modifyText(textUpdateRequestDTO, customUserDetails.getUserId(), textId));
    }
}
