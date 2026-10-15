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
     * Safety net only. Matching now happens immediately when a player joins the queue
     * (see {@code MatchmakingService.joinQueue}); this periodic sweep just catches any
     * players that were left unmatched. Hence the low frequency.
     */
    @Scheduled(fixedRate = 10000)
    public void poll() {
        matchmakingService.pollQueues();
    }
}
