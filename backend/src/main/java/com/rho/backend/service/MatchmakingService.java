package com.rho.backend.service;

import com.rho.backend.enums.TextType;
import org.springframework.data.redis.core.RedisTemplate;

import java.time.Duration;

public class MatchmakingService {
    private final RedisTemplate<String, String> redisTemplate;
    private static final String QUEUE_KEY_PREFIX  = "matchmaking:queue:";
    private static final String PLAYER_KEY_PREFIX = "matchmaking:player:";

    public MatchmakingService(RedisTemplate<String, String> redisTemplate){
        this.redisTemplate = redisTemplate;
    }

    public void joinQueue(Long userId, TextType textType){
        String playerKey = PLAYER_KEY_PREFIX + userId.toString();
        String queueKey =  QUEUE_KEY_PREFIX + textType.name();

        Boolean hasKey = redisTemplate.hasKey(playerKey);
        if(Boolean.TRUE.equals(hasKey)){
            throw new IllegalStateException("Player " + userId + " is already in a matchmaking queue.");
        }

        redisTemplate.opsForList().leftPush(queueKey, userId.toString());
        redisTemplate.opsForValue().set(playerKey, textType.name(), Duration.ofSeconds(60));
    }

    public void leaveQueue(){

    }

    public void pollQueues(){

    }

    private String queueKey(TextType textType) {
        return QUEUE_KEY_PREFIX + textType.name();
    }

    private String playerKey(Long userId) {
        return PLAYER_KEY_PREFIX + userId;
    }
}
