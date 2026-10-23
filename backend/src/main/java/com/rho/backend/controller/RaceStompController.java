package com.rho.backend.controller;

import com.rho.backend.dto.race.FinishMessageDTO;
import com.rho.backend.dto.race.ProgressUpdateDTO;
import com.rho.backend.dto.race.RaceFinishStreakDTO;
import com.rho.backend.dto.race.RaceProgressDTO;
import com.rho.backend.enums.RaceState;
import com.rho.backend.race.RaceEventBus;
import com.rho.backend.race.RaceParticipant;
import com.rho.backend.race.RaceRoom;
import com.rho.backend.scheduler.RaceCountdownScheduler;
import com.rho.backend.service.RaceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Map;

@Controller
public class RaceStompController {

    private static final Logger logger = LoggerFactory.getLogger(RaceStompController.class);

    private final RaceService raceService;
    private final RaceEventBus raceEventBus;
    private final RaceCountdownScheduler countdownScheduler;

    public RaceStompController(RaceService raceService, RaceEventBus raceEventBus, RaceCountdownScheduler countdownScheduler) {
        this.raceService = raceService;
        this.raceEventBus = raceEventBus;
        this.countdownScheduler = countdownScheduler;
    }

    @MessageMapping("/room/{code}/join")
    public void joinRoom(@DestinationVariable String code, Principal principal, SimpMessageHeaderAccessor headerAccessor) {
        logger.info("joinRoom called - code: {}, principal: {}", code, principal != null ? principal.getName() : "null");
        Long userId = Long.parseLong(principal.getName());
        raceService.joinRoom(code, userId);
        RaceRoom raceRoom = raceService.markConnected(code, userId, headerAccessor.getSessionId());
        Map<String, Object> attrs = headerAccessor.getSessionAttributes();
        if (attrs != null) {
            attrs.put("roomCode", code);
        }
        raceEventBus.broadcast("/topic/room/" + code, raceRoom);
        // Targeted snapshot lets a reconnecting client restore state even if it missed a
        // lifecycle broadcast while its WebSocket was down.
        raceEventBus.sendToUser(userId, "/queue/race-resume", raceRoom);
    }

    @MessageMapping("/room/{code}/start")
    public void startRoom(@DestinationVariable String code, Principal principal) {
        Long userId = Long.parseLong(principal.getName());
        RaceRoom raceRoom = raceService.startRoom(code, userId);
        raceEventBus.broadcast("/topic/room/" + code, raceRoom);

        if (raceRoom.getState() == RaceState.COUNTDOWN
                && raceRoom.getCountdownStartTime() != null) {
            countdownScheduler.schedule(
                    code,
                    raceRoom.getCountdownStartTime().plusMillis(raceRoom.getCountdownDurationMs()));
        }
    }

    @MessageMapping("/room/{code}/progress")
    public void updateProgress(@DestinationVariable String code, @Payload ProgressUpdateDTO progressUpdateDTO, Principal principal) {
        Long userId = Long.parseLong(principal.getName());
        RaceProgressDTO progress = raceService.updateProgress(code, userId, progressUpdateDTO.progressPercent(), progressUpdateDTO.currentWpm(), progressUpdateDTO.errors());
        // Broadcast only the delta on the high-frequency path; full room state is reserved
        // for lifecycle events (join / start / racing / finish / disconnect).
        raceEventBus.broadcast("/topic/room/" + code + "/progress", progress);
    }

    @MessageMapping("/room/{code}/finish")
    public void finishRace(@DestinationVariable String code, @Payload FinishMessageDTO finishMessageDTO, Principal principal) {
        Long userId = Long.parseLong(principal.getName());
        RaceService.RaceFinishOutcome outcome = raceService.finishRace(code, userId, finishMessageDTO.finalWpm(), finishMessageDTO.errors(), finishMessageDTO.correctChars());
        if (outcome == null) {
            return;
        }

        RaceRoom raceRoom = outcome.room();
        raceEventBus.broadcast("/topic/room/" + code, raceRoom);

        RaceParticipant participant = raceRoom.findParticipant(userId);
        if (participant != null && participant.getLatestStreak() != null) {
            raceEventBus.sendToUser(userId, "/queue/race-finish", new RaceFinishStreakDTO(participant.getLatestStreak()));
        }
    }
}
