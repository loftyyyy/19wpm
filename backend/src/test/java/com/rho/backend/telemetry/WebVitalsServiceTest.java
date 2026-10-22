package com.rho.backend.telemetry;

import com.rho.backend.dto.telemetry.WebVitalsRequestDTO;
import com.rho.backend.exception.InvalidResourceException;
import com.rho.backend.service.WebVitalsService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WebVitalsServiceTest {

    private SimpleMeterRegistry registry;
    private WebVitalsService service;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        service = new WebVitalsService(registry);
    }

    @Test
    void recordsMetricWithNormalizedTags() {
        service.record(new WebVitalsRequestDTO(
                "LCP", 1234.5, "good", "navigate", "/solo?time=30"));

        assertThat(registry.get("web.vitals.lcp")
                .tag("rating", "good")
                .tag("path", "/solo")
                .summary()
                .count()).isEqualTo(1);
    }

    @Test
    void normalizesUnknownPathsToOther() {
        service.record(new WebVitalsRequestDTO(
                "CLS", 0.02, "good", "reload", "/race/room-123"));

        assertThat(registry.get("web.vitals.cls")
                .tag("rating", "good")
                .tag("path", "/other")
                .summary()
                .count()).isEqualTo(1);
    }

    @Test
    void rejectsUnsupportedMetric() {
        assertThatThrownBy(() -> service.record(new WebVitalsRequestDTO(
                "unknown", 1, "good", "navigate", "/")))
                .isInstanceOf(InvalidResourceException.class);
    }

    @Test
    void rejectsUnsupportedRating() {
        assertThatThrownBy(() -> service.record(new WebVitalsRequestDTO(
                "LCP", 1, "excellent", "navigate", "/")))
                .isInstanceOf(InvalidResourceException.class);
    }

    @Test
    void rejectsNonFiniteValue() {
        assertThatThrownBy(() -> service.record(new WebVitalsRequestDTO(
                "LCP", Double.NaN, "good", "navigate", "/")))
                .isInstanceOf(InvalidResourceException.class);
    }
}
