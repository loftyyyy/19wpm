package com.rho.backend.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Enables Spring's cache abstraction backed by Caffeine.
 *
 * <p>Only the read-mostly text catalogue is cached for now (see
 * {@link #TEXT_CATALOGUE}). Entries are evicted whenever a text is
 * created or modified, so the catalogue never serves stale content.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    public static final String TEXT_CATALOGUE = "textCatalogue";

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(TEXT_CATALOGUE);
        manager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(1_000)
                .expireAfterWrite(Duration.ofMinutes(30)));
        return manager;
    }
}
