package com.rho.backend.service;

import com.rho.backend.dto.user.request.UserDeactivateRequestDTO;
import com.rho.backend.dto.user.request.UserUpdateRequestDTO;
import com.rho.backend.dto.user.response.UserResponseDTO;
import com.rho.backend.exception.credential.PasswordException;
import com.rho.backend.exception.user.ResourceNotFoundException;
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

    public UserResponseDTO getMe(Long id){
        return new UserResponseDTO(userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("User not found")));
    }

    public UserResponseDTO modifyUser(UserUpdateRequestDTO userUpdateRequestDTO, Long id){
        User user = userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if(!passwordEncoder.matches(userUpdateRequestDTO.getCurrentPassword(), user.getPassword())){
            throw new PasswordException("Credentials doesn't match. Try again");
        }

        user.setCountry(userUpdateRequestDTO.getCountry());
        user.setFirstName(userUpdateRequestDTO.getFirstName());
        user.setLastName(userUpdateRequestDTO.getLastName());

        return new UserResponseDTO(userRepository.save(user));
    }

    public void deactivateUser(UserDeactivateRequestDTO userDeactivateRequestDTO, Long id){
        User user = userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if(!passwordEncoder.matches(userDeactivateRequestDTO.currentPassword(), user.getPassword())){
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
