package com.rho.backend.race;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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

    private double progressPercent;
    private int currentWpm;
    private int errors;
    private int finishRank;

    public RaceParticipant(Long userId, String username) {
        this.userId = userId;
        this.username = username;
        this.ready = false;
        this.finished = false;
        this.disconnected = false;
        this.progressPercent = 0.0;
        this.currentWpm = 0;
        this.errors = 0;
        this.finishRank = 0;
    }

}
