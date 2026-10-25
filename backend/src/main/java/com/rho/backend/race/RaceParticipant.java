package com.rho.backend.race;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.rho.backend.enums.AntiCheatStatus;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@NoArgsConstructor
@Getter
@Setter
public class RaceParticipant implements Serializable {

    private Long userId;
    private String username;
    private boolean ready;
    private boolean finished;
    private boolean disconnected;
    private boolean connected;
    /**
     * Live WebSocket sessions currently attached to this participant. A single account can open
     * several tabs, so a participant is only considered gone once every tracked session has
     * disconnected. {@code @JsonIgnore} keeps the internal session ids out of client broadcasts;
     * they are persisted separately by {@link PersistedRaceRoom}.
     */
    @JsonIgnore
    private Set<String> sessionIds = ConcurrentHashMap.newKeySet();

    private double progressPercent;
    private int currentWpm;
    private int errors;
    private int correctChars;
    private int accuracy;      // 0-100, computed server-side from correctChars + errors
    private int finishRank;

    private int serverWpm;     // recomputed from correctChars and server-observed duration
    private int claimedWpm;    // value reported by the client, kept for audit
    private AntiCheatStatus antiCheatStatus = AntiCheatStatus.VALID;
    private List<String> antiCheatFlags = new ArrayList<>();

    @JsonIgnore
    private Integer latestStreak;

    public RaceParticipant(Long userId, String username) {
        this.userId = userId;
        this.username = username;
        this.ready = false;
        this.finished = false;
        this.disconnected = false;
        this.connected = false;
        this.progressPercent = 0.0;
        this.currentWpm = 0;
        this.errors = 0;
        this.correctChars = 0;
        this.accuracy = 0;
        this.finishRank = 0;
    }

    public void addSession(String sessionId) {
        if (sessionId != null && !sessionId.isBlank()) {
            sessionIds.add(sessionId);
        }
    }

    public void removeSession(String sessionId) {
        if (sessionId != null) {
            sessionIds.remove(sessionId);
        }
    }

    public boolean hasActiveSession() {
        return !sessionIds.isEmpty();
    }

}
