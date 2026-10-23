package com.rho.backend.multiplayer;

import com.rho.backend.enums.RaceState;
import com.rho.backend.race.RaceEventBus;
import com.rho.backend.race.RaceParticipant;
import com.rho.backend.race.RaceRoom;
import com.rho.backend.race.RaceRoomStore;
import com.rho.backend.service.RaceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.Duration;
import java.time.Instant;

@Component
public class WebSocketDisconnectHandler {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketDisconnectHandler.class);

    private final RaceRoomStore raceRoomStore;
    private final RaceService raceService;
    private final RaceEventBus raceEventBus;

    public WebSocketDisconnectHandler(
            RaceRoomStore raceRoomStore,
            RaceService raceService,
            RaceEventBus raceEventBus) {
        this.raceRoomStore = raceRoomStore;
        this.raceService = raceService;
        this.raceEventBus = raceEventBus;
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
        boolean[] roomFinished = {false};

        RaceRoom room = raceRoomStore.mutate(roomCode, currentRoom -> {
            RaceParticipant participant = currentRoom.findParticipant(userId);
            if (participant == null || participant.isDisconnected()) {
                return null;
            }

            String currentSessionId = participant.getSessionId();
            if (currentSessionId != null && !currentSessionId.equals(sessionId)) {
                logger.info("Ignoring stale disconnect for userId {} (session {} != current {})", userId, sessionId, currentSessionId);
                return null;
            }

            participant.setDisconnected(true);
            participant.setConnected(false);

            if (currentRoom.getState() == RaceState.RACING && currentRoom.allActiveFinished()) {
                currentRoom.setState(RaceState.FINISHED);
                currentRoom.setDurationSeconds((int) Math.max(0,
                        Duration.between(currentRoom.getStartTime(), Instant.now()).toSeconds()));
                roomFinished[0] = true;
            }
            return currentRoom;
        }).orElse(null);

        if (room == null) {
            return;
        }

        raceEventBus.broadcast("/topic/room/" + roomCode, room);
        if (roomFinished[0]) {
            raceService.persistRacePublic(room);
        }
        logger.info("Marked userId {} as disconnected in room {}", userId, roomCode);
    }
}
