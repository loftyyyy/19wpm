package com.rho.backend.controller;

import com.rho.backend.config.CustomUserDetails;
import com.rho.backend.dto.word.request.WordRequestDTO;
import com.rho.backend.dto.word.response.WordResponseDTO;
import com.rho.backend.enums.TextDifficulty;
import com.rho.backend.service.WordService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/words")
public class WordController {
    private final WordService wordService;

    public WordController(WordService wordService){
        this.wordService = wordService;
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<WordResponseDTO> saveWord(@Valid @RequestBody WordRequestDTO wordRequestDTO, @AuthenticationPrincipal CustomUserDetails userDetails){
        return ResponseEntity.status(HttpStatus.CREATED).body(wordService.saveWord(wordRequestDTO, userDetails.getUserId()));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/bulk")
    public ResponseEntity<?> saveWords(@Valid @RequestBody List<WordRequestDTO> wordRequestDTOS, @AuthenticationPrincipal CustomUserDetails userDetails){
        wordService.saveWords(wordRequestDTOS, userDetails.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @GetMapping
    public ResponseEntity<List<WordResponseDTO>> getRandomWords(
            @RequestParam String language,
            @RequestParam TextDifficulty difficulty,
            @RequestParam int count){
        return ResponseEntity.ok(wordService.getRandomWords(language, difficulty, count));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{wordId}")
    public ResponseEntity<?> deleteWord(@PathVariable Long wordId, @AuthenticationPrincipal CustomUserDetails userDetails){
        wordService.deleteWord(wordId, userDetails.getUserId());
        return ResponseEntity.noContent().build();
    }
}
