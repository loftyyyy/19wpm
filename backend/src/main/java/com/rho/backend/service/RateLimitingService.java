package com.rho.backend.service;


import com.rho.backend.redis.RedisKeys;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * Redis-backed rate limiter using a fixed-window counter strategy.
 *
 * How it works:
 *   On the first request from an IP in a window, a key is created with
 *   a TTL equal to the window size. Every subsequent request in that window
 *   increments the counter. When the counter exceeds the limit, the request
 *   is rejected. After TTL expires Redis auto-deletes the key, starting a
 *   fresh window.
 *
 * This approach is horizontally scalable — all app instances share the same
 * Redis counters, so rate limits hold even across multiple servers.
 *
 * Trade-off: fixed-window allows a burst at window boundaries (max 2× the
 * limit in theory). A sliding-window log is more precise but more expensive.
 * Fixed-window is the industry standard for most use cases.
 */
@Service
@RequiredArgsConstructor
public class RateLimitingService {

    private static final Logger logger = LoggerFactory.getLogger(RateLimitingService.class);

    private final RedisTemplate<String, String> redisTemplate;

    @Value("${security.rate-limit.login.attempts:5}")
    private int loginAttempts;

    @Value("${security.rate-limit.login.window:60}")
    private int loginWindowSeconds;

    @Value("${security.rate-limit.refresh.attempts:10}")
    private int refreshAttempts;

    @Value("${security.rate-limit.refresh.window:60}")
    private int refreshWindowSeconds;

    // ── Public API ────────────────────────────────────────────────────────────

    public boolean isLoginAllowed(String clientIp) {
        return isAllowed(
                RedisKeys.rateLimitLogin(clientIp),
                loginAttempts,
                loginWindowSeconds,
                "Login",
                clientIp
        );
    }

    public boolean isRefreshAllowed(String clientIp) {
        return isAllowed(
                RedisKeys.rateLimitRefresh(clientIp),
                refreshAttempts,
                refreshWindowSeconds,
                "Refresh",
                clientIp
        );
    }

    public long getRemainingLoginAttempts(String clientIp) {
        return getRemaining(RedisKeys.rateLimitLogin(clientIp), loginAttempts);
    }

    public long getRemainingRefreshAttempts(String clientIp) {
        return getRemaining(RedisKeys.rateLimitRefresh(clientIp), refreshAttempts);
    }

    /**
     * Clears rate limit counters for an IP (e.g. after successful login
     * to reset the failed-attempt counter for a legitimate user).
     */
    public void clearRateLimit(String clientIp) {
        redisTemplate.delete(RedisKeys.rateLimitLogin(clientIp));
        redisTemplate.delete(RedisKeys.rateLimitRefresh(clientIp));
        logger.info("Rate limit cleared for IP: {}", clientIp);
    }

    /**
     * Resolves the real client IP, accounting for reverse proxies.
     *
     * Takes the LAST entry from X-Forwarded-For — the last hop is appended
     * by your trusted proxy (Nginx, ALB) and cannot be spoofed by the client,
     * unlike the first entry which the client can set to anything.
     */
    public String extractClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            String[] ips = xForwardedFor.split(",");
            String clientIp = ips[ips.length - 1].trim();
            logger.debug("Resolved client IP from X-Forwarded-For: {}", clientIp);
            return clientIp;
        }
        return request.getRemoteAddr();
    }

    public String getConfiguration() {
        return String.format("Login: %d/%ds | Refresh: %d/%ds",
                loginAttempts, loginWindowSeconds,
                refreshAttempts, refreshWindowSeconds);
    }

    // ── Core logic ────────────────────────────────────────────────────────────

    /**
     * Fixed-window counter using Redis INCR + EXPIRE.
     *
     * INCR is atomic in Redis — no race condition between checking and
     * incrementing, even with multiple app instances hitting the same key.
     *
     * EXPIRE is only set on the first request (count == 1) to avoid
     * resetting the window on every request.
     */
    private boolean isAllowed(String key, int limit, int windowSeconds,
                              String label, String clientIp) {
        Long count = redisTemplate.opsForValue().increment(key);

        if (count == null) {
            // Redis unreachable — fail open to avoid locking out all users.
            // Log loudly so you know Redis is down.
            logger.error("Redis unavailable for rate limiting key: {}. Failing open.", key);
            return true;
        }

        if (count == 1) {
            // First request in this window — set the expiry
            redisTemplate.expire(key, Duration.ofSeconds(windowSeconds));
        }

        if (count > limit) {
            logger.warn("{} rate limit exceeded for IP: {} ({}/{} in {}s)",
                    label, clientIp, count, limit, windowSeconds);
            return false;
        }

        return true;
    }

    private long getRemaining(String key, int limit) {
        String value = redisTemplate.opsForValue().get(key);
        if (value == null) return limit;
        long used = Long.parseLong(value);
        return Math.max(0, limit - used);
    }
}
