package com.rho.backend.multiplayer;

import com.rho.backend.enums.RaceState;
import com.rho.backend.race.RaceParticipant;
import com.rho.backend.race.RaceRoom;
import com.rho.backend.repository.RaceRoomRepository;
import com.rho.backend.service.RaceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Component
public class WebSocketDisconnectHandler {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketDisconnectHandler.class);

    private final RaceRoomRepository raceRoomRepository;
    private final RaceService raceService;
    private final SimpMessagingTemplate messagingTemplate;

    public WebSocketDisconnectHandler(
            RaceRoomRepository raceRoomRepository,
            RaceService raceService,
            SimpMessagingTemplate messagingTemplate) {
        this.raceRoomRepository = raceRoomRepository;
        this.raceService = raceService;
        this.messagingTemplate = messagingTemplate;
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());

        var attrs = accessor.getSessionAttributes();
        if (attrs == null) return;

        Object userIdObj = attrs.get("userId");
        if (userIdObj == null) return;

        Long userId = (userIdObj instanceof Long)
                ? (Long) userIdObj
                : Long.parseLong(userIdObj.toString());

        logger.info("WebSocket disconnect for userId: {}", userId);

        Object roomCodeObj = attrs.get("roomCode");
        if (roomCodeObj == null) return;
        String roomCode = roomCodeObj.toString();

        String sessionId = accessor.getSessionId();

        raceRoomRepository.findByCode(roomCode).ifPresent(room -> {
            RaceParticipant participant = room.findParticipant(userId);
            if (participant == null) return;
            if (participant.isDisconnected()) return;

            String currentSessionId = participant.getSessionId();
            if (currentSessionId != null && !currentSessionId.equals(sessionId)) {
                logger.info("Ignoring stale disconnect for userId {} (session {} != current {})", userId, sessionId, currentSessionId);
                return;
            }

            participant.setDisconnected(true);
            participant.setConnected(false);
            raceRoomRepository.save(room);

            messagingTemplate.convertAndSend("/topic/room/" + roomCode, room);

            if (room.getState() == RaceState.RACING && room.allActiveFinished()) {
                room.setState(RaceState.FINISHED);
                raceRoomRepository.save(room);
                raceService.persistRacePublic(room);
                messagingTemplate.convertAndSend("/topic/room/" + roomCode, room);
            }

            logger.info("Marked userId {} as disconnected in room {}", userId, roomCode);
        });
    }
}
