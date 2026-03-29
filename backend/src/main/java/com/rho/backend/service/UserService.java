package com.rho.backend.service;

import com.rho.backend.dto.user.request.UserDeactivateRequest;
import com.rho.backend.dto.user.request.UserRegisterRequest;
import com.rho.backend.dto.user.request.UserUpdateRequest;
import com.rho.backend.dto.user.response.UserResponseDTO;
import com.rho.backend.enums.AuthProvider;
import com.rho.backend.exception.credential.PasswordException;
import com.rho.backend.exception.user.DuplicateCredentialException;
import com.rho.backend.exception.user.UserException;
import com.rho.backend.model.Role;
import com.rho.backend.model.User;
import com.rho.backend.repository.RoleRepository;
import com.rho.backend.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final RoleRepository roleRepository;


    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, RoleRepository roleRepository){
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.roleRepository = roleRepository;
    }

    public UserResponseDTO saveUser(UserRegisterRequest userRegisterRequest){
        if(userRepository.existsByUsername(userRegisterRequest.username())){
            throw new DuplicateCredentialException("Username already exists");
        }

        if(userRepository.existsByEmail(userRegisterRequest.email())){
            throw new DuplicateCredentialException("Email already exists");
        }

        User user = new User();
        user.setUsername(userRegisterRequest.username());
        user.setFirstName(userRegisterRequest.firstName());
        user.setLastName(userRegisterRequest.lastName());
        user.setEmail(userRegisterRequest.email());
        user.setPassword(passwordEncoder.encode(userRegisterRequest.password()));
        user.setCountry(userRegisterRequest.country());
        user.setProvider(AuthProvider.LOCAL);

        Role role = roleRepository.getRoleByName("USER");
        user.setRole(role);

        return new UserResponseDTO(userRepository.save(user));
    }

    public UserResponseDTO getMe(Long id){
        return new UserResponseDTO(userRepository.findById(id).orElseThrow(() -> new UserException("User not found")));
    }

    public UserResponseDTO modifyUser(UserUpdateRequest userUpdateRequest, Long id){
        User user = userRepository.findById(id).orElseThrow(() -> new UserException("User not found"));
        if(!passwordEncoder.matches(userUpdateRequest.getCurrentPassword(), user.getPassword())){
            throw new PasswordException("Credentials doesn't match. Try again");
        }

        user.setCountry(userUpdateRequest.getCountry());
        user.setFirstName(userUpdateRequest.getFirstName());
        user.setLastName(userUpdateRequest.getLastName());

        return new UserResponseDTO(userRepository.save(user));
    }

    public void deactivateUser(UserDeactivateRequest userDeactivateRequest, Long id){
        User user = userRepository.findById(id).orElseThrow(() -> new UserException("User not found"));
        if(!passwordEncoder.matches(userDeactivateRequest.currentPassword(), user.getPassword())){
            throw new PasswordException("Credentials doesn't match. Try again");
        }

        user.setFirstName("Deleted");
        user.setLastName("User");
        user.setEmail("deleted_" + UUID.randomUUID() + "@deleted.com");
        user.setIsActive(false);
        user.setDeactivatedAt(LocalDateTime.now());

        userRepository.save(user);
    }

}
