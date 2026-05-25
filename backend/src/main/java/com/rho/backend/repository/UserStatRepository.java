package com.rho.backend.repository;

import com.rho.backend.model.UserStat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserStatRepository extends JpaRepository<UserStat, Long> {

    Optional<UserStat>  findByUser(Long userId);

}
