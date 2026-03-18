package com.rho.backend.service;

import com.github.benmanes.caffeine.cache.Cache;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class RateLimitingService {

    private Cache<String, Bucket> buckets;

    @Value("${}")
    private int loginAttempts;

    @Value("${}")
    private int loginWindowSeconds;

    @Value("${}")
    private int refreshAttempts;

    @Value("${}")
    private int refreshWindowSeconds;

    @Value("${}")
    private boolean tokenCleanupEnabled;

    @Value("${}")
    private long retentionHours;

    @Value("${}")
    private long maxBuckets;

    private Bandwidth loginBandwidth;
    private Bandwidth refreshBandwidth;

    @PostConstruct
    public void init(){


    }


}
