package com.rho.backend.handler.oauth2;


import com.rho.backend.config.CustomOAuth2User;
import com.rho.backend.config.OAuth2TimezoneRequestResolver;
import com.rho.backend.model.User;
import com.rho.backend.redis.RedisTokenStore;
import com.rho.backend.repository.UserRepository;
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
import java.security.SecureRandom;
import java.time.Duration;
import java.time.ZoneId;
import java.util.Base64;

@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {
    private static final Logger logger = LoggerFactory.getLogger(OAuth2SuccessHandler.class);

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int OAUTH_CODE_BYTES = 32; // 256 bits of entropy
    private static final Duration OAUTH_CODE_TTL = Duration.ofSeconds(60);

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

        // Never place tokens in the redirect URL — they leak through browser history,
        // server logs and Referer headers. Hand the browser a short-lived, single-use
        // code instead; the frontend redeems it over POST for the actual token pair.
        String code = generateExchangeCode();
        redisTokenStore.storeOAuthCode(code, user.getUserId(), OAUTH_CODE_TTL);

        String redirectUrl = frontendUrl + "/oauth2/callback" + "?code=" + code;
        response.sendRedirect(redirectUrl);
    }

    private String generateExchangeCode() {
        byte[] bytes = new byte[OAUTH_CODE_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
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
