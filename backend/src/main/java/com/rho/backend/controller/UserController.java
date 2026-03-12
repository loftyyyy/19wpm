package com.rho.backend.controller;

import com.rho.backend.dto.user.request.UserRegisterRequest;
import com.rho.backend.dto.user.response.UserResponseDTO;
import com.rho.backend.exception.user.UserException;
import com.rho.backend.model.User;
import com.rho.backend.repository.UserRepository;
import com.rho.backend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserRepository userRepository;
    private UserService userService;

    public UserController(UserService userService, UserRepository userRepository){
        this.userService = userService;
        this.userRepository = userRepository;
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponseDTO> me(Authentication authentication){
       User user = userRepository.findByUsername(authentication.getName()).orElseThrow(() -> new UserException("User not found!"));
       return ResponseEntity.ok(new UserResponseDTO(user));
    }

    @PostMapping("/signup")
    public ResponseEntity<?> createUser(@Valid @RequestBody UserRegisterRequest userRegisterRequest){
        userService.saveUser(userRegisterRequest);
        return ResponseEntity.ok("User registered successfully");
    }





}
