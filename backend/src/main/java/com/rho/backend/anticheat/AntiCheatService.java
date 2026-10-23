package com.rho.backend.anticheat;

import com.rho.backend.enums.AntiCheatStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Server-side finish validation. The client's WPM is never trusted: the persisted value is always
 * recomputed from {@code correctChars} and the server-observed race duration. Keystroke intervals
 * (when present) are used as a second signal for automated input.
 */
@Service
public class AntiCheatService {

    public static final int MAX_INTERVALS = 2_000;

    static final String IMPOSSIBLE_WPM = "IMPOSSIBLE_WPM";
    static final String RACE_TOO_SHORT = "RACE_TOO_SHORT";
    static final String IMPOSSIBLE_INTERVAL = "IMPOSSIBLE_INTERVAL";
    static final String AUTOMATED_INTERVAL_SIGNATURE = "AUTOMATED_INTERVAL_SIGNATURE";
    static final String REPETITIVE_INTERVAL_SIGNATURE = "REPETITIVE_INTERVAL_SIGNATURE";
    static final String WPM_MISMATCH = "WPM_MISMATCH";
    static final String HIGH_WPM = "HIGH_WPM";
    static final String MISSING_KEYSTROKE_TELEMETRY = "MISSING_KEYSTROKE_TELEMETRY";
    static final String LOW_INTERVAL_VARIANCE = "LOW_INTERVAL_VARIANCE";
    static final String REPETITIVE_INTERVALS = "REPETITIVE_INTERVALS";

    public Verdict assess(
            Instant startedAt,
            Instant finishedAt,
            int claimedWpm,
            int correctChars,
            int errors,
            List<Integer> intervals) {
        long elapsedMs = Math.max(1L, Duration.between(startedAt, finishedAt).toMillis());
        int serverWpm = computeWpm(correctChars, elapsedMs);

        Set<String> severe = new LinkedHashSet<>();
        Set<String> suspicious = new LinkedHashSet<>();

        if (serverWpm >= 300 || claimedWpm >= 300) {
            severe.add(IMPOSSIBLE_WPM);
        } else if (serverWpm >= 220) {
            suspicious.add(HIGH_WPM);
        }

        if (elapsedMs < 3_000 && correctChars > 10) {
            severe.add(RACE_TOO_SHORT);
        }

        if (claimedWpm > serverWpm + 25 && claimedWpm > serverWpm * 1.25) {
            suspicious.add(WPM_MISMATCH);
        }

        List<Integer> sample = intervals == null ? List.of() : intervals;
        if (sample.size() > MAX_INTERVALS) {
            sample = sample.subList(0, MAX_INTERVALS);
        }
        if (sample.size() < 10) {
            if (serverWpm >= 150) {
                suspicious.add(MISSING_KEYSTROKE_TELEMETRY);
            }
        } else {
            assessIntervals(sample, severe, suspicious);
        }

        if (!severe.isEmpty()) {
            return verdict(AntiCheatStatus.DISQUALIFIED, severe, suspicious, serverWpm, claimedWpm, elapsedMs);
        }
        if (!suspicious.isEmpty()) {
            return verdict(AntiCheatStatus.QUARANTINED, severe, suspicious, serverWpm, claimedWpm, elapsedMs);
        }
        return new Verdict(AntiCheatStatus.VALID, List.of(), serverWpm, claimedWpm, elapsedMs);
    }

    private void assessIntervals(List<Integer> intervals, Set<String> severe, Set<String> suspicious) {
        double mean = intervals.stream().mapToInt(Integer::intValue).average().orElse(0);
        double variance = intervals.stream()
                .mapToDouble(interval -> Math.pow(interval - mean, 2))
                .average()
                .orElse(0);
        double coefficient = mean <= 0 ? 0 : Math.sqrt(variance) / mean;

        if (intervals.size() >= 30) {
            if (coefficient < 0.03) {
                severe.add(AUTOMATED_INTERVAL_SIGNATURE);
            } else if (coefficient < 0.08) {
                suspicious.add(LOW_INTERVAL_VARIANCE);
            }
        }

        long tooFast = intervals.stream().filter(interval -> interval >= 0 && interval < 10).count();
        if (tooFast * 100 > intervals.size() * 10) {
            severe.add(IMPOSSIBLE_INTERVAL);
        }

        long repeats = 0;
        for (int i = 1; i < intervals.size(); i++) {
            if (intervals.get(i).equals(intervals.get(i - 1))) {
                repeats++;
            }
        }
        double repeatRatio = (double) repeats / (intervals.size() - 1);
        if (repeatRatio > 0.80) {
            severe.add(REPETITIVE_INTERVAL_SIGNATURE);
        } else if (repeatRatio > 0.65) {
            suspicious.add(REPETITIVE_INTERVALS);
        }
    }

    private Verdict verdict(
            AntiCheatStatus status,
            Set<String> severe,
            Set<String> suspicious,
            int serverWpm,
            int claimedWpm,
            long elapsedMs) {
        List<String> flags = new ArrayList<>(severe);
        suspicious.stream().filter(flag -> !severe.contains(flag)).forEach(flags::add);
        return new Verdict(status, List.copyOf(flags), serverWpm, claimedWpm, elapsedMs);
    }

    private int computeWpm(int correctChars, long elapsedMs) {
        if (correctChars <= 0) {
            return 0;
        }
        double minutes = elapsedMs / 60_000.0;
        return (int) Math.round((correctChars / 5.0) / minutes);
    }

    public record Verdict(
            AntiCheatStatus status,
            List<String> flags,
            int serverWpm,
            int claimedWpm,
            long elapsedMs) {
    }
}
