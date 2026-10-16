package com.rho.backend.filter;


import com.rho.backend.config.UserDetailsCache;
import com.rho.backend.redis.RedisTokenStore;
import com.rho.backend.service.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
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
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JwtService jwtService;
    private final UserDetailsCache userDetailsCache;
    private final RedisTokenStore redisTokenStore;

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

        // 2. Parse + verify the signature ONCE and reuse the claims for every check below.
        final Claims claims;
        try {
            claims = jwtService.extractAllClaims(jwt);
        } catch (JwtException | IllegalArgumentException e) {
            logger.warn("Invalid JWT: {}", e.getMessage());
            filterChain.doFilter(request, response);
            return;
        }

        // 3. Reject refresh tokens, expired tokens, or any non-ACCESS token
        if (!jwtService.isAccessClaimsValid(claims)) {
            logger.warn("JWT is not a valid access token — rejected.");
            filterChain.doFilter(request, response);
            return;
        }

        final String userEmail = claims.getSubject();

        // 4. Authenticate if not already done for this request
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            final UserDetails userDetails;
            try {
                userDetails = userDetailsCache.get(userEmail);
            } catch (UsernameNotFoundException e) {
                logger.warn("JWT presented for unknown/deleted user: {}", userEmail);
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "User account not found");
                return;
            }

            var authToken = new UsernamePasswordAuthenticationToken(
                    userDetails,
                    null,
                    userDetails.getAuthorities()
            );
            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authToken);
        }

        filterChain.doFilter(request, response);
    }
}
