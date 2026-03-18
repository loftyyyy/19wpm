package com.rho.backend.service;

import com.rho.backend.model.RefreshToken;
import com.rho.backend.repository.RefreshTokenRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

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
        Optional<RefreshToken> tokenEntity = refreshTokenRepository.findByToken(refreshToken);

        if(tokenEntity.isEmpty()){
            return false;
        }

        RefreshToken token = tokenEntity.get();

        if(token.getExpiresAt().isBefore(LocalDateTime.now())){
            refreshTokenRepository.delete(token);
            return false;
        }

        return true;
    }

    public String getUsernameFromRefreshToken(String refreshToken) {
        Optional<RefreshToken> tokenEntity = refreshTokenRepository.findByToken(refreshToken);
        return tokenEntity.map(RefreshToken::getUsername).orElse(null);
    }

    public void deleteRefreshToken(String refreshToken) {
        refreshTokenRepository.deleteByToken(refreshToken);
    }

    public void deleteAllUserRefreshTokens(String username) {
        refreshTokenRepository.deleteByUsername(username);
    }

}

