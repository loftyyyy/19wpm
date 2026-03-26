package com.rho.backend.dto.user.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UserUpdateRequest (

    @NotBlank(message = "First name should not be blank")
    String firstName,

    @NotBlank(message = "Last name should not be blank")
    String lastName,

    @NotBlank(message = "Country is required")
    String country,

    @NotBlank(message = "Current password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    String currentPassword

){}
