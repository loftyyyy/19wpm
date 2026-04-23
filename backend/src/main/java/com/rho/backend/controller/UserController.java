package com.rho.backend.controller;

import com.rho.backend.config.CustomUserDetails;
import com.rho.backend.dto.user.request.UserDeactivateRequest;
import com.rho.backend.dto.auth.request.RegisterRequestDTO;
import com.rho.backend.dto.user.request.UserUpdateRequest;
import com.rho.backend.dto.user.response.UserResponseDTO;
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
    public ResponseEntity<?> updateUser(@Valid @RequestBody UserUpdateRequest userUpdateRequest, @PathVariable Long id){
        userService.modifyUser(userUpdateRequest, id);
        return ResponseEntity.ok("User updated successfully");
    }

    @PutMapping("/deactivate")
    public ResponseEntity<?> removeUser(@Valid @RequestBody UserDeactivateRequest userDeactivateRequest, @AuthenticationPrincipal CustomUserDetails customUserDetails){
        userService.deactivateUser(userDeactivateRequest, customUserDetails.getUserId());
        return ResponseEntity.noContent().build();
    }



}
