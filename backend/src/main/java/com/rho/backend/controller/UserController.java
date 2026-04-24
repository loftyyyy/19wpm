package com.rho.backend.controller;

import com.rho.backend.config.CustomUserDetails;
import com.rho.backend.dto.user.request.UserDeactivateRequestDTO;
import com.rho.backend.dto.user.request.UserUpdateRequestDTO;
import com.rho.backend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private UserService userService;

    public UserController(UserService userService){
        this.userService = userService;
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> updateUser(@Valid @RequestBody UserUpdateRequestDTO userUpdateRequestDTO, @AuthenticationPrincipal CustomUserDetails customUserDetails){
        userService.modifyUser(userUpdateRequestDTO, customUserDetails.getUserId());
        return ResponseEntity.ok("User updated successfully");
    }

    @PutMapping("/deactivate")
    public ResponseEntity<?> removeUser(@Valid @RequestBody UserDeactivateRequestDTO userDeactivateRequestDTO, @AuthenticationPrincipal CustomUserDetails customUserDetails){
        userService.deactivateUser(userDeactivateRequestDTO, customUserDetails.getUserId());
        return ResponseEntity.noContent().build();
    }


}
