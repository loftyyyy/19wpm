package com.rho.backend.dto.text.response;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.rho.backend.model.Text;

import java.time.LocalDateTime;

public record TextResponseDTO(
        @JsonCreator
        long textId,
        boolean isCustom,
        Long createdBy,
        String title,
        String author,
        String source,
        String language,
        String content,
        int wordCount,
        int charLength,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {

    public TextResponseDTO(Text text){
        this(
                text.getTextId(),
                text.isCustom(),
                text.getCreatedBy(),
                text.getTitle(),
                text.getAuthor(),
                text.getSource(),
                text.getLanguage(),
                text.getContent(),
                text.getWordCount(),
                text.getCharLength(),
                text.getCreatedAt(),
                text.getUpdatedAt()
        );
    }
}
