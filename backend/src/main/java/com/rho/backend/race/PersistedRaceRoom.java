package com.rho.backend.race;

import com.rho.backend.dto.text.response.TextResponseDTO;
import com.rho.backend.enums.RaceState;
import com.rho.backend.enums.TextType;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Durable, Redis-serialized view of a {@link RaceRoom}.
 *
 * <p>The live model carries the full {@link TextResponseDTO} (passage content) so progress can be
 * validated in memory without a round-trip. That content is immutable and owned by the text
 * catalogue, so the durable form keeps only {@code textId} and rehydrates the passage on load
 * instead of storing it once per room and rewriting it on every lifecycle transition.
 */
public record PersistedRaceRoom(
        String roomCode,
        RaceState state,
        boolean isPrivate,
        TextType textType,
        Long textId,
        Long hostUserId,
        List<RaceParticipant> participants,
        Instant startTime,
        int finishCount,
        Instant countdownStartTime,
        long countdownDurationMs,
        int durationSeconds
) {

    public static PersistedRaceRoom from(RaceRoom room) {
        TextResponseDTO text = room.getText();
        return new PersistedRaceRoom(
                room.getRoomCode(),
                room.getState(),
                room.isPrivate(),
                room.getTextType(),
                text == null ? null : text.textId(),
                room.getHostUserId(),
                room.getParticipants(),
                room.getStartTime(),
                room.getFinishCount(),
                room.getCountdownStartTime(),
                room.getCountdownDurationMs(),
                room.getDurationSeconds());
    }

    public RaceRoom toRoom(TextResponseDTO text) {
        RaceRoom room = new RaceRoom();
        room.setRoomCode(roomCode);
        room.setState(state);
        room.setPrivate(isPrivate);
        room.setTextType(textType);
        room.setText(text);
        room.setHostUserId(hostUserId);
        // CopyOnWriteArrayList keeps broadcasts safe against concurrent joins after rehydration.
        room.setParticipants(participants == null ? new CopyOnWriteArrayList<>() : new CopyOnWriteArrayList<>(participants));
        room.setStartTime(startTime);
        room.setFinishCount(finishCount);
        room.setCountdownStartTime(countdownStartTime);
        room.setCountdownDurationMs(countdownDurationMs);
        room.setDurationSeconds(durationSeconds);
        return room;
    }
}
