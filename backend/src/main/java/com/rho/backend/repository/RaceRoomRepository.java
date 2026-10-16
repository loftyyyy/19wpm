package com.rho.backend.repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.rho.backend.dto.text.response.TextResponseDTO;
import com.rho.backend.race.PersistedRaceRoom;
import com.rho.backend.race.RaceRoom;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.util.Optional;

@Repository
public class RaceRoomRepository {
    private static final String KEY_PREFIX = "race:room:";
    private static final Duration PRIVATE_TTL = Duration.ofMinutes(30);
    private static final Duration PUBLIC_TTL = Duration.ofMinutes(10);

    private final RedisTemplate<String, String> redisTemplate;
    private final TextRepository textRepository;

    private final ObjectMapper objectMapper;

    public RaceRoomRepository(RedisTemplate<String, String> redisTemplate, TextRepository textRepository){
        this.redisTemplate = redisTemplate;
        this.textRepository = textRepository;
        this.objectMapper = new ObjectMapper().registerModule(new JavaTimeModule()).disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    public void save(RaceRoom room){
        try{
            String key = toKey(room.getRoomCode());
            String json = objectMapper.writeValueAsString(PersistedRaceRoom.from(room));
            Duration ttl = room.isPrivate() ? PRIVATE_TTL : PUBLIC_TTL;
            redisTemplate.opsForValue().set(key,json,ttl);
        } catch (Exception e){
            throw new RuntimeException("Failed to save RacRoom: " + room.getRoomCode() + ". Error: " + e.getMessage() );
        }
    }

    public Optional<RaceRoom> findByCode(String roomCode){
        try{
            String json = redisTemplate.opsForValue().get(toKey(roomCode));
            if(json == null){
                return Optional.empty();
            }
            PersistedRaceRoom persisted = objectMapper.readValue(json, PersistedRaceRoom.class);
            TextResponseDTO text = persisted.textId() == null ? null
                    : textRepository.findByTextId(persisted.textId()).map(TextResponseDTO::new).orElse(null);
            return Optional.of(persisted.toRoom(text));
        }catch (Exception e){
            throw new RuntimeException("Failed to read code: " + roomCode + ". Error: " + e.getMessage());
        }

    }

    public void delete(String roomCode){
        redisTemplate.delete(toKey(roomCode));
    }

    public boolean exists(String roomCode){
        return Boolean.TRUE.equals(redisTemplate.hasKey(toKey(roomCode)));

    }

    public String toKey(String roomCode){
        return KEY_PREFIX + roomCode;
    }


}
