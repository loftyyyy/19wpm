package com.rho.backend.dto.role;

import com.rho.backend.model.Role;

public record RoleResponseDTO (
    long roleId,
    String roleName
){
    public RoleResponseDTO(Role role){
        this(
                role.getId(),
                role.getName()
        );
    }
}
