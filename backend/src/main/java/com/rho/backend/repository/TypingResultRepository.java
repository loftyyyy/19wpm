package com.rho.backend.repository;

import com.rho.backend.model.TypingResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TypingResultRepository extends JpaRepository<TypingResult, Long> {

}
