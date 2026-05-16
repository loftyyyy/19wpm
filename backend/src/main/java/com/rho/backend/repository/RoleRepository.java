package com.rho.backend.repository;

import com.rho.backend.model.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {

    Role getRoleByName(String name);

    Role getRoleById(Long id);

    boolean existsByName(String name);

    Optional<Role> findByName(String name);

}
