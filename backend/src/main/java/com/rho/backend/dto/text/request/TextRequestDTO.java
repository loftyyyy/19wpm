package com.rho.backend.dto.text.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TextRequestDTO(

        @NotBlank(message = "Title is required")
        @Size(max = 100, message = "Title must not exceed 100 characters")
        String title,

        @NotBlank(message = "Author is required")
        @Size(max = 100, message = "Author must not exceed 100 characters")
        String author,

        @NotBlank(message = "Source is required")
        @Size(max = 100, message = "Source must not exceed 100 characters")
        String source,

        @Size(max = 50, message = "Language must not exceed 50 characters")
        String language,

        @NotBlank(message = "Content is required")
        String content

) {}
