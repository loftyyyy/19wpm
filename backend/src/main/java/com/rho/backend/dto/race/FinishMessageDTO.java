package com.rho.backend.dto.race;

import java.util.List;

public record FinishMessageDTO(
        int finalWpm,
        int errors,
        int correctChars,
        List<Integer> keyIntervalsMs
) {}
