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

    @Scheduled(fixedRate = 2000)
    public void poll() {
        matchmakingService.pollQueues();
    }
}
