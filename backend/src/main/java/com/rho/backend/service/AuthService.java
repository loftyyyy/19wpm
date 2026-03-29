package com.rho.backend.service;

import com.rho.backend.dto.auth.request.AuthRequestDTO;
import com.rho.backend.dto.auth.request.RegisterRequestDTO;
import com.rho.backend.dto.role.RoleResponseDTO;
import com.rho.backend.dto.user.request.UserResponseDTO;
import com.rho.backend.dto.auth.response.AuthResponseDTO;
import com.rho.backend.enums.AuthProvider;
import com.rho.backend.exception.user.DuplicateResourceException;
import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.model.Role;
import com.rho.backend.model.User;
import com.rho.backend.repository.RoleRepository;
import com.rho.backend.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, RoleRepository roleRepository, JwtService jwtService, AuthenticationManager authenticationManager, PasswordEncoder passwordEncoder){
        this.userRepository = userRepository;
        this.authenticationManager = authenticationManager;
        this.passwordEncoder = passwordEncoder;
        this.roleRepository = roleRepository;
    }


    public AuthResponseDTO login(@Valid @RequestBody AuthRequestDTO authRequestDTO){
        if(!userRepository.existsByEmail(authRequestDTO.email())){
            throw new ResourceNotFoundException("User not found");
        }

        if(){

        }


    }

    public AuthResponseDTO saveUser(RegisterRequestDTO registerRequestDTO){
        if(userRepository.existsByUsername(registerRequestDTO.username())){
            throw new DuplicateResourceException("Username already exists");
        }

        if(userRepository.existsByEmail(registerRequestDTO.email())){
            throw new DuplicateResourceException("Email already exists");
        }

        User user = new User();
        user.setUsername(registerRequestDTO.username());
        user.setFirstName(registerRequestDTO.firstName());
        user.setLastName(registerRequestDTO.lastName());
        user.setEmail(registerRequestDTO.email());
        user.setPassword(passwordEncoder.encode(registerRequestDTO.password()));
        user.setCountry(registerRequestDTO.country());
        user.setProvider(AuthProvider.LOCAL);

        Role role = roleRepository.getRoleByName("USER");
        user.setRole(role);

        return buildResponse(userRepository.save(user));
    }


    /**
     * Internal Helper
     */

    private AuthResponseDTO buildResponse(User user){
        return new AuthResponseDTO(jwtService.generateAccessToken(user), jwtService.generateRefreshToken(user), "Bearer", new UserResponseDTO(user.getUserId(), user.getEmail(), user.getUsername(), user.getProvider().toString()));
    }



}
