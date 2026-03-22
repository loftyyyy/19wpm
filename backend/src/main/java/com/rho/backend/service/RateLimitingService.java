package com.rho.backend.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Service
public class RateLimitingService {

    private static final Logger logger = LoggerFactory.getLogger(RateLimitingService.class);

    private Cache<String, Bucket> buckets;

    @Value("${security.rate-limit.login.attempts}")
    private int loginAttempts;

    @Value("${security.rate-limit.login.window}")
    private int loginWindowSeconds;

    @Value("${security.rate-limit.refresh.attempts}")
    private int refreshAttempts;

    @Value("${security.rate-limit.refresh.window}")
    private int refreshWindowSeconds;

    @Value("${security.token-cleanup.enabled}")
    private boolean tokenCleanupEnabled;

    @Value("${security.token-cleanup.retention-hours}")
    private long retentionHours;

    @Value("${security.rate-limit.max-buckets}")
    private long maxBuckets;

    private Bandwidth loginBandwidth;
    private Bandwidth refreshBandwidth;

    @PostConstruct
    public void init(){
        this.loginBandwidth = Bandwidth.builder().capacity(loginAttempts).refillIntervally(loginAttempts, Duration.ofSeconds(loginWindowSeconds)).build();

        this.refreshBandwidth = Bandwidth.builder().capacity(refreshAttempts).refillIntervally(refreshAttempts, Duration.ofSeconds(refreshWindowSeconds)).build();

        this.buckets = Caffeine.newBuilder().maximumSize(maxBuckets).expireAfterAccess(retentionHours, TimeUnit.HOURS).build();

        logger.info("Rate limiting initialized - Login: {} attempts per {}s, Refresh: {} attempts per {}s",
                loginAttempts, loginWindowSeconds, refreshAttempts, refreshWindowSeconds);
        logger.info("Bucket cache: max={} entries, TTL={}h, cleanup={}", maxBuckets, retentionHours, tokenCleanupEnabled);

    }

    @Scheduled(fixedRateString = "${security.token-cleanup.interval}")
    public void cleanupOldBuckets(){
        if(!tokenCleanupEnabled){
            logger.debug("Bucket clean up is disabled, skipping.");
            return;
        }

        buckets.cleanUp();
        logger.info("Rate limit bucket cleanup triggered. Estimated cache size: {}", buckets.estimatedSize());
    }

    public boolean isLoginAllowed(String clientIp){
        Bucket bucket = buckets.get(clientIp + "_login", k -> Bucket.builder().addLimit(loginBandwidth).build());
        boolean allowed = bucket.tryConsume(1);

        if (!allowed) {
            logger.warn("Login rate limit exceeded for IP: {} ({} attempts per {}s)",
                    clientIp, loginAttempts, loginWindowSeconds);
        }
        return allowed;

    }

    public boolean isRefreshAllowed(String clientIp){
        Bucket bucket = buckets.get(clientIp + "_refresh", k -> Bucket.builder().addLimit(refreshBandwidth).build());
        boolean allowed = bucket.tryConsume(1);

        if (!allowed) {
            logger.warn("Refresh rate limit exceeded for IP: {} ({} attempts per {}s)",
                    clientIp, refreshAttempts, refreshWindowSeconds);
        }
        return allowed;
    }

     public long getRemainingLoginAttempts(String clientIp) {
        Bucket bucket = buckets.getIfPresent(clientIp + "_login");
        return bucket != null ? bucket.getAvailableTokens() : loginAttempts;
    }

    public long getRemainingRefreshAttempts(String clientIp) {
        Bucket bucket = buckets.getIfPresent(clientIp + "_refresh");
        return bucket != null ? bucket.getAvailableTokens() : refreshAttempts;
    }

    public void clearRateLimit(String clientIp) {
        buckets.invalidate(clientIp + "_login");
        buckets.invalidate(clientIp + "_refresh");
        logger.info("Rate limit cleared for IP: {}", clientIp);
    }

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

        return String.format("Login: %d/%ds, Refresh: %d/%ds, Cleanup: %s, MaxBuckets: %d",
                loginAttempts, loginWindowSeconds,
                refreshAttempts, refreshWindowSeconds,
                tokenCleanupEnabled ? "enabled" : "disabled",
                maxBuckets);
    }

}
