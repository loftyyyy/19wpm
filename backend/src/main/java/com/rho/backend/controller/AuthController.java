package com.rho.backend.controller;

import com.rho.backend.config.CustomUserDetails;
import com.rho.backend.dto.auth.request.AuthRequestDTO;
import com.rho.backend.dto.auth.request.LogoutRequestDTO;
import com.rho.backend.dto.auth.request.RegisterRequestDTO;
import com.rho.backend.dto.auth.response.AuthResponseDTO;
import com.rho.backend.dto.auth.token.request.TokenRefreshRequestDTO;
import com.rho.backend.dto.user.response.UserResponseDTO;
import com.rho.backend.service.AuthService;
import com.rho.backend.service.RateLimitingService;
import com.rho.backend.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final UserService userService;
    private final AuthService authService;
    private final RateLimitingService rateLimitingService;


    public AuthController(UserService userService, AuthService authService, RateLimitingService rateLimitingService){
        this.userService = userService;
        this.authService = authService;
        this.rateLimitingService = rateLimitingService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthRequestDTO authRequestDTO, HttpServletRequest request){
        String clientIp = rateLimitingService.extractClientIp(request);

        if(!rateLimitingService.isLoginAllowed(clientIp)){
            long remaining = rateLimitingService.getRemainingLoginAttempts(clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).header("X-RateLimit-Remaining", String.valueOf(remaining)).body("Too many login attempts. Please try again later.");
        }

        return ResponseEntity.ok(authService.login(authRequestDTO));

    }

    @PostMapping("/signup")
    public ResponseEntity<AuthResponseDTO> signup(@Valid @RequestBody RegisterRequestDTO registerRequestDTO){
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(registerRequestDTO));
    }

    // POST /api/auth/logout
    // Invalidates the access token immediately and revokes the refresh token.
    // Body: { "refreshToken": "..." }
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody LogoutRequestDTO request
    ) {
        authService.logout(authHeader, request.refreshToken());
        return ResponseEntity.noContent().build(); // 204
    }

    // POST /api/auth/logout-all
    // Revokes all sessions for the authenticated user across all devices.
    @PostMapping("/logout-all")
    public ResponseEntity<Void> logoutAll(
            @RequestHeader("Authorization") String authHeader
    ) {
        authService.logoutAll(authHeader);
        return ResponseEntity.noContent().build(); // 204
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponseDTO> me(@AuthenticationPrincipal CustomUserDetails customUserDetails){
        return ResponseEntity.ok(userService.getMe(customUserDetails.getUserId()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody TokenRefreshRequestDTO tokenRefreshRequestDTO, HttpServletRequest request){
        String clientIp = rateLimitingService.extractClientIp(request);

        if(!rateLimitingService.isRefreshAllowed(clientIp)){
            long remaining = rateLimitingService.getRemainingRefreshAttempts(clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).header("X-RateLimit-Remaining", String.valueOf(remaining)).body("Too many refresh attempts. Please try again later.");
        }

        return ResponseEntity.ok(authService.refresh(tokenRefreshRequestDTO.refreshToken()));
    }
}


