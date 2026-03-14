package com.rho.backend.dto.user.response;

import com.rho.backend.model.User;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@NoArgsConstructor
@Getter
public class UserResponseDTO {
    private long userId;
    private String username;
    private String firstName;
    private String lastName;
    private String email;
    private String country;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deactivatedAt;

    public UserResponseDTO(User user){
        this.userId = user.getUserId();
        this.username = user.getUsername();
        this.firstName = user.getFirstName();
        this.lastName = user.getLastName();
        this.email = user.getEmail();
        this.country = user.getCountry();
        this.isActive = user.getIsActive();
        this.createdAt = user.getCreatedAt();
        this.updatedAt = user.getUpdatedAt();
        this.deactivatedAt = user.getDeactivatedAt();
    }

}
