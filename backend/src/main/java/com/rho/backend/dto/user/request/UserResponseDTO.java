package com.rho.backend.dto.user.request;

import com.rho.backend.model.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UserResponseDTO(

        @NotNull(message = "User id is missing")
        Long id,

        @NotBlank(message = "Email is required")
        @Email(message = "Email format is invalid")
        String email,

        @NotBlank(message = "Username is required")
        String username,

        @NotBlank(message = "Provider is required")
        String provider,

        Integer streak,

        String timezone
)
{

        public static UserResponseDTO from(User user){
                return new UserResponseDTO(
                        user.getUserId(),
                        user.getEmail(),
                        user.getUsername(),
                        user.getProvider().toString(),
                        user.getStreak(),
                        user.getTimezone()
                );

        }
}
