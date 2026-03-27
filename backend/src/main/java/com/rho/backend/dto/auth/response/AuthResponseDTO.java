package com.rho.backend.dto.auth.response;


import com.rho.backend.dto.user.request.UserDTO;

public record AuthResponseDTO(
        String tokenType,
        String accessToken,
        String refreshToken,
        UserDTO userDTO
){}
