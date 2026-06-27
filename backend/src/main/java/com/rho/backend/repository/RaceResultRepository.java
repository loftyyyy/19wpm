package com.rho.backend.repository;

import com.rho.backend.model.RaceResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RaceResultRepository extends JpaRepository<RaceResult, Long> {

    List<RaceResult> findBySessionSessionIdOrderByFinishRankAsc(Long sessionId);
    List<RaceResult> findByUserId(Long userId);

}
