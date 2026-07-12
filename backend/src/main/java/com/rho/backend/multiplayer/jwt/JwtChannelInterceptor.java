package com.rho.backend.multiplayer.jwt;

import com.rho.backend.config.CustomUserDetails;
import com.rho.backend.service.JwtService;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class JwtChannelInterceptor implements ChannelInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(JwtChannelInterceptor.class);

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    public JwtChannelInterceptor(JwtService jwtService, UserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    public @Nullable Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(
                message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            String token = accessor.getFirstNativeHeader("token");

            logger.info("STOMP CONNECT - token present: {}", token != null);

            if (token == null || !jwtService.isAccessToken(token)) {
                logger.warn("STOMP CONNECT - rejected: invalid token");
                throw new MessagingException("Invalid or missing token");
            }

            try {
                String email = jwtService.extractSubject(token);
                var userDetails = userDetailsService.loadUserByUsername(email);
                if (userDetails instanceof CustomUserDetails customUser) {
                    Long userId = customUser.getUserId();
                    accessor.setUser(() -> userId.toString());
                    logger.info("STOMP CONNECT - principal set to userId: {}", userId);
                    Map<String, Object> attrs = accessor.getSessionAttributes();
                    if (attrs != null) attrs.put("userId", userId);
                } else {
                    throw new MessagingException("Invalid user details");
                }
            } catch (MessagingException e) {
                throw e;
            } catch (Exception e) {
                throw new MessagingException("Authentication failed: " + e.getMessage());
            }
        }
        return message;
    }
}
