package com.rho.backend.service;

import com.rho.backend.dto.role.RoleResponseDTO;
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
}
