package com.rho.backend.dto.auth.request;

public record LogoutRequestDTO(
        String refreshToken
) {
}
