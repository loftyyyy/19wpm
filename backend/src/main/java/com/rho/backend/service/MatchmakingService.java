package com.rho.backend.service;

import com.rho.backend.enums.TextType;

public class MatchmakingService {

    public void joinQueue(){

    }

    private String queueKey(TextType textType) {
        return "matchmaking:queue:" + textType.name();
    }

    private String playerKey(Long userId) {
        return "matchmaking:player:" + userId;
    }
}
