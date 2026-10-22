package com.rho.backend.util;

public final class ServerTiming {
    public static final String HEADER = "Server-Timing";

    private ServerTiming() {
    }

    public static String measure(String metric, long startNanos) {
        long elapsedMillis = (System.nanoTime() - startNanos) / 1_000_000;
        return metric + ";dur=" + elapsedMillis;
    }
}
