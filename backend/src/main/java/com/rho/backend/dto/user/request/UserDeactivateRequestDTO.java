package com.rho.backend.dto.user.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UserDeactivateRequestDTO(
    @NotBlank(message = "Confirmation password is required")
    @Size(min = 8, message = "Confirmation password is at least 8 characters")
    String currentPassword
){}

