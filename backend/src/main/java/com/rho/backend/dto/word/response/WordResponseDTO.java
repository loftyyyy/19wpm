package com.rho.backend.dto.word.response;

import com.rho.backend.enums.TextDifficulty;
import com.rho.backend.model.Word;

public record WordResponseDTO(
        long wordId,
        String word,
        String language,
        TextDifficulty difficulty


) {
    public WordResponseDTO(Word word){
        this(
                word.getWordId(),
                word.getWord(),
                word.getLanguage(),
                word.getDifficulty()
        );
    }
}
