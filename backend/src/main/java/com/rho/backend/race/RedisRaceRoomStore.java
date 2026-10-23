package com.rho.backend.race;

import com.rho.backend.redis.RedisLock;
import com.rho.backend.repository.RaceRoomRepository;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;
import java.util.function.Function;

/**
 * Redis-backed {@link RaceRoomStore}.
 *
 * <p>Every mutation runs under {@code race:lock:{roomCode}} so concurrent updates from different
 * backend replicas cannot lose writes. The room is reloaded inside the lock, changed, and written
 * back before the lock is released. Progress ticks therefore round-trip Redis; this is the cost of
 * making room state replica-safe, and it is bounded to one JSON write per tick per room.
 */
@Component
public class RedisRaceRoomStore implements RaceRoomStore {

    private static final Duration LOCK_TTL = Duration.ofSeconds(5);
    private static final Duration LOCK_WAIT = Duration.ofSeconds(2);

    private final RaceRoomRepository raceRoomRepository;
    private final RedisLock redisLock;

    public RedisRaceRoomStore(RaceRoomRepository raceRoomRepository, RedisLock redisLock) {
        this.raceRoomRepository = raceRoomRepository;
        this.redisLock = redisLock;
    }

    @Override
    public Optional<RaceRoom> get(String roomCode) {
        return raceRoomRepository.findByCode(roomCode);
    }

    @Override
    public boolean exists(String roomCode) {
        return raceRoomRepository.exists(roomCode);
    }

    @Override
    public void put(RaceRoom room) {
        raceRoomRepository.save(room);
    }

    @Override
    public void persist(RaceRoom room) {
        raceRoomRepository.save(room);
    }

    @Override
    public void remove(String roomCode) {
        raceRoomRepository.delete(roomCode);
    }

    @Override
    public <T> Optional<T> mutate(String roomCode, Function<RaceRoom, T> mutation) {
        return redisLock.withLock(lockKey(roomCode), LOCK_TTL, LOCK_WAIT, () -> {
            Optional<RaceRoom> existing = raceRoomRepository.findByCode(roomCode);
            if (existing.isEmpty()) {
                return Optional.empty();
            }
            RaceRoom room = existing.get();
            T result = mutation.apply(room);
            raceRoomRepository.save(room);
            return Optional.ofNullable(result);
        });
    }

    private String lockKey(String roomCode) {
        return "race:lock:" + roomCode;
    }
}
