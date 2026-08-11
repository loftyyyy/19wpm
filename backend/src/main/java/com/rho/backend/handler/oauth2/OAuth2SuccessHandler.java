package com.rho.backend.handler.oauth2;


import com.rho.backend.config.CustomOAuth2User;
import com.rho.backend.config.OAuth2TimezoneRequestResolver;
import com.rho.backend.model.User;
import com.rho.backend.redis.RedisTokenStore;
import com.rho.backend.repository.UserRepository;
import com.rho.backend.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.ZoneId;
import java.util.Date;

@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {
    private static final Logger logger = LoggerFactory.getLogger(OAuth2SuccessHandler.class);

    private final JwtService jwtService;
    private final RedisTokenStore redisTokenStore;
    private final UserRepository userRepository;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        CustomOAuth2User oAuth2User = (CustomOAuth2User) authentication.getPrincipal();
        User user = oAuth2User.getUser();

        refreshTimezone(request, user);

        String accessToken  = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        Date   refreshExpiry = jwtService.extractExpiration(refreshToken);

        redisTokenStore.storeRefreshToken(user.getUserId(), refreshToken, refreshExpiry);

        String redirectUrl = frontendUrl + "/oauth2/callback"
                + "?accessToken="  + accessToken
                + "&refreshToken=" + refreshToken;
        response.sendRedirect(redirectUrl);
    }

    private void refreshTimezone(HttpServletRequest request, User user) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return;
        }
        String timezone = (String) session.getAttribute(OAuth2TimezoneRequestResolver.SESSION_ATTR);
        if (timezone == null || timezone.isBlank()) {
            return;
        }
        String resolved = resolveTimezone(timezone);
        if (user.getTimezone() == null || !user.getTimezone().equals(resolved)) {
            user.setTimezone(resolved);
            userRepository.save(user);
        }
    }

    private String resolveTimezone(String timezone) {
        try {
            return ZoneId.of(timezone.trim()).getId();
        } catch (Exception e) {
            logger.debug("Invalid timezone '{}', falling back to UTC", timezone);
            return "UTC";
        }
    }
}
