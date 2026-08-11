package com.rho.backend.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class OAuth2TimezoneRequestResolverTest {

    @Test
    void capturesTimezoneFromQueryParamIntoSessionAndDelegates() {
        OAuth2AuthorizationRequestResolver delegate = mock(OAuth2AuthorizationRequestResolver.class);
        OAuth2AuthorizationRequest authRequest = mock(OAuth2AuthorizationRequest.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession session = mock(HttpSession.class);

        when(request.getParameter("timezone")).thenReturn("Asia/Manila");
        when(request.getSession(true)).thenReturn(session);
        when(delegate.resolve(request)).thenReturn(authRequest);

        OAuth2TimezoneRequestResolver resolver = new OAuth2TimezoneRequestResolver(delegate);

        OAuth2AuthorizationRequest result = resolver.resolve(request);

        assertThat(result).isSameAs(authRequest);
        verify(session).setAttribute(OAuth2TimezoneRequestResolver.SESSION_ATTR, "Asia/Manila");
    }

    @Test
    void delegatesWithClientRegistrationId() {
        OAuth2AuthorizationRequestResolver delegate = mock(OAuth2AuthorizationRequestResolver.class);
        OAuth2AuthorizationRequest authRequest = mock(OAuth2AuthorizationRequest.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession session = mock(HttpSession.class);

        when(request.getParameter("timezone")).thenReturn("UTC");
        when(request.getSession(true)).thenReturn(session);
        when(delegate.resolve(request, "github")).thenReturn(authRequest);

        OAuth2TimezoneRequestResolver resolver = new OAuth2TimezoneRequestResolver(delegate);

        OAuth2AuthorizationRequest result = resolver.resolve(request, "github");

        assertThat(result).isSameAs(authRequest);
        verify(session).setAttribute(OAuth2TimezoneRequestResolver.SESSION_ATTR, "UTC");
    }

    @Test
    void ignoresMissingTimezoneParam() {
        OAuth2AuthorizationRequestResolver delegate = mock(OAuth2AuthorizationRequestResolver.class);
        OAuth2AuthorizationRequest authRequest = mock(OAuth2AuthorizationRequest.class);
        HttpServletRequest request = mock(HttpServletRequest.class);

        when(request.getParameter("timezone")).thenReturn(null);
        when(delegate.resolve(request)).thenReturn(authRequest);

        OAuth2TimezoneRequestResolver resolver = new OAuth2TimezoneRequestResolver(delegate);

        OAuth2AuthorizationRequest result = resolver.resolve(request);

        assertThat(result).isSameAs(authRequest);
        verify(request, never()).getSession(anyBoolean());
    }

    @Test
    void ignoresBlankTimezoneParam() {
        OAuth2AuthorizationRequestResolver delegate = mock(OAuth2AuthorizationRequestResolver.class);
        HttpServletRequest request = mock(HttpServletRequest.class);

        when(request.getParameter("timezone")).thenReturn("   ");

        OAuth2TimezoneRequestResolver resolver = new OAuth2TimezoneRequestResolver(delegate);
        resolver.resolve(request);

        verify(request, never()).getSession(anyBoolean());
    }
}
