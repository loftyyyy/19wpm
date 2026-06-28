package com.rho.backend.repository;

import com.rho.backend.model.RaceResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RaceResultRepository extends JpaRepository<RaceResult, Long> {

    List<RaceResult> findBySessionSessionIdOrderByFinishRankAsc(Long sessionId);
    List<RaceResult> findByUserId(Long userId);

}
