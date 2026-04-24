package com.rho.backend.dto.text.request;

import jakarta.validation.constraints.Size;

public record TextUpdateRequestDTO(

        @Size(max = 100, message = "Title must not exceed 100 characters")
        String title,

        @Size(max = 100, message = "Author must not exceed 100 characters")
        String author,

        @Size(max = 100, message = "Source must not exceed 100 characters")
        String source,

        @Size(max = 50, message = "Language must not exceed 50 characters")
        String language,

        String content

) {}
