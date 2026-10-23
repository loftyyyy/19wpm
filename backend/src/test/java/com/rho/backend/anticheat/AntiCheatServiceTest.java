package com.rho.backend.anticheat;

import com.rho.backend.enums.AntiCheatStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class AntiCheatServiceTest {

    private static final Instant START = Instant.parse("2026-10-23T10:00:00Z");
    private final AntiCheatService service = new AntiCheatService();

    private static List<Integer> variedIntervals(int count) {
        return IntStream.range(0, count)
                .map(i -> 100 + (i * 37) % 90)
                .boxed()
                .toList();
    }

    @Test
    @DisplayName("Accepts a human-paced finish with varied keystroke intervals")
    void acceptsHumanFinish() {
        var verdict = service.assess(START, START.plusSeconds(40), 100, 333, 4, variedIntervals(40));

        assertThat(verdict.status()).isEqualTo(AntiCheatStatus.VALID);
        assertThat(verdict.flags()).isEmpty();
        assertThat(verdict.serverWpm()).isEqualTo(100);
    }

    @Test
    @DisplayName("Disqualifies impossible server-side WPM")
    void disqualifiesImpossibleWpm() {
        var verdict = service.assess(START, START.plusSeconds(10), 360, 300, 0, variedIntervals(40));

        assertThat(verdict.status()).isEqualTo(AntiCheatStatus.DISQUALIFIED);
        assertThat(verdict.flags()).contains(AntiCheatService.IMPOSSIBLE_WPM);
        assertThat(verdict.serverWpm()).isEqualTo(360);
    }

    @Test
    @DisplayName("Disqualifies perfectly regular keystroke intervals")
    void disqualifiesAutomatedIntervals() {
        List<Integer> intervals = Collections.nCopies(40, 50);

        var verdict = service.assess(START, START.plusSeconds(30), 120, 300, 0, intervals);

        assertThat(verdict.status()).isEqualTo(AntiCheatStatus.DISQUALIFIED);
        assertThat(verdict.flags())
                .contains(AntiCheatService.AUTOMATED_INTERVAL_SIGNATURE)
                .contains(AntiCheatService.REPETITIVE_INTERVAL_SIGNATURE);
    }

    @Test
    @DisplayName("Quarantines a fast finish without keystroke telemetry")
    void quarantinesMissingTelemetry() {
        var verdict = service.assess(START, START.plusSeconds(30), 180, 450, 0, List.of());

        assertThat(verdict.status()).isEqualTo(AntiCheatStatus.QUARANTINED);
        assertThat(verdict.flags()).contains(AntiCheatService.MISSING_KEYSTROKE_TELEMETRY);
    }

    @Test
    @DisplayName("Quarantines a claimed WPM far above the server calculation")
    void quarantinesWpmMismatch() {
        var verdict = service.assess(START, START.plusSeconds(60), 200, 300, 0, variedIntervals(40));

        assertThat(verdict.status()).isEqualTo(AntiCheatStatus.QUARANTINED);
        assertThat(verdict.flags()).contains(AntiCheatService.WPM_MISMATCH);
        assertThat(verdict.serverWpm()).isEqualTo(60);
    }

    @Test
    @DisplayName("Disqualifies a finish shorter than the minimum race window")
    void disqualifiesImpossiblyShortRace() {
        var verdict = service.assess(START, START.plusSeconds(2), 120, 20, 0, variedIntervals(20));

        assertThat(verdict.status()).isEqualTo(AntiCheatStatus.DISQUALIFIED);
        assertThat(verdict.flags()).contains(AntiCheatService.RACE_TOO_SHORT);
    }
}
