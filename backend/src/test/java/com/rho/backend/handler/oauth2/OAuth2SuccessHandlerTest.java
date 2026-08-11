package com.rho.backend.handler.oauth2;

import com.rho.backend.config.CustomOAuth2User;
import com.rho.backend.config.OAuth2TimezoneRequestResolver;
import com.rho.backend.enums.AuthProvider;
import com.rho.backend.model.Role;
import com.rho.backend.model.User;
import com.rho.backend.redis.RedisTokenStore;
import com.rho.backend.repository.UserRepository;
import com.rho.backend.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Date;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OAuth2SuccessHandlerTest {

    @Mock
    private JwtService jwtService;
    @Mock
    private RedisTokenStore redisTokenStore;
    @Mock
    private UserRepository userRepository;
    @Mock
    private HttpServletRequest request;
    @Mock
    private HttpServletResponse response;
    @Mock
    private HttpSession session;
    @Mock
    private Authentication authentication;

    private User user;
    private CustomOAuth2User principal;
    private OAuth2SuccessHandler handler;

    @BeforeEach
    void setUp() {
        Role role = Role.builder().name("USER").build();
        user = User.builder()
                .username("oauth_user")
                .firstName("OAuth")
                .lastName("User")
                .email("oauth@example.com")
                .password(null)
                .isActive(Boolean.TRUE)
                .provider(AuthProvider.GITHUB)
                .timezone("UTC")
                .role(role)
                .build();
        principal = new CustomOAuth2User(user, Map.of());

        handler = new OAuth2SuccessHandler(jwtService, redisTokenStore, userRepository);
        ReflectionTestUtils.setField(handler, "frontendUrl", "http://localhost:5173");
    }

    private void stubOAuthFlow() {
        when(authentication.getPrincipal()).thenReturn(principal);
        when(jwtService.generateAccessToken(user)).thenReturn("access-token");
        when(jwtService.generateRefreshToken(user)).thenReturn("refresh-token");
        when(jwtService.extractExpiration("refresh-token")).thenReturn(new Date());
    }

    @Test
    void refreshesTimezoneFromSessionAndSavesUser() throws Exception {
        stubOAuthFlow();
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(OAuth2TimezoneRequestResolver.SESSION_ATTR)).thenReturn("Asia/Manila");

        handler.onAuthenticationSuccess(request, response, authentication);

        verify(userRepository).save(user);
        assertThat(user.getTimezone()).isEqualTo("Asia/Manila");
        verify(redisTokenStore).storeRefreshToken(eq(user.getUserId()), eq("refresh-token"), any(Date.class));
        verify(response).sendRedirect(startsWith("http://localhost:5173/oauth2/callback"));
    }

    @Test
    void doesNotSaveWhenTimezoneUnchanged() throws Exception {
        user.setTimezone("Asia/Manila");
        stubOAuthFlow();
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(OAuth2TimezoneRequestResolver.SESSION_ATTR)).thenReturn("Asia/Manila");

        handler.onAuthenticationSuccess(request, response, authentication);

        verify(userRepository, never()).save(any());
        assertThat(user.getTimezone()).isEqualTo("Asia/Manila");
    }

    @Test
    void invalidTimezoneFallsBackToUtc() throws Exception {
        user.setTimezone("Asia/Manila");
        stubOAuthFlow();
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(OAuth2TimezoneRequestResolver.SESSION_ATTR)).thenReturn("Not/AZone");

        handler.onAuthenticationSuccess(request, response, authentication);

        verify(userRepository).save(user);
        assertThat(user.getTimezone()).isEqualTo("UTC");
    }

    @Test
    void noSessionMeansNoTimezoneUpdate() throws Exception {
        stubOAuthFlow();
        when(request.getSession(false)).thenReturn(null);

        handler.onAuthenticationSuccess(request, response, authentication);

        verify(userRepository, never()).save(any());
        assertThat(user.getTimezone()).isEqualTo("UTC");
    }

    @Test
    void blankTimezoneAttributeMeansNoTimezoneUpdate() throws Exception {
        stubOAuthFlow();
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(OAuth2TimezoneRequestResolver.SESSION_ATTR)).thenReturn("");

        handler.onAuthenticationSuccess(request, response, authentication);

        verify(userRepository, never()).save(any());
        assertThat(user.getTimezone()).isEqualTo("UTC");
    }
}
