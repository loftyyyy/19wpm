package com.rho.backend.dto.auth.response;


import com.rho.backend.dto.user.request.UserResponseDTO;

public record AuthResponseDTO(
        String tokenType,
        String accessToken,
        String refreshToken,
        UserResponseDTO userResponseDTO
){}
