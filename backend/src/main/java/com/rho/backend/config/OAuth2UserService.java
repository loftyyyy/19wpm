package com.rho.backend.config;


import com.rho.backend.enums.AuthProvider;
import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.model.Role;
import com.rho.backend.model.User;
import com.rho.backend.model.UserOAuthProvider;
import com.rho.backend.repository.RoleRepository;
import com.rho.backend.repository.UserOAuthProviderRepository;
import com.rho.backend.repository.UserRepository;
import com.rho.backend.service.JwtService;
import com.rho.backend.service.UserStatService;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import org.springframework.http.HttpHeaders;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class OAuth2UserService extends DefaultOAuth2UserService {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserOAuthProviderRepository oAuthProviderRepository;
    private final UserStatService userStatService;

    public OAuth2UserService(UserRepository userRepository, RoleRepository roleRepository, UserOAuthProviderRepository oAuthProviderRepository, UserStatService userStatService){
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.oAuthProviderRepository = oAuthProviderRepository;
        this.userStatService = userStatService;
    }

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);

        String registrationId = userRequest.getClientRegistration().getRegistrationId();
        AuthProvider provider = registrationId.equalsIgnoreCase("google")
                ? AuthProvider.GOOGLE
                : AuthProvider.GITHUB;

        String providerId;
        System.out.println(oAuth2User);
        if (oAuth2User.getAttribute("sub") != null) {
            providerId = oAuth2User.getAttribute("sub");
        } else {
            Integer githubId = oAuth2User.getAttribute("id");
            providerId = String.valueOf(githubId);
        }

        String email = provider == AuthProvider.GITHUB
                ? getGithubEmail(userRequest, oAuth2User)
                : oAuth2User.getAttribute("email");


        User user = resolveUser(provider, providerId, email, oAuth2User.getAttributes());

        return new CustomOAuth2User(user, oAuth2User.getAttributes());
    }

    private String getGithubEmail(OAuth2UserRequest userRequest, OAuth2User oAuth2User) {
        // 1. Try the main attribute first (works if email is public)
        String email = oAuth2User.getAttribute("email");
        if (email != null) return email;

        // 2. Call GitHub's /user/emails endpoint to get private email
        String token = userRequest.getAccessToken().getTokenValue();

        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                "https://api.github.com/user/emails",
                HttpMethod.GET,
                entity,
                new ParameterizedTypeReference<>() {}
        );

        // 3. Find the primary verified email from the list
        List<Map<String, Object>> emails = response.getBody();
        if (emails != null) {
            return emails.stream()
                    .filter(e -> Boolean.TRUE.equals(e.get("primary"))
                            && Boolean.TRUE.equals(e.get("verified")))
                    .map(e -> (String) e.get("email"))
                    .findFirst()
                    .orElse(null);
        }

        return null;
    }

    private User resolveUser(AuthProvider provider, String providerId,
                             String email,  Map<String, Object> attributes) {
        // 1. Check linked providers table
        Optional<User> byProviderId = oAuthProviderRepository
                .findByProviderAndProviderId(provider, providerId)
                .map(UserOAuthProvider::getUser);

        if (byProviderId.isPresent()) {
            return byProviderId.get();
        }

        // 2. Only check by email if we actually have one
        if (email != null) {
            Optional<User> byEmail = userRepository.findByEmail(email);
            if (byEmail.isPresent()) {
                User existingUser = byEmail.get();
                linkOAuthProvider(existingUser, provider, providerId);
                return existingUser;
            }
        }

        // 3. Register new user
        return registerOAuthUser(provider, providerId, email, attributes);
    }

    private void linkOAuthProvider(User user, AuthProvider provider, String providerId) {
        UserOAuthProvider link = UserOAuthProvider.builder()
            .user(user)
            .provider(provider)
            .providerId(providerId)
            .build();
        oAuthProviderRepository.save(link);
    }

    private User registerOAuthUser(AuthProvider provider, String providerId,
                                   String email, Map<String, Object> attributes) {
        Role role = roleRepository.findByName("USER")
                .orElseThrow(() -> new ResourceNotFoundException("Role not found"));

        String username;
        String firstName;
        String lastName;

        if (provider == AuthProvider.GOOGLE) {
            String baseName = attributes.get("name").toString().replaceAll("\\s", "");
            username  = baseName + "_" + UUID.randomUUID().toString().substring(0, 5);
            firstName = (String) attributes.get("given_name");
            lastName  = (String) attributes.get("family_name");
        } else {
            String githubUsername = (String) attributes.get("login");
            username  = githubUsername != null
                    ? githubUsername
                    : "user_" + UUID.randomUUID().toString().substring(0, 5);
            firstName = null;
            lastName  = null;
        }

        User user = User.builder()
                .email(email)
                .username(username)
                .firstName(firstName)
                .lastName(lastName)
                .provider(provider)
                .password(null)
                .role(role)
                .isActive(true)
                .build();

        User savedUser = userRepository.save(user);
        userStatService.initializeUserStats(savedUser.getUserId());
        linkOAuthProvider(savedUser, provider, providerId);

        return savedUser;
    }
}
