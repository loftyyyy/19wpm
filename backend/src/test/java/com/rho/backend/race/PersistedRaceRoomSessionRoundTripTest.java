package com.rho.backend.race;

import com.rho.backend.enums.RaceState;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class PersistedRaceRoomSessionRoundTripTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void sessionIdsSurviveRedisRoundTripButStayHiddenFromClients() {
        RaceParticipant participant = new RaceParticipant(7L, "racer");
        participant.setConnected(true);
        participant.addSession("tab-a");
        participant.addSession("tab-b");

        RaceRoom room = new RaceRoom("ROOM01", null, false, 7L);
        room.setState(RaceState.RACING);
        room.setStartTime(Instant.now());
        room.getParticipants().add(participant);

        // Persisted form round-trips through JSON exactly like RaceRoomRepository does.
        String persistedJson = objectMapper.writeValueAsString(PersistedRaceRoom.from(room));
        PersistedRaceRoom rehydrated = objectMapper.readValue(persistedJson, PersistedRaceRoom.class);
        RaceRoom rebuilt = rehydrated.toRoom(null);

        assertThat(rebuilt.findParticipant(7L).getSessionIds()).containsExactlyInAnyOrder("tab-a", "tab-b");

        // The client-facing room broadcast must never expose the internal session ids.
        String broadcastJson = objectMapper.writeValueAsString(rebuilt);
        assertThat(broadcastJson).doesNotContain("tab-a").doesNotContain("tab-b");
        assertThat(broadcastJson).doesNotContain("sessionIds").doesNotContain("sessionId");
    }
}
