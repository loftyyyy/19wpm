package com.rho.backend.dto.user.response;

import com.rho.backend.model.User;
import java.time.LocalDateTime;

public record UserResponseDTO (
    long userId,
    String username,
    String firstName,
    String lastName,
    String email,
    String country,
    String avatar,
    Integer streak,
    Boolean isActive,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    LocalDateTime deactivatedAt
    ){

    public UserResponseDTO(User user) {
        this(
                user.getUserId(),
                user.getUsername(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getCountry(),
                user.getAvatar(),
                user.getStreak(),
                user.getIsActive(),
                user.getCreatedAt(),
                user.getUpdatedAt(),
                user.getDeactivatedAt()
        );
    }
}
