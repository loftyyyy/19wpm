package com.rho.backend.service;

import com.rho.backend.enums.TextType;
import org.springframework.data.redis.core.RedisTemplate;

public class MatchmakingService {
    private final RedisTemplate<String, String> redisTemplate;
    private final String queueTemplate = "matchmaking:queue:";
    private final String playerTemplate = "matchmaking:player:";

    public MatchmakingService(RedisTemplate<String, String> redisTemplate){
        this.redisTemplate = redisTemplate;
    }

    public void joinQueue(Long userId, TextType textType){

    }

    public void leaveQueue(Long userId){

    }

    public void pollQueues(){

    }

    private String queueKey(TextType textType) {
        return "matchmaking:queue:" + textType.name();
    }

    private String playerKey(Long userId) {
        return "matchmaking:player:" + userId;
    }
}
