package com.rho.backend.model;

import java.time.LocalDate;

public record StreakState(Integer streak, LocalDate lastPlayedDate, String timezone) {
}
