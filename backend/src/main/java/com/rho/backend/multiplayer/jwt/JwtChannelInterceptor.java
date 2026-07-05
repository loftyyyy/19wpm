package com.rho.backend.multiplayer.jwt;

import org.jspecify.annotations.Nullable;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;


import java.security.Principal;
import java.util.Map;

@Component
public class JwtChannelInterceptor implements ChannelInterceptor {

    @Override
    public @Nullable Message<?> preSend(Message<?> message, MessageChannel channel) {
        // 1. Intercept only the CONNECT frame — ignore all others
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {

            // 2. Read userId from the handshake attributes
            Map<String, Object> sessionAttributes = accessor.getSessionAttributes();

            if (sessionAttributes != null && sessionAttributes.containsKey("userId")) {
                Object userIdObj = sessionAttributes.get("userId");
                String userId = String.valueOf(userIdObj);

                // 3. Wrap it in a Principal and set it on the message headers
                // Note: You can use a custom Principal implementation or SimplePrincipal
                Principal principal = new SimplePrincipal(userId);
                accessor.setUser(principal);
            }
        }

        // 4. Return the modified message
        return message;
    }

    // Quick internal implementation of Principal for simplicity
    private static class SimplePrincipal implements Principal {
        private final String name;

        public SimplePrincipal(String name) {
            this.name = name;
        }

        @Override
        public String getName() {
            return this.name;
        }
    }
}
