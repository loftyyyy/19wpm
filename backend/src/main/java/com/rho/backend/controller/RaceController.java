package com.rho.backend.controller;

import com.rho.backend.service.RaceService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

import java.security.Principal;

@Controller
@RequestMapping("/api/v1/race")
public class RaceController {

    private final RaceService raceService;
    private final SimpMessagingTemplate messagingTemplate;

    public RaceController(RaceService raceService, SimpMessagingTemplate messagingTemplate){
        this.raceService = raceService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/room/{code}/join")
    public void joinRoom(@DestinationVariable String code, Principal principal){
        Long userId = Long.parseLong(principal.getName());
        raceService.joinRoom(code, userId, principal.getName());
    }

    @MessageMapping("/room/{code}/start")
    public void startRoom(){

    }

    @MessageMapping("/room/{code}/progress")
    public void updateProgress(){

    }

    @MessageMapping("/room/{code}/finish")
    public void finishRace(){

    }





}
