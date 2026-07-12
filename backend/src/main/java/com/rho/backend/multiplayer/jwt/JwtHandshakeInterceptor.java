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

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;


@Component
public class JwtHandshakeInterceptor implements HandshakeInterceptor {
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    private static final Logger logger = LoggerFactory.getLogger(JwtHandshakeInterceptor.class);

    public JwtHandshakeInterceptor(JwtService jwtService, UserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, @Nullable Exception exception) {
        // No action needed post-handshake for authentication
    }
}
