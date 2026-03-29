package com.rho.backend.controller;

import com.rho.backend.config.CustomUserDetails;
import com.rho.backend.dto.user.request.UserDeactivateRequest;
import com.rho.backend.dto.user.request.UserRegisterRequest;
import com.rho.backend.dto.user.request.UserUpdateRequest;
import com.rho.backend.dto.user.response.UserResponseDTO;
import com.rho.backend.exception.user.UserException;
import com.rho.backend.model.User;
import com.rho.backend.repository.UserRepository;
import com.rho.backend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private UserService userService;

    public UserController(UserService userService){
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponseDTO> me(@AuthenticationPrincipal CustomUserDetails customUserDetails){
        return ResponseEntity.ok(userService.getMe(customUserDetails.getUserId()));
    }

    @PostMapping("/signup")
    public ResponseEntity<?> createUser(@Valid @RequestBody UserRegisterRequest userRegisterRequest){
        userService.saveUser(userRegisterRequest);
        return ResponseEntity.ok("User registered successfully");
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
