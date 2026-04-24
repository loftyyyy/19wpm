package com.rho.backend.service;


import com.rho.backend.dto.auth.request.AuthRequestDTO;
import com.rho.backend.dto.auth.request.RegisterRequestDTO;
import com.rho.backend.dto.auth.response.AuthResponseDTO;
import com.rho.backend.dto.user.request.UserResponseDTO;
import com.rho.backend.enums.AuthProvider;
import com.rho.backend.exception.user.DuplicateResourceException;
import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.model.User;
import com.rho.backend.redis.RedisTokenStore;
import com.rho.backend.repository.RoleRepository;
import com.rho.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Date;

@Service
public class AuthService {

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RedisTokenStore redisTokenStore;
    private final AuthenticationManager authenticationManager;
    private final RoleRepository roleRepository;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService, RedisTokenStore redisTokenStore, AuthenticationManager authenticationManager, RoleRepository roleRepository){
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.redisTokenStore = redisTokenStore;
        this.authenticationManager = authenticationManager;
        this.roleRepository = roleRepository;
    }

    // ── Register ──────────────────────────────────────────────────────────────

    public AuthResponseDTO register(RegisterRequestDTO request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new DuplicateResourceException("Email already registered.");
        }
        User user = User.builder()
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .username(request.username())
                .provider(AuthProvider.LOCAL)
                .role(roleRepository.getRoleByName("USER"))
                .isActive(Boolean.TRUE)
                .build();

        userRepository.save(user);
        logger.info("New user registered: {}", user.getEmail());
        return issueTokenPair(user);
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    public AuthResponseDTO login(AuthRequestDTO request) {
        // Throws AuthenticationException → 401 if credentials are wrong
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new ResourceNotFoundException("User not found."));

        logger.info("User logged in: {}", user.getEmail());
        return issueTokenPair(user);
    }

    // ── Refresh (with rotation) ───────────────────────────────────────────────

    /**
     * Validates the refresh token against Redis (not just the JWT signature),
     * then rotates it: issues a new access + refresh token pair, revokes the old
     * refresh token.
     *
     * If an attacker uses a stolen refresh token first, the legitimate user's
     * next refresh attempt will fail — their old token has been rotated away.
     */
    public AuthResponseDTO refresh(String refreshToken) {
        // 1. Verify JWT structure and signature
        final String email;
        try {
            email = jwtService.extractSubject(refreshToken);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid refresh token.");
        }

        if (!jwtService.isRefreshTokenValid(refreshToken, email)) {
            throw new IllegalArgumentException("Refresh token is expired or malformed.");
        }

        // 2. Load user
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found."));

        // 3. Verify token exists in Redis — rejects revoked tokens even if JWT is valid
        if (!redisTokenStore.isRefreshTokenValid(user.getUserId(), refreshToken)) {
            // Token was already used or explicitly revoked — possible theft
            logger.warn("Refresh token not found in store for userId={}. Possible token theft — revoking all.", user.getUserId());
            redisTokenStore.revokeAllRefreshTokens(user.getUserId());
            throw new IllegalArgumentException("Refresh token is invalid or has already been used.");
        }

        // 4. Generate new token pair
        String newAccessToken   = jwtService.generateAccessToken(user);
        String newRefreshToken  = jwtService.generateRefreshToken(user);
        Date   newRefreshExpiry = jwtService.extractExpiration(newRefreshToken);

        // 5. Rotate: delete old, store new — atomically from the client's perspective
        redisTokenStore.rotateRefreshToken(user.getUserId(), refreshToken, newRefreshToken, newRefreshExpiry);

        logger.info("Token pair rotated for userId={}", user.getUserId());
        return buildAuthResponse(newAccessToken, newRefreshToken, user);
    }

    // ── Logout (single device) ────────────────────────────────────────────────

    /**
     * Invalidates both tokens immediately:
     *  - Access token → blocklisted in Redis until its natural expiry
     *  - Refresh token → deleted from Redis (cannot be used to get a new access token)
     */
    public void logout(String authHeader, String refreshToken) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Missing or malformed Authorization header.");
        }

        String accessToken = authHeader.substring(7);

        // Blocklist the access token for its remaining lifetime
        try {
            Date accessExpiry = jwtService.extractExpiration(accessToken);
            redisTokenStore.blockAccessToken(accessToken, accessExpiry);
        } catch (Exception e) {
            logger.debug("Access token already invalid, skipping blocklist: {}", e.getMessage());
        }

        // Revoke the refresh token
        if (refreshToken != null && !refreshToken.isBlank()) {
            try {
                String email = jwtService.extractSubject(refreshToken);
                User user = userRepository.findByEmail(email)
                        .orElseThrow(() -> new ResourceNotFoundException("User not found."));
                redisTokenStore.revokeRefreshToken(user.getUserId(), refreshToken);
            } catch (Exception e) {
                logger.debug("Refresh token already invalid, skipping revocation: {}", e.getMessage());
            }
        }

        logger.info("User logged out, both tokens invalidated.");
    }

    // ── Logout all devices ────────────────────────────────────────────────────

    /**
     * Revokes all refresh tokens for the authenticated user.
     * Access tokens remain valid until they expire (15 min max).
     * For full immediate invalidation, store access tokens with userId
     * and add a blocklist:user:{userId} key — overkill for most apps.
     */
    public void logoutAll(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Missing or malformed Authorization header.");
        }

        String accessToken = authHeader.substring(7);

        try {
            String email = jwtService.extractSubject(accessToken);
            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found."));

            // Blocklist current access token
            Date expiry = jwtService.extractExpiration(accessToken);
            redisTokenStore.blockAccessToken(accessToken, expiry);

            // Revoke every refresh token this user has ever been issued
            redisTokenStore.revokeAllRefreshTokens(user.getUserId());
            logger.info("All sessions revoked for userId={}", user.getUserId());
        } catch (Exception e) {
            throw new IllegalArgumentException("Could not process logout-all request.");
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Generates a fresh access + refresh token pair, stores the refresh token
     * in Redis, and builds the response. Called on register and login.
     */
    private AuthResponseDTO issueTokenPair(User user) {
        String accessToken  = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        Date   refreshExpiry = jwtService.extractExpiration(refreshToken);

        redisTokenStore.storeRefreshToken(user.getUserId(), refreshToken, refreshExpiry);

        return buildAuthResponse(accessToken, refreshToken, user);
    }

    private AuthResponseDTO buildAuthResponse(String accessToken, String refreshToken, User user) {
        return new AuthResponseDTO(
                "Bearer",
                accessToken,
                refreshToken,
                UserResponseDTO.from(user)
        );
    }
}
