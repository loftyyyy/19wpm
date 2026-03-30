package com.rho.backend.dto.auth.token.request;

public record TokenRefreshRequestDTO(
        String refreshToken
) {
}
