package com.rho.backend.scheduler;

import com.rho.backend.race.RaceEventBus;
import com.rho.backend.race.RaceRoom;
import com.rho.backend.service.RaceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Set;

/**
 * Replica-safe race countdown.
 *
 * <p>The COUNTDOWN to RACING deadline is stored in a Redis sorted set instead of an in-process
 * {@code TaskScheduler}. Any replica may poll it; the winner removes the due member and performs
 * the transition under the room lock, while peers observe a non-COUNTDOWN state and do nothing.
 * If the replica that started the countdown crashes, another replica still performs the
 * transition when the deadline passes.
 */
@Component
public class RaceCountdownScheduler {

    private static final Logger logger = LoggerFactory.getLogger(RaceCountdownScheduler.class);
    private static final String COUNTDOWN_KEY = "race:countdown";

    private final RedisTemplate<String, String> redisTemplate;
    private final RaceService raceService;
    private final RaceEventBus raceEventBus;

    public RaceCountdownScheduler(
            RedisTemplate<String, String> redisTemplate,
            RaceService raceService,
            RaceEventBus raceEventBus) {
        this.redisTemplate = redisTemplate;
        this.raceService = raceService;
        this.raceEventBus = raceEventBus;
    }

    public void schedule(String roomCode, Instant dueAt) {
        redisTemplate.opsForZSet().add(COUNTDOWN_KEY, roomCode, dueAt.toEpochMilli());
    }

    public void cancel(String roomCode) {
        redisTemplate.opsForZSet().remove(COUNTDOWN_KEY, roomCode);
    }

    @Scheduled(fixedDelay = 500)
    public void poll() {
        long now = Instant.now().toEpochMilli();
        Set<String> dueRooms = redisTemplate.opsForZSet().rangeByScore(COUNTDOWN_KEY, 0, now);
        if (dueRooms == null) {
            return;
        }
        for (String roomCode : dueRooms) {
            Long removed = redisTemplate.opsForZSet().remove(COUNTDOWN_KEY, roomCode);
            if (removed == null || removed == 0) {
                continue;
            }
            try {
                raceService.transitionToRacing(roomCode).ifPresent(room -> {
                    logger.info("Room {} transitioned to RACING at {}", roomCode, room.getStartTime());
                    raceEventBus.broadcast("/topic/room/" + roomCode, room);
                });
            } catch (RuntimeException e) {
                logger.warn("Could not transition room {} to RACING: {}", roomCode, e.getMessage());
            }
        }
    }
}
