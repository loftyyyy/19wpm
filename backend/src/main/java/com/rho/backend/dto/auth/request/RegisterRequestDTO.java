package com.rho.backend.dto.auth.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequestDTO(
        @NotBlank(message = "Username is required")
        String username,

        @NotBlank(message = "Email is required")
        @Email(message = "Invalid format")
        String email,

        @NotBlank(message = "Username is required")
        @Size(min = 8, message = "Password must be at least 8 characters")
        String password

){}