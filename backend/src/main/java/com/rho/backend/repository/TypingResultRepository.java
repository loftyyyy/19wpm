package com.rho.backend.repository;

import com.rho.backend.model.TypingResult;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Repository
public interface TypingResultRepository extends JpaRepository<TypingResult, Long> {

    @Query(value = "SELECT tr FROM TypingResult tr JOIN FETCH tr.user u WHERE u.userId = :userId",
            countQuery = "SELECT COUNT(tr) FROM TypingResult tr WHERE tr.user.userId = :userId")
    Page<TypingResult> findByUserWithUser(@Param("userId") Long userId, Pageable pageable);

    boolean existsByUser_UserIdAndTextIdAndFinishedAtAndWpmAndAccuracy(
            @Param("userId") Long userId,
            @Param("textId") Long textId,
            @Param("finishedAt") LocalDateTime finishedAt,
            @Param("wpm") BigDecimal wpm,
            @Param("accuracy") BigDecimal accuracy
    );
}
