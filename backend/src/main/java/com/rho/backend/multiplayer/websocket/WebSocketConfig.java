package com.rho.backend.multiplayer.websocket;
import com.rho.backend.multiplayer.jwt.JwtChannelInterceptor;
import com.rho.backend.multiplayer.jwt.JwtHandshakeInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

// 1. Annotate with @Configuration and @EnableWebSocketMessageBroker
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer { // 2. Implement interface

    private final JwtHandshakeInterceptor jwtHandshakeInterceptor;
    private final JwtChannelInterceptor jwtChannelInterceptor;

    // Injecting the interceptors configured in previous steps
    public WebSocketConfig(JwtHandshakeInterceptor jwtHandshakeInterceptor,
                           JwtChannelInterceptor jwtChannelInterceptor) {
        this.jwtHandshakeInterceptor = jwtHandshakeInterceptor;
        this.jwtChannelInterceptor = jwtChannelInterceptor;
    }

    // 3. Override configureMessageBroker()
    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Enable simple broker for broadcasting to topics and targeting specific users
        registry.enableSimpleBroker("/topic", "/queue");

        // Filter destinations targeted for application @MessageMapping methods
        registry.setApplicationDestinationPrefixes("/app");

        // Prefix used to point to user-specific queues (e.g., /user/queue/notifications)
        registry.setUserDestinationPrefix("/user");
    }

    // 4. Override registerStompEndpoints()
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .addInterceptors(jwtHandshakeInterceptor)
                .withSockJS()
                .setHeartbeatTime(25000);
    }

    // 5. Override configureClientInboundChannel()
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Channel interceptor to read userId from session attributes and assign Principal
        registration.interceptors(jwtChannelInterceptor);
    }
}
