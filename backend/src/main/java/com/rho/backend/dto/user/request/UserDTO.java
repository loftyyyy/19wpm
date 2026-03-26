package com.rho.backend.dto.user.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UserDTO(

        @NotNull(message = "User id is missing")
        Long id,

        @NotBlank(message = "Email is required")
        @Email(message = "Email format is invalid")
        String email,

        @NotBlank(message = "Username is required")
        String username,

        @NotBlank(message = "Provider is required")
        String provider
)
{}
