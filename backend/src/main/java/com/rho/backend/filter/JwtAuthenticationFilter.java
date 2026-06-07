package com.rho.backend.filter;


import com.rho.backend.redis.RedisTokenStore;
import com.rho.backend.repository.UserRepository;
import com.rho.backend.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final RedisTokenStore redisTokenStore;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String jwt = authHeader.substring(7);

        // 1. Reject explicitly blocklisted tokens (logged-out access tokens)
        if (redisTokenStore.isAccessTokenBlocked(jwt)) {
            logger.warn("Blocklisted token presented — token reuse after logout detected.");
            filterChain.doFilter(request, response);
            return;
        }

        // 2. Reject refresh tokens submitted to regular API endpoints
        if (jwtService.isRefreshToken(jwt)) {
            logger.warn("Refresh token submitted to non-refresh endpoint — rejected.");
            filterChain.doFilter(request, response);
            return;
        }

        // 3. Extract subject (parses + verifies signature)
        final String userEmail;
        try {
            userEmail = jwtService.extractSubject(jwt);
        } catch (Exception e) {
            logger.warn("Could not extract subject from JWT: {}", e.getMessage());
            filterChain.doFilter(request, response);
            return;
        }

        // 4. Verify the user still exists in the database
        if (userEmail != null && !userRepository.existsByEmail(userEmail)) {
            logger.warn("JWT presented for deleted user: {}", userEmail);
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "User account not found");
            return;
        }

        // 5. Authenticate if not already done for this request
        if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);

            if (jwtService.isAccessTokenValid(jwt, userDetails)) {
                var authToken = new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities()
                );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            } else {
                logger.warn("JWT validation failed for user: {}", userEmail);
            }
        }

        filterChain.doFilter(request, response);
    }
}
