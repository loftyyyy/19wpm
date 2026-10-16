package com.rho.backend.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Short-lived cache in front of {@link UserDetailsService} for the authentication hot paths.
 *
 * <p>Every authenticated HTTP request and every STOMP CONNECT otherwise reloads the user (and its
 * role) from the database. Resolved {@link UserDetails} are cached per email for a short TTL so the
 * per-request database read disappears, while account or role changes still take effect within the
 * TTL.
 *
 * <p>Failures are never cached: a missing user keeps throwing
 * {@link org.springframework.security.core.userdetails.UsernameNotFoundException}, so deleted
 * accounts are still rejected. Only read-only consumers (the JWT filter and the STOMP channel
 * interceptor) use this cache — the login flow resolves a fresh, mutable entity through the
 * authentication manager because it updates the user's timezone on each login.
 */
@Component
public class UserDetailsCache {

    private static final Duration TTL = Duration.ofSeconds(60);

    private final UserDetailsService delegate;

    private final Cache<String, UserDetails> cache = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(TTL)
            .build();

    public UserDetailsCache(UserDetailsService delegate) {
        this.delegate = delegate;
    }

    public UserDetails get(String email) {
        UserDetails cached = cache.getIfPresent(email);
        if (cached != null) {
            return cached;
        }
        UserDetails loaded = delegate.loadUserByUsername(email);
        cache.put(email, loaded);
        return loaded;
    }
}
