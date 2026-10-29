package com.rho.backend.multiplayer;

import com.rho.backend.enums.RaceState;
import com.rho.backend.race.RaceEventBus;
import com.rho.backend.race.RaceParticipant;
import com.rho.backend.race.RaceRoom;
import com.rho.backend.race.RaceRoomStore;
import com.rho.backend.service.RaceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class WebSocketDisconnectHandlerTest {

    private static final Long USER_ID = 42L;
    private static final String ROOM_CODE = "ABC123";

    @Mock
    private RaceService raceService;

    @Mock
    private RaceEventBus raceEventBus;

    private InMemoryRaceRoomStore raceRoomStore;
    private WebSocketDisconnectHandler handler;
    private RaceRoom room;

    @BeforeEach
    void setUp() {
        raceRoomStore = new InMemoryRaceRoomStore();
        handler = new WebSocketDisconnectHandler(raceRoomStore, raceService, raceEventBus);

        RaceParticipant participant = new RaceParticipant(USER_ID, "racer");
        participant.setConnected(true);
        participant.setDisconnected(false);

        room = new RaceRoom(ROOM_CODE, null, false, USER_ID);
        room.setState(RaceState.RACING);
        room.setStartTime(java.time.Instant.now());
        room.getParticipants().add(participant);
        raceRoomStore.put(room);
    }

    @Test
    void closingOneOfTwoTabsKeepsParticipantConnected() {
        RaceParticipant participant = room.findParticipant(USER_ID);
        participant.addSession("tab-a");
        participant.addSession("tab-b");

        handler.handleDisconnect(disconnectEvent("tab-a"));

        assertThat(participant.isDisconnected()).isFalse();
        assertThat(participant.isConnected()).isTrue();
        assertThat(participant.getSessionIds()).containsExactly("tab-b");
        verify(raceEventBus, never()).broadcast(anyString(), any());
    }

    @Test
    void closingTheLastTabMarksParticipantDisconnected() {
        RaceParticipant participant = room.findParticipant(USER_ID);
        participant.addSession("tab-a");
        participant.addSession("tab-b");

        handler.handleDisconnect(disconnectEvent("tab-a"));
        handler.handleDisconnect(disconnectEvent("tab-b"));

        assertThat(participant.isDisconnected()).isTrue();
        assertThat(participant.isConnected()).isFalse();
        verify(raceEventBus).broadcast("/topic/room/" + ROOM_CODE, room);
    }

    @Test
    void unknownSessionDoesNotDisconnectTrackedParticipant() {
        RaceParticipant participant = room.findParticipant(USER_ID);
        participant.addSession("tab-a");

        handler.handleDisconnect(disconnectEvent("some-stale-session"));

        assertThat(participant.isDisconnected()).isFalse();
        assertThat(participant.getSessionIds()).containsExactly("tab-a");
        verify(raceEventBus, never()).broadcast(anyString(), any());
    }

    private SessionDisconnectEvent disconnectEvent(String sessionId) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.DISCONNECT);
        accessor.setSessionId(sessionId);
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("userId", USER_ID);
        attributes.put("roomCode", ROOM_CODE);
        accessor.setSessionAttributes(attributes);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
        return new SessionDisconnectEvent(this, message, sessionId, CloseStatus.NO_STATUS_CODE);
    }

    private static final class InMemoryRaceRoomStore implements RaceRoomStore {

        private final Map<String, RaceRoom> rooms = new HashMap<>();

        @Override
        public Optional<RaceRoom> get(String roomCode) {
            return Optional.ofNullable(rooms.get(roomCode));
        }

        @Override
        public boolean exists(String roomCode) {
            return rooms.containsKey(roomCode);
        }

        @Override
        public void put(RaceRoom room) {
            rooms.put(room.getRoomCode(), room);
        }

        @Override
        public void persist(RaceRoom room) {
            put(room);
        }

        @Override
        public void remove(String roomCode) {
            rooms.remove(roomCode);
        }

        @Override
        public <T> Optional<T> mutate(String roomCode, Function<RaceRoom, T> mutation) {
            RaceRoom room = rooms.get(roomCode);
            if (room == null) {
                return Optional.empty();
            }
            return Optional.ofNullable(mutation.apply(room));
        }
    }
}
