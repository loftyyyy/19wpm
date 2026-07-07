package com.rho.backend.service;

import com.rho.backend.enums.TextType;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Service
public class MatchmakingService {
    private final RedisTemplate<String, String> redisTemplate;
    private static final String QUEUE_KEY_PREFIX  = "matchmaking:queue:";
    private static final String PLAYER_KEY_PREFIX = "matchmaking:player:";

    private final RaceService raceService;
    private final SimpMessagingTemplate simpMessagingTemplate;

    public MatchmakingService(RedisTemplate<String, String> redisTemplate, RaceService raceService, SimpMessagingTemplate simpMessagingTemplate){
        this.redisTemplate = redisTemplate;
        this.raceService = raceService;
        this.simpMessagingTemplate = simpMessagingTemplate;
    }

    public void joinQueue(Long userId, TextType textType){
        String playerKey = playerKey(userId);
        String queueKey =  queueKey(textType);

        Boolean hasKey = redisTemplate.hasKey(playerKey);
        if(Boolean.TRUE.equals(hasKey)){
            throw new IllegalStateException("Player " + userId + " is already in a matchmaking queue.");
        }

        redisTemplate.opsForList().leftPush(queueKey, userId.toString());
        redisTemplate.opsForValue().set(playerKey, textType.name(), Duration.ofSeconds(60));
    }

    public void leaveQueue(Long userId){
        String playerKey = playerKey(userId);


        Boolean hasKey = redisTemplate.hasKey(playerKey);
        if(!Boolean.TRUE.equals(hasKey)){
            return;
        }

        TextType textType = TextType.valueOf(redisTemplate.opsForValue().get(playerKey));
        redisTemplate.opsForList().remove(queueKey(textType),1, userId.toString());
        redisTemplate.delete(playerKey);
    }

    public void pollQueues(){
        for(TextType textType : TextType.values()){
            String queueKey = queueKey(textType);
            Long queueSize = redisTemplate.opsForList().size(queueKey);

            if(queueSize == null || queueSize < 2){
                continue;
            }

            List<Long> matchedPlayers = new ArrayList<>();

            for(int i = 0; i < 5; i++){
                String userId = redisTemplate.opsForList().rightPop(queueKey);
                if(userId == null){
                    break;
                }

                matchedPlayers.add(Long.parseLong(userId));
            }

            if(matchedPlayers.size() < 2) {
                for (Long userId : matchedPlayers) {
                    redisTemplate.opsForList().rightPush(queueKey, userId.toString());
                }
                continue;
            }

            String roomCode = raceService.createRoom(null, textType, false);

            for(Long userId : matchedPlayers){
                redisTemplate.delete(playerKey(userId));
                raceService.joinRoom(roomCode, userId);
                simpMessagingTemplate.convertAndSendToUser(userId.toString(), "/queue/matchmaking", roomCode);
            }
        }
    }

    private String queueKey(TextType textType) {
        return QUEUE_KEY_PREFIX + textType.name();
    }

    private String playerKey(Long userId) {
        return PLAYER_KEY_PREFIX + userId;
    }
}
