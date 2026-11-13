package com.rho.backend.scheduler;

import com.rho.backend.service.MatchmakingService;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
public class MatchmakingScheduler {

    private final MatchmakingService matchmakingService;

    public MatchmakingScheduler(MatchmakingService matchmakingService) {
        this.matchmakingService = matchmakingService;
    }

    /**
     * Safety net only. Matching is attempted immediately when a player joins the queue
     * (see {@code MatchmakingService.joinQueue}); this sweep forms a partial group once the
     * short gather window has elapsed. It runs every second so that wait stays close to the
     * policy's deadline instead of rounding up to a long poll interval.
     */
    @Scheduled(fixedDelay = 1000)
    public void poll() {
        matchmakingService.pollQueues();
    }
}
