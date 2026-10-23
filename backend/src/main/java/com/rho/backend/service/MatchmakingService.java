package com.rho.backend.service;

import com.rho.backend.enums.TextType;
import com.rho.backend.matchmaking.MatchmakingEntry;
import com.rho.backend.matchmaking.SkillMatchmaker;
import com.rho.backend.model.UserStat;
import com.rho.backend.race.RaceEventBus;
import com.rho.backend.redis.RedisLock;
import com.rho.backend.repository.TypingResultRepository;
import com.rho.backend.repository.UserStatRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Service
public class MatchmakingService {
    private static final Logger logger = LoggerFactory.getLogger(MatchmakingService.class);

    private final RedisTemplate<String, String> redisTemplate;
    private static final String QUEUE_KEY_PREFIX = "matchmaking:queue:";
    private static final String PLAYER_KEY_PREFIX = "matchmaking:player:";
    private static final Duration QUEUE_TTL = Duration.ofMinutes(5);
    private static final Duration LOCK_TTL = Duration.ofSeconds(10);
    private static final Duration LOCK_WAIT = Duration.ofSeconds(2);

    private final RaceService raceService;
    private final RaceEventBus raceEventBus;
    private final RedisLock redisLock;
    private final ObjectMapper objectMapper;
    private final UserStatRepository userStatRepository;
    private final TypingResultRepository typingResultRepository;
    private final SkillMatchmaker skillMatchmaker = new SkillMatchmaker();

    public MatchmakingService(
            RedisTemplate<String, String> redisTemplate,
            RaceService raceService,
            RaceEventBus raceEventBus,
            RedisLock redisLock,
            ObjectMapper objectMapper,
            UserStatRepository userStatRepository,
            TypingResultRepository typingResultRepository) {
        this.redisTemplate = redisTemplate;
        this.raceService = raceService;
        this.raceEventBus = raceEventBus;
        this.redisLock = redisLock;
        this.objectMapper = objectMapper;
        this.userStatRepository = userStatRepository;
        this.typingResultRepository = typingResultRepository;
    }

    public void joinQueue(Long userId, TextType textType) {
        String playerKey = playerKey(userId);
        String queueKey = queueKey(textType);

        Boolean hasKey = redisTemplate.hasKey(playerKey);
        if (Boolean.TRUE.equals(hasKey)) {
            return;
        }

        MatchmakingEntry entry = new MatchmakingEntry(
                userId,
                resolveWpm(userId),
                resolveAccuracy(userId),
                System.currentTimeMillis());

        redisTemplate.opsForList().leftPush(queueKey, serialize(entry));
        redisTemplate.opsForValue().set(playerKey, textType.name(), QUEUE_TTL);

        // Event-driven: try to pair this player immediately instead of waiting for the poll.
        matchQueue(textType);
    }

    public void leaveQueue(Long userId) {
        String playerKey = playerKey(userId);
        String textTypeName = redisTemplate.opsForValue().get(playerKey);
        if (textTypeName == null) {
            return;
        }

        TextType textType = TextType.valueOf(textTypeName);
        String queueKey = queueKey(textType);

        try {
            redisLock.withLock(lockKey(textType), LOCK_TTL, LOCK_WAIT, () -> {
                removeUserEntries(queueKey, userId);
                redisTemplate.delete(playerKey);
                return null;
            });
        } catch (IllegalStateException e) {
            logger.warn("Could not acquire matchmaking lock to dequeue user {}: {}", userId, e.getMessage());
        }
    }

    public void pollQueues() {
        for (TextType textType : TextType.values()) {
            matchQueue(textType);
        }
    }

    /**
     * Attempts to form a room from one queue. Invoked immediately when a player joins the queue
     * (event-driven) and periodically by {@link com.rho.backend.scheduler.MatchmakingScheduler}
     * as a safety net. The per-text-type distributed lock prevents overlapping matches across
     * replicas from popping the same player into two rooms.
     */
    private void matchQueue(TextType textType) {
        String queueKey = queueKey(textType);
        try {
            redisLock.withLock(lockKey(textType), LOCK_TTL, LOCK_WAIT, () -> {
                List<QueuedEntry> queue = loadQueue(queueKey);
                pruneExpired(queue, queueKey);

                long now = System.currentTimeMillis();
                List<MatchmakingEntry> oldestFirst = queue.stream()
                        .map(QueuedEntry::entry)
                        .toList();
                Optional<SkillMatchmaker.Pair> pair = skillMatchmaker.selectPair(oldestFirst, now);
                if (pair.isEmpty()) {
                    return null;
                }

                QueuedEntry first = queue.get(pair.get().firstIndex());
                QueuedEntry second = queue.get(pair.get().secondIndex());
                removeEntry(queueKey, first.raw());
                removeEntry(queueKey, second.raw());

                createMatchedRoom(textType, List.of(first.entry(), second.entry()));
                return null;
            });
        } catch (IllegalStateException e) {
            logger.warn("Could not acquire matchmaking lock for {}: {}", textType, e.getMessage());
        }
    }

