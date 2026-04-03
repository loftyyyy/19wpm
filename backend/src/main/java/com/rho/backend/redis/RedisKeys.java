package com.rho.backend.redis;

/**
 * Central registry of all Redis key patterns used in the application.
 *
 * Keeping these in one place means:
 *  - No magic strings scattered across services
 *  - Easy to audit what's stored in Redis
 *  - Safe to refactor key names without grepping the whole codebase
 *
 * Key design:
 *  blocklist:access:{token}       → access tokens invalidated via logout
 *  refresh:{userId}:{token}       → valid refresh tokens (revoked on logout/rotation)
 *  ratelimit:login:{ip}           → login attempt counter per IP
 *  ratelimit:refresh:{ip}         → refresh attempt counter per IP
 */
public final class RedisKeys {

    private RedisKeys() {}

    // ── Token blocklist ───────────────────────────────────────────────────────
    private static final String BLOCKLIST_ACCESS  = "blocklist:access:";

    // ── Refresh token store ───────────────────────────────────────────────────
    private static final String REFRESH_TOKEN     = "refresh:";

    // ── Rate limiting ─────────────────────────────────────────────────────────
    private static final String RATE_LOGIN        = "ratelimit:login:";
    private static final String RATE_REFRESH      = "ratelimit:refresh:";

    // ── Key builders ──────────────────────────────────────────────────────────

    public static String accessBlocklist(String token) {
        return BLOCKLIST_ACCESS + token;
    }

    /**
     * Scoped to userId so we can list/revoke all refresh tokens for a user
     * (e.g. "logout from all devices") via SCAN ratelimit:userId:*
     */
    public static String refreshToken(Long userId, String token) {
        return REFRESH_TOKEN + userId + ":" + token;
    }

    public static String rateLimitLogin(String ip) {
        return RATE_LOGIN + ip;
    }

    public static String rateLimitRefresh(String ip) {
        return RATE_REFRESH + ip;
    }
}
