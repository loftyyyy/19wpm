package com.rho.backend.race;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.io.Serializable;

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
    @JsonIgnore
    private String sessionId;

    private double progressPercent;
    private int currentWpm;
    private int errors;
    private int correctChars;
    private int accuracy;      // 0-100, computed server-side from correctChars + errors
    private int finishRank;

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

}
