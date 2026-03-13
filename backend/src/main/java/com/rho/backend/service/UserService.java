package com.rho.backend.service;

import com.rho.backend.dto.user.request.UserRegisterRequest;
import com.rho.backend.exception.user.DuplicateCredentialException;
import com.rho.backend.exception.user.UserException;
import com.rho.backend.model.Role;
import com.rho.backend.model.User;
import com.rho.backend.repository.RoleRepository;
import com.rho.backend.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

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

    public User saveUser(UserRegisterRequest userRegisterRequest){
        if(userRepository.existsByUsername(userRegisterRequest.getUsername())){
            throw new DuplicateCredentialException("Username already exists");
        }

        if(userRepository.existsByEmail(userRegisterRequest.getEmail())){
            throw new DuplicateCredentialException("Email already exists");
        }

        User user = new User();
        user.setUsername(userRegisterRequest.getUsername());
        user.setFirstName(userRegisterRequest.getFirstName());
        user.setLastName(userRegisterRequest.getLastName());
        user.setEmail(userRegisterRequest.getEmail());
        user.setPassword(passwordEncoder.encode(userRegisterRequest.getPassword()));
        user.setCountry(userRegisterRequest.getCountry());

        Role role = roleRepository.getRoleByName("USER");
        user.setRole(role);

        return userRepository.save(user);
    }

    public User findUserById(Long id){
        return userRepository.findById(id).orElseThrow(() -> new UserException("User not found"));
    }

    public User updateUser(UserUpdateRequest userUpdateRequest){
        if(!userRepository.existsById(userUpdateRequest.getUserId())){
            throw new UserException("User not found");
        }


    }

}
