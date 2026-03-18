package com.rho.backend.service;

import com.rho.backend.model.RefreshToken;
import com.rho.backend.repository.RefreshTokenRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@Transactional
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final UserService userService;

    public RefreshTokenService(RefreshTokenRepository refreshTokenRepository, UserService userService){
        this.refreshTokenRepository = refreshTokenRepository;
        this.userService = userService;
    }

    public void saveRefreshToken(String username, String refreshToken){
        refreshTokenRepository.deleteByUsername(username);

        RefreshToken token = new RefreshToken();
        token.setUsername(username);
        token.setToken(refreshToken);
        token.setCreatedAt(LocalDateTime.now());
        token.setExpiresAt(LocalDateTime.now().plusDays(7));

        refreshTokenRepository.save(token);
    }

    public boolean isRefreshTokenValid(String refreshToken){

    }

}

