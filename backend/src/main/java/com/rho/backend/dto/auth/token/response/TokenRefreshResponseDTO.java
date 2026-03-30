package com.rho.backend.dto.auth.token.response;

public record TokenRefreshResponseDTO(
        String accessToken,
        String tokenType
) {
}
