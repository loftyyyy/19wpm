package com.rho.backend.controller;

import com.rho.backend.dto.race.FinishMessageDTO;
import com.rho.backend.dto.race.ProgressUpdateDTO;
import com.rho.backend.race.RaceRoom;
import com.rho.backend.service.RaceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Map;

@Controller
public class RaceStompController {

    private static final Logger logger = LoggerFactory.getLogger(RaceStompController.class);

    private final RaceService raceService;
    private final SimpMessagingTemplate messagingTemplate;

    public RaceStompController(RaceService raceService, SimpMessagingTemplate messagingTemplate){
        this.raceService = raceService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/room/{code}/join")
    public void joinRoom(@DestinationVariable String code, Principal principal, SimpMessageHeaderAccessor headerAccessor){
        logger.info("joinRoom called - code: {}, principal: {}", code, principal != null ? principal.getName() : "null");
        Long userId = Long.parseLong(principal.getName());
        raceService.joinRoom(code, userId);
        RaceRoom raceRoom = raceService.markConnected(code, userId, headerAccessor.getSessionId());
        Map<String, Object> attrs = headerAccessor.getSessionAttributes();
        if (attrs != null) {
            attrs.put("roomCode", code);
        }
        messagingTemplate.convertAndSend("/topic/room/" + code, raceRoom);

    }

    @MessageMapping("/room/{code}/start")
    public void startRoom(@DestinationVariable String code, Principal principal){
        Long userId = Long.parseLong(principal.getName());
        RaceRoom raceRoom = raceService.startRoom(code, userId);
        messagingTemplate.convertAndSend("/topic/room/" + code, raceRoom);

        new Thread(() -> {
            try {
                Thread.sleep(RaceService.COUNTDOWN_DURATION_MS);
                RaceRoom racing = raceService.transitionToRacing(code);
                logger.info("Room {} transitioned to RACING at {}", code, racing.getStartTime());
                messagingTemplate.convertAndSend("/topic/room/" + code, racing);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }).start();

    }

    @MessageMapping("/room/{code}/progress")
    public void updateProgress(@DestinationVariable String code, @Payload ProgressUpdateDTO progressUpdateDTO, Principal principal){
        Long userId = Long.parseLong(principal.getName());
        RaceRoom raceRoom = raceService.updateProgress(code, userId, progressUpdateDTO.progressPercent(), progressUpdateDTO.currentWpm(), progressUpdateDTO.typedContent());
        messagingTemplate.convertAndSend("/topic/room/" + code, raceRoom);
    }

    @MessageMapping("/room/{code}/finish")
    public void finishRace(@DestinationVariable String code, @Payload FinishMessageDTO finishMessageDTO, Principal principal){
        Long userId = Long.parseLong(principal.getName());
        RaceRoom raceRoom = raceService.finishRace(code, userId, finishMessageDTO.finalWpm(), finishMessageDTO.errors(), finishMessageDTO.correctChars());
        if (raceRoom != null) {
            messagingTemplate.convertAndSend("/topic/room/" + code, raceRoom);
        }

    }





}
