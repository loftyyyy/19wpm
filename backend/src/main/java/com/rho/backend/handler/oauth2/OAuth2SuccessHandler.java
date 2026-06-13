package com.rho.backend.handler.oauth2;


import com.rho.backend.config.CustomOAuth2User;
import com.rho.backend.model.User;
import com.rho.backend.redis.RedisTokenStore;
import com.rho.backend.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Date;

@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {
    private final JwtService jwtService;
    private final RedisTokenStore redisTokenStore;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        CustomOAuth2User oAuth2User = (CustomOAuth2User) authentication.getPrincipal();
        User user = oAuth2User.getUser();
        String accessToken  = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        Date   refreshExpiry = jwtService.extractExpiration(refreshToken);

        redisTokenStore.storeRefreshToken(user.getUserId(), refreshToken, refreshExpiry);

        String redirectUrl = frontendUrl + "/oauth2/callback"
                + "?accessToken="  + accessToken
                + "&refreshToken=" + refreshToken;
        response.sendRedirect(redirectUrl);
    }
}
