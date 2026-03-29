package com.rho.backend.controller;

import com.rho.backend.dto.auth.request.AuthRequestDTO;
import com.rho.backend.dto.auth.request.RegisterRequestDTO;
import com.rho.backend.dto.auth.response.AuthResponseDTO;
import com.rho.backend.service.AuthService;
import com.rho.backend.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private final UserService userService;
    private final AuthService authService;


    public AuthController(UserService userService, AuthService authService){
        this.userService = userService;
        this.authService = authService;
    }

    @RequestMapping("/login")
    public ResponseEntity<AuthResponseDTO> login(@Valid @RequestBody AuthRequestDTO authRequestDTO, HttpServletRequest request){
        String clientIp =

    }

    @RequestMapping("/signup")
    public ResponseEntity<AuthResponseDTO> signup(@Valid @RequestBody RegisterRequestDTO registerRequestDTO){
        return ResponseEntity.ok(authService.saveUser(registerRequestDTO));
    }

    @RequestMapping("/logout")
    public ResponseEntity<?> logout(){

    }

}