    private void createMatchedRoom(TextType textType, List<MatchmakingEntry> entries) {
        String roomCode = raceService.createRoom(null, textType, false);
        logger.info("Matched {} players into room {} ({})", entries.size(), roomCode, textType);

        for (MatchmakingEntry entry : entries) {
            Long userId = entry.userId();
            redisTemplate.delete(playerKey(userId));
            redisTemplate.opsForValue().set(
                    "matchmaking:pending:" + userId,
                    roomCode,
                    Duration.ofMinutes(2));
            raceService.joinRoom(roomCode, userId);
            raceEventBus.sendToUser(userId, "/queue/matchmaking", roomCode);
        }
    }

    private void pruneExpired(List<QueuedEntry> queue, String queueKey) {
        long cutoff = System.currentTimeMillis() - QUEUE_TTL.toMillis();
        queue.removeIf(queued -> {
            if (queued.entry().enqueuedAt() < cutoff) {
                removeEntry(queueKey, queued.raw());
                redisTemplate.delete(playerKey(queued.entry().userId()));
                return true;
            }
            return false;
        });
    }

    private List<QueuedEntry> loadQueue(String queueKey) {
        List<String> rawEntries = redisTemplate.opsForList().range(queueKey, 0, -1);
        if (rawEntries == null || rawEntries.isEmpty()) {
            return List.of();
        }

        List<QueuedEntry> queue = new ArrayList<>(rawEntries.size());
        for (int index = 0; index < rawEntries.size(); index++) {
            String raw = rawEntries.get(index);
            if (raw == null) {
                continue;
            }
            if (!raw.startsWith("{")) {
                MatchmakingEntry legacy = deserialize(raw);
                if (legacy != null) {
                    // Migrate legacy bare ids in place so the queued timestamp persists.
                    raw = serialize(legacy);
                    redisTemplate.opsForList().set(queueKey, index, raw);
                }
            }
            MatchmakingEntry entry = deserialize(raw);
            if (entry != null) {
                queue.add(new QueuedEntry(raw, entry));
            } else {
                removeEntry(queueKey, raw);
            }
        }
        // Redis list is newest-first because joinQueue left-pushes.
        Collections.reverse(queue);
        return queue;
    }

    private void removeUserEntries(String queueKey, Long userId) {
        List<String> rawEntries = redisTemplate.opsForList().range(queueKey, 0, -1);
        if (rawEntries == null) {
            return;
        }
        for (String raw : rawEntries) {
            MatchmakingEntry entry = deserialize(raw);
            if (entry != null && entry.userId() == userId) {
                removeEntry(queueKey, raw);
            }
        }
    }

    private void removeEntry(String queueKey, String raw) {
        redisTemplate.opsForList().remove(queueKey, 1, raw);
    }

    private int resolveWpm(Long userId) {
        return userStatRepository.findByUser_UserId(userId)
                .map(UserStat::getAverageSpeed)
                .map(BigDecimal::intValue)
                .filter(wpm -> wpm > 0)
                .orElse(50);
    }

    private int resolveAccuracy(Long userId) {
        Double average = typingResultRepository.findAverageAccuracyByUserId(userId);
        if (average == null || average <= 0) {
            return 90;
        }
        return (int) Math.round(Math.min(100, average));
    }

    private String serialize(MatchmakingEntry entry) {
        return objectMapper.writeValueAsString(entry);
    }

    private MatchmakingEntry deserialize(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            if (raw.startsWith("{")) {
                return objectMapper.readValue(raw, MatchmakingEntry.class);
            }
            // Legacy queue entries were bare user ids.
            return new MatchmakingEntry(Long.parseLong(raw), 50, 90, System.currentTimeMillis());
        } catch (Exception e) {
            logger.warn("Dropping malformed matchmaking queue entry: {}", raw);
            return null;
        }
    }

    private String queueKey(TextType textType) {
        return QUEUE_KEY_PREFIX + textType.name();
    }

    private String playerKey(Long userId) {
        return PLAYER_KEY_PREFIX + userId;
    }

    private String lockKey(TextType textType) {
        return "matchmaking:lock:" + textType.name();
    }

    private record QueuedEntry(String raw, MatchmakingEntry entry) {
    }
}
