package com.rho.backend.dto.user.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserDeactivateRequest {

    @NotBlank(message = "Confirmation password is required")
    @Size(min = 8, message = "Confirmation password is at least 8 characters")
    private String currentPassword;

}
