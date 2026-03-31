package com.rho.backend.service;

import com.rho.backend.dto.auth.request.AuthRequestDTO;
import com.rho.backend.dto.auth.request.RegisterRequestDTO;
import com.rho.backend.dto.auth.token.response.TokenRefreshResponseDTO;
import com.rho.backend.dto.user.request.UserResponseDTO;
import com.rho.backend.dto.auth.response.AuthResponseDTO;
import com.rho.backend.enums.AuthProvider;
import com.rho.backend.exception.InvalidResourceException;
import com.rho.backend.exception.user.DuplicateResourceException;
import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.model.User;
import com.rho.backend.repository.RoleRepository;
import com.rho.backend.repository.UserRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, RoleRepository roleRepository, JwtService jwtService, AuthenticationManager authenticationManager, PasswordEncoder passwordEncoder){
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.passwordEncoder = passwordEncoder;
        this.roleRepository = roleRepository;
    }


    public AuthResponseDTO login(AuthRequestDTO authRequestDTO){
        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(authRequestDTO.email(), authRequestDTO.password()));
        User user = userRepository.findByEmail(authRequestDTO.email()).orElseThrow(() -> new ResourceNotFoundException("User not found."));
        return buildResponse(user);
    }

    public AuthResponseDTO saveUser(RegisterRequestDTO registerRequestDTO){
        if(userRepository.existsByUsername(registerRequestDTO.username())){
            throw new DuplicateResourceException("Username already exists");
        }

        if(userRepository.existsByEmail(registerRequestDTO.email())){
            throw new DuplicateResourceException("Email already exists");
        }

        User user = User.builder()
                        .username(registerRequestDTO.username())
                        .firstName(registerRequestDTO.firstName())
                        .lastName(registerRequestDTO.lastName())
                        .email(registerRequestDTO.email())
                        .password(passwordEncoder.encode(registerRequestDTO.password()))
                        .country(registerRequestDTO.country())
                        .provider(AuthProvider.LOCAL)
                        .role(roleRepository.getRoleByName("USER")).build();

        return buildResponse(userRepository.save(user));
    }

    /**
     * Validates the refresh token and issues a fresh access token.
     * The refresh token itself is NOT rotated here — add rotation later if I
     * want extra security (invalidate old refresh token, issue a new one).
     */
    public TokenRefreshResponseDTO refresh(String refreshToken){
        String email;

        try{
            email = jwtService.extractSubject(refreshToken);
        }catch (Exception e){
            throw new InvalidResourceException("Invalid refresh token.");
        }

        if(!jwtService.isRefreshTokenValid(refreshToken, email)){
            throw new InvalidResourceException("Refresh token is expired or invalid.");
        }

        User user = userRepository.findByEmail(email).orElseThrow(() -> new ResourceNotFoundException("User not found."));

        String newAccessToken = jwtService.generateAccessToken(user);

        return new TokenRefreshResponseDTO(newAccessToken, "Bearer");
    }

    /**
     * Builds the auth response containing BOTH tokens.
     * The frontend should store the refresh token securely (HttpOnly cookie
     * is safer than localStorage for the refresh token).
     */
    private AuthResponseDTO buildResponse(User user){
        return new AuthResponseDTO(jwtService.generateAccessToken(user), jwtService.generateRefreshToken(user), "Bearer", UserResponseDTO.from(user));
    }



}
