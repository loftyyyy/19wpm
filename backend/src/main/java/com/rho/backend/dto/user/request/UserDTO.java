package com.rho.backend.dto.user.request;

public record UserDTO(Long id, String email, String username, String provider) {
}
