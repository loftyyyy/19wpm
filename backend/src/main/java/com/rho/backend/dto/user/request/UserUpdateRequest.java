package com.rho.backend.dto.user.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserUpdateRequest {

    @NotBlank(message = "First name should not be blank")
    private String firstName;

    @NotBlank(message = "Last name should not be blank")
    private String lastName;

    @NotBlank(message = "Country is required")
    private String country;

    @NotBlank(message = "Current password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String currentPassword;



}
