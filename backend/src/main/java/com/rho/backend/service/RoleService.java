package com.rho.backend.service;

import com.rho.backend.dto.role.RoleResponseDTO;
import com.rho.backend.exception.user.DuplicateResourceException;
import com.rho.backend.model.Role;
import com.rho.backend.repository.RoleRepository;
import org.springframework.stereotype.Service;

@Service
public class RoleService {

    private final RoleRepository roleRepository;

    public RoleService(RoleRepository roleRepository){
        this.roleRepository = roleRepository;
    }

    public RoleResponseDTO getRoleById(Long id){
        Role role = roleRepository.getRoleById(id);
        return new RoleResponseDTO(role);
    }

    public RoleResponseDTO saveRole(String name){
        if(roleRepository.existsByName(name.toUpperCase())){
            throw new DuplicateResourceException("Role already exists");
        }

        Role role = Role.builder()
                .name(name.toUpperCase())
                .build();

        return new RoleResponseDTO(roleRepository.save(role));
    }

}
