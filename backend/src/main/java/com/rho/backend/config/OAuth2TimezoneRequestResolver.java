package com.rho.backend.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

public class OAuth2TimezoneRequestResolver implements OAuth2AuthorizationRequestResolver {

    public static final String SESSION_ATTR = "oauth2_timezone";

    private final OAuth2AuthorizationRequestResolver delegate;

    public OAuth2TimezoneRequestResolver(ClientRegistrationRepository clientRegistrationRepository) {
        DefaultOAuth2AuthorizationRequestResolver defaultResolver =
                new DefaultOAuth2AuthorizationRequestResolver(clientRegistrationRepository);
        defaultResolver.setAuthorizationRequestCustomizer(builder ->
                builder.parameters(params -> params.remove("timezone")));
        this.delegate = defaultResolver;
    }

    OAuth2TimezoneRequestResolver(OAuth2AuthorizationRequestResolver delegate) {
        this.delegate = delegate;
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        captureTimezone(request);
        return delegate.resolve(request);
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        captureTimezone(request);
        return delegate.resolve(request, clientRegistrationId);
    }

    private void captureTimezone(HttpServletRequest request) {
        String timezone = request.getParameter("timezone");
        if (timezone != null && !timezone.isBlank()) {
            HttpSession session = request.getSession(true);
            session.setAttribute(SESSION_ATTR, timezone);
        }
    }
}
