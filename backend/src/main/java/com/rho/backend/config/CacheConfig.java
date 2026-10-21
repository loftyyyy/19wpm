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
 * <p>Caches the read-mostly text catalogue (see {@link #TEXT_CATALOGUE})
 * and per-language/difficulty word pools (see {@link #WORD_POOLS}). Entries
 * are evicted whenever the underlying content is created or removed.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    public static final String TEXT_CATALOGUE = "textCatalogue";
    public static final String WORD_POOLS = "wordPools";

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(TEXT_CATALOGUE, WORD_POOLS);
        manager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(1_000)
                .expireAfterWrite(Duration.ofMinutes(30)));
        return manager;
    }
}
