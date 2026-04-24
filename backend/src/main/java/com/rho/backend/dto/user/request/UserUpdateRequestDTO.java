package com.rho.backend.dto.user.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserUpdateRequestDTO {

    String firstName;
    String lastName;
    String country;

    @NotBlank(message = "Current password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    String currentPassword;

}
