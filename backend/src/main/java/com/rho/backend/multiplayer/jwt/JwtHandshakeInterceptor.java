package com.rho.backend.multiplayer.jwt;

import com.rho.backend.config.CustomUserDetails;
import com.rho.backend.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.jspecify.annotations.Nullable;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;


@Component
public class JwtHandshakeInterceptor implements HandshakeInterceptor {
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    public JwtHandshakeInterceptor(JwtService jwtService, UserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {

        if (request instanceof ServletServerHttpRequest) {
            ServletServerHttpRequest servletRequest = (ServletServerHttpRequest) request;
            HttpServletRequest httpRequest = servletRequest.getServletRequest();

            // 1. Get the token from the query string
            String token = httpRequest.getParameter("token");

            // 2. Validate it
            if (token == null || !jwtService.isAccessToken(token)) {
                return false; // Reject the connection
            }

            try {
                // 3. Extract the email
                String email = jwtService.extractSubject(token);

                // 4. Load the user from the database
                var userDetails = userDetailsService.loadUserByUsername(email);

                if (userDetails instanceof CustomUserDetails) {
                    Long userId = ((CustomUserDetails) userDetails).getUserId();

                    // 5. Store userId in handshake attributes
                    attributes.put("userId", userId);
                } else {
                    return false; // Reject if user details don't match expected type
                }

            } catch (Exception e) {
                // Catch token parsing or user loading exceptions
                return false;
            }

            // 6. Return true (allow connection)
            return true;
        }

        return false; // Reject if it's not a servlet-based request
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, @Nullable Exception exception) {
        // No action needed post-handshake for authentication
    }
}
