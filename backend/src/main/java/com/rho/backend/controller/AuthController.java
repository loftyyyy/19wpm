package com.rho.backend.controller;

import com.rho.backend.dto.auth.request.AuthRequestDTO;
import com.rho.backend.dto.auth.request.RegisterRequestDTO;
import com.rho.backend.dto.auth.response.AuthResponseDTO;
import com.rho.backend.service.AuthService;
import com.rho.backend.service.RateLimitingService;
import com.rho.backend.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private final UserService userService;
    private final AuthService authService;
    private final RateLimitingService rateLimitingService;


    public AuthController(UserService userService, AuthService authService, RateLimitingService rateLimitingService){
        this.userService = userService;
        this.authService = authService;
        this.rateLimitingService = rateLimitingService;
    }

    @RequestMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthRequestDTO authRequestDTO, HttpServletRequest request){
        String clientIp = rateLimitingService.extractClientIp(request);

        if(!rateLimitingService.isLoginAllowed(clientIp)){
            long remaining = rateLimitingService.getRemainingLoginAttempts(clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).header("X-RateLimit-Remaining", String.valueOf(remaining)).body("Too many login attempts. Please try again later.");
        }

        return ResponseEntity.ok(authService.login(authRequestDTO));

    }

    @RequestMapping("/signup")
    public ResponseEntity<AuthResponseDTO> signup(@Valid @RequestBody RegisterRequestDTO registerRequestDTO){
        return ResponseEntity.ok(authService.saveUser(registerRequestDTO));
    }

//    @RequestMapping("/logout")
//    public ResponseEntity<?> logout(){
//
//    }

}


