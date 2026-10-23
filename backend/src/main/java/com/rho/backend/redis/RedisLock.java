package com.rho.backend.redis;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Small Redis-backed mutual exclusion primitive for cross-replica critical sections.
 *
 * <p>Acquisition is a single {@code SET key token NX PX ttl}; release is a compare-and-delete
 * Lua script so a caller can never delete a lock that expired and was re-acquired by someone
 * else. The lock is intentionally non-reentrant and best-effort: callers should keep the
 * critical section short and bounded by the TTL.
 */
@Component
public class RedisLock {

    private static final RedisScript<Long> RELEASE_SCRIPT = new DefaultRedisScript<>(
            "if redis.call('get', KEYS[1]) == ARGV[1] then "
                    + "return redis.call('del', KEYS[1]) "
                    + "else return 0 end",
            Long.class);

    private final RedisTemplate<String, String> redisTemplate;

    public RedisLock(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public <T> T withLock(String key, Duration ttl, Duration wait, Supplier<T> action) {
        String token = UUID.randomUUID().toString();
        long deadline = System.nanoTime() + wait.toNanos();

        while (true) {
            Boolean acquired = redisTemplate.opsForValue().setIfAbsent(key, token, ttl);
            if (Boolean.TRUE.equals(acquired)) {
                break;
            }
            if (System.nanoTime() >= deadline) {
                throw new IllegalStateException("Timed out acquiring lock " + key);
            }
            try {
                Thread.sleep(20L);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted acquiring lock " + key, e);
            }
        }

        try {
            return action.get();
        } finally {
            try {
                redisTemplate.execute(RELEASE_SCRIPT, List.of(key), token);
            } catch (RuntimeException ignored) {
                // The TTL is the safety net if Redis is unreachable during release.
            }
        }
    }
}
