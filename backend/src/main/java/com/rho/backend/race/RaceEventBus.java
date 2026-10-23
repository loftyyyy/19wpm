package com.rho.backend.race;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Fan-out bridge between the local Spring STOMP simple broker and Redis Pub/Sub.
 *
 * <p>Spring's in-memory broker only delivers to WebSocket sessions attached to the replica that
 * received the mutation. Every race event is therefore delivered locally and published on
 * {@code race:events}; peer replicas subscribe, deserialize the payload, and deliver it to their
 * own sessions. The originating instance ignores its own echo using an instance id.
 */
@Component
public class RaceEventBus implements MessageListener {

    public static final String CHANNEL = "race:events";

    private static final Logger logger = LoggerFactory.getLogger(RaceEventBus.class);

    private final String instanceId = UUID.randomUUID().toString();
    private final SimpMessagingTemplate messagingTemplate;
    private final RedisTemplate<String, String> redisTemplate;
    private final RedisMessageListenerContainer listenerContainer;
    private final ObjectMapper objectMapper;

    public RaceEventBus(
            SimpMessagingTemplate messagingTemplate,
            RedisTemplate<String, String> redisTemplate,
            RedisMessageListenerContainer listenerContainer,
            ObjectMapper objectMapper) {
        this.messagingTemplate = messagingTemplate;
        this.redisTemplate = redisTemplate;
        this.listenerContainer = listenerContainer;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void subscribe() {
        listenerContainer.addMessageListener(this, new ChannelTopic(CHANNEL));
    }

    public void broadcast(String destination, Object payload) {
        deliverLocal(destination, null, payload);
        publish(new RaceEvent(instanceId, destination, null, payload));
    }

    public void sendToUser(Long userId, String destination, Object payload) {
        deliverLocal(destination, userId, payload);
        publish(new RaceEvent(instanceId, destination, userId, payload));
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String body = new String(message.getBody(), StandardCharsets.UTF_8);
            RaceEvent event = objectMapper.readValue(body, RaceEvent.class);
            if (!instanceId.equals(event.originId())) {
                deliverLocal(event.destination(), event.userId(), event.payload());
            }
        } catch (Exception e) {
            logger.warn("Failed to process race event: {}", e.getMessage());
        }
    }

    private void deliverLocal(String destination, Long userId, Object payload) {
        if (userId == null) {
            messagingTemplate.convertAndSend(destination, payload);
        } else {
            messagingTemplate.convertAndSendToUser(userId.toString(), destination, payload);
        }
    }

    private void publish(RaceEvent event) {
        try {
            redisTemplate.convertAndSend(CHANNEL, objectMapper.writeValueAsString(event));
        } catch (Exception e) {
            logger.warn("Failed to publish race event to {}: {}", CHANNEL, e.getMessage());
        }
    }

    public record RaceEvent(String originId, String destination, Long userId, Object payload) {
    }
}
