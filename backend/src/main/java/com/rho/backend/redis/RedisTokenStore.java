package com.rho.backend.redis;


import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * Owns all token state in Redis.
 *
 * Access token blocklist:
 *   On logout, the access token is written here with a TTL equal to its
 *   remaining lifetime. After natural expiry there's nothing to block —
 *   the JWT validation itself rejects it.
 *
 * Refresh token store:
 *   On login/register, the refresh token is written here with its full TTL.
 *   On refresh, we verify the token exists here before issuing a new access token.
 *   On logout, we delete it — making it immediately unusable regardless of expiry.
 *   On rotation, old token is deleted and new token is written atomically.
 */
@Service
@RequiredArgsConstructor
public class RedisTokenStore {

    private static final Logger logger = LoggerFactory.getLogger(RedisTokenStore.class);

    private static final String PRESENT = "1"; // dummy value — we only care about key presence

    private final RedisTemplate<String, String> redisTemplate;

    // ── Access token blocklist ────────────────────────────────────────────────

    /**
     * Blocklists an access token until its natural expiry.
     * After that, JWT validation itself handles rejection — no cleanup needed.
     */
    public void blockAccessToken(String token, Date expiresAt) {
        long ttlMs = expiresAt.getTime() - System.currentTimeMillis();
        if (ttlMs <= 0) {
            logger.debug("Access token already expired, skipping blocklist.");
            return;
        }
        String key = RedisKeys.accessBlocklist(token);
        redisTemplate.opsForValue().set(key, PRESENT, Duration.ofMillis(ttlMs));
        logger.info("Access token blocklisted, TTL={}ms", ttlMs);
    }

    public boolean isAccessTokenBlocked(String token) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(RedisKeys.accessBlocklist(token)));
    }

    // ── Refresh token store ───────────────────────────────────────────────────

    /**
     * Persists a refresh token for the given user.
     * TTL matches the token's expiry so Redis auto-cleans it.
     */
    public void storeRefreshToken(Long userId, String token, Date expiresAt) {
        long ttlMs = expiresAt.getTime() - System.currentTimeMillis();
        if (ttlMs <= 0) return;

        String key = RedisKeys.refreshToken(userId, token);
        redisTemplate.opsForValue().set(key, PRESENT, Duration.ofMillis(ttlMs));
        logger.debug("Refresh token stored for userId={}, TTL={}ms", userId, ttlMs);
    }

    /**
     * Returns true if this refresh token was issued by us and hasn't been revoked.
     */
    public boolean isRefreshTokenValid(Long userId, String token) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(RedisKeys.refreshToken(userId, token)));
    }

    /**
     * Revokes a specific refresh token (single-device logout).
     */
    public void revokeRefreshToken(Long userId, String token) {
        redisTemplate.delete(RedisKeys.refreshToken(userId, token));
        logger.info("Refresh token revoked for userId={}", userId);
    }

    /**
     * Rotates a refresh token atomically:
     *   1. Deletes the old token
     *   2. Stores the new token with its TTL
     *
     * If an attacker steals a refresh token and uses it first, the legitimate
     * user's next request will fail because the old token is gone — detecting
     * the theft immediately.
     */
    public void rotateRefreshToken(Long userId, String oldToken,
                                   String newToken, Date newExpiresAt) {
        redisTemplate.delete(RedisKeys.refreshToken(userId, oldToken));
        storeRefreshToken(userId, newToken, newExpiresAt);
        logger.info("Refresh token rotated for userId={}", userId);
    }

    /**
     * Revokes ALL refresh tokens for a user (logout from all devices).
     * Uses SCAN to iterate through keys matching refresh:{userId}:* — safe for production
     * unlike KEYS which blocks the Redis event loop.
     */
    public void revokeAllRefreshTokens(Long userId) {
        String pattern = RedisKeys.refreshToken(userId, "*");
        List<String> keysToDelete = new ArrayList<>();
        
        ScanOptions scanOptions = ScanOptions.scanOptions()
                .match(pattern)
                .count(100)
                .build();
        
        try (Cursor<String> cursor = redisTemplate.scan(scanOptions)) {
            while (cursor.hasNext()) {
                keysToDelete.add(cursor.next());
            }
        }
        
        if (!keysToDelete.isEmpty()) {
            redisTemplate.delete(keysToDelete);
            logger.info("All {} refresh tokens revoked for userId={}", keysToDelete.size(), userId);
        }
    }
}
