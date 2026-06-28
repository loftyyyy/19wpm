package com.rho.backend.repository;

import com.rho.backend.model.RaceSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;


@Repository
public interface RaceSessionRepository extends JpaRepository<RaceSession, Long> {

}
