package com.rho.backend.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ServerTimingTest {

    @Test
    void formatsMetricWithDurationInMilliseconds() {
        long startNanos = System.nanoTime() - 5_000_000;

        assertThat(ServerTiming.measure("words", startNanos)).matches("words;dur=\\d+");
    }
}
