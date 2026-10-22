package com.rho.backend.service;

import com.rho.backend.dto.telemetry.WebVitalsRequestDTO;
import com.rho.backend.exception.InvalidResourceException;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Set;

@Service
public class WebVitalsService {

    private static final Set<String> METRICS = Set.of(
            "lcp", "inp", "cls", "fcp", "ttfb", "start-typing");
    private static final Set<String> RATINGS = Set.of(
            "good", "needs-improvement", "poor");
    private static final Set<String> KNOWN_PATHS = Set.of(
            "/", "/about", "/compete", "/create", "/dashboard", "/leaderboard",
            "/login", "/oauth2/callback", "/race", "/results", "/solo");
    private static final String OTHER_PATH = "/other";
    private static final double MAX_VALUE = 3_600_000d;

    private final MeterRegistry meterRegistry;

    public WebVitalsService(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    public void record(WebVitalsRequestDTO request) {
        String metric = normalize(request.name());
        if (!METRICS.contains(metric)) {
            throw new InvalidResourceException("Unsupported web vital metric");
        }

        String rating = normalize(request.rating());
        if (!RATINGS.contains(rating)) {
            throw new InvalidResourceException("Unsupported web vital rating");
        }

        double value = request.value();
        if (!Double.isFinite(value) || value < 0 || value > MAX_VALUE) {
            throw new InvalidResourceException("Invalid web vital value");
        }

        meterRegistry.summary(
                        "web.vitals." + metric,
                        "rating", rating,
                        "path", normalizePath(request.path()))
                .record(value);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizePath(String rawPath) {
        String path = rawPath == null ? "" : rawPath.trim();
        int queryIndex = path.indexOf('?');
        int fragmentIndex = path.indexOf('#');
        int cutIndex = queryIndex < 0
                ? fragmentIndex
                : fragmentIndex < 0 ? queryIndex : Math.min(queryIndex, fragmentIndex);
        if (cutIndex >= 0) {
            path = path.substring(0, cutIndex);
        }

        while (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }

        return KNOWN_PATHS.contains(path) ? path : OTHER_PATH;
    }
}
