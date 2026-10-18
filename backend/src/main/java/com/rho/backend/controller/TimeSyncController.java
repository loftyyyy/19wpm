package com.rho.backend.controller;

import com.rho.backend.dto.time.TimeSyncRequestDTO;
import com.rho.backend.dto.time.TimeSyncResponseDTO;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
public class TimeSyncController {

    private final SimpMessagingTemplate messagingTemplate;

    public TimeSyncController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/time")
    public void sync(@Payload TimeSyncRequestDTO request, Principal principal) {
        long serverReceivedAt = System.currentTimeMillis();
        long serverSentAt = System.currentTimeMillis();
        messagingTemplate.convertAndSendToUser(
                principal.getName(),
                "/queue/time",
                new TimeSyncResponseDTO(request.clientSentAt(), serverReceivedAt, serverSentAt));
    }
}
