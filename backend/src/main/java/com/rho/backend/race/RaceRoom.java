package com.rho.backend.race;


import com.rho.backend.dto.text.response.TextResponseDTO;
import com.rho.backend.enums.TextType;
import com.rho.backend.enums.RaceState;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Setter
@Getter
public class RaceRoom implements Serializable {

    private String roomCode;
    private RaceState state;
    private boolean isPrivate;
    private TextType textType;
    private TextResponseDTO text;

    private Long hostUserId;          // null for public matchmaking rooms
    private List<RaceParticipant> participants;

    private Instant startTime;        // set when RACING begins, used for WPM calc
    private int finishCount;          // how many players have finished

    private Instant countdownStartTime;   // set when COUNTDOWN begins, drives the server-authoritative countdown
    private long countdownDurationMs;     // how long COUNTDOWN lasts before RACING

    public RaceRoom() {
        this.participants = new ArrayList<>();
        this.finishCount = 0;
    }

    public RaceRoom(String roomCode, TextType textType, boolean isPrivate, Long hostUserId) {
        this();
        this.roomCode = roomCode;
        this.textType = textType;
        this.isPrivate = isPrivate;
        this.hostUserId = hostUserId;
        this.state = RaceState.LOBBY;
    }

    // Convenience methods
    public boolean isHost(Long userId) {
        return userId != null && userId.equals(hostUserId);
    }

    public RaceParticipant findParticipant(Long userId) {
        return participants.stream()
                .filter(p -> p.getUserId().equals(userId))
                .findFirst()
                .orElse(null);
    }

    public List<RaceParticipant> activeParticipants() {
        return participants.stream()
                .filter(p -> !p.isDisconnected())
                .toList();
    }

    public boolean allActiveFinished() {
        List<RaceParticipant> active = activeParticipants();
        return !active.isEmpty() && active.stream().allMatch(RaceParticipant::isFinished);
    }

}
