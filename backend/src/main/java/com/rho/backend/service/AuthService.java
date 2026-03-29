package com.rho.backend.service;

import com.rho.backend.dto.auth.request.AuthRequestDTO;
import com.rho.backend.dto.user.request.UserDTO;
import com.rho.backend.dto.auth.request.RegisterRequestDTO;
import com.rho.backend.dto.auth.response.AuthResponseDTO;
import com.rho.backend.model.User;
import com.rho.backend.repository.UserRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final User user;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthService(UserRepository userRepository, User user, JwtService jwtService, AuthenticationManager authenticationManager){
        this.userRepository = userRepository;
        this.user = user;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
    }


    public AuthResponseDTO login(AuthRequestDTO authRequestDTO){
        

    }


    /**
     * Internal Helper
     */

    private AuthResponseDTO buildResponse(User user){
        return new AuthResponseDTO(jwtService.generateAccessToken(user), jwtService.generateRefreshToken(user), "Bearer", new UserDTO(user.getUserId(), user.getEmail(), user.getUsername(), user.getProvider()));
    }



}
