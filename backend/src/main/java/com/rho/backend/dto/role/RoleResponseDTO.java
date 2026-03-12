package com.rho.backend.dto.role;

import com.rho.backend.model.Role;
import lombok.Getter;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@Getter
public class RoleResponseDTO {

    private long roleId;
    private String roleName;

    public RoleResponseDTO(Role role){
        this.roleId = role.getId();
        this.roleName = role.getName();
    }


}
