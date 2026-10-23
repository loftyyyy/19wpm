package com.rho.backend.repository;

import com.rho.backend.dto.typingResult.response.TypingResultProjection;
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

    @Query(value = "SELECT tr.typingResultId AS typingResultId, tr.textId AS textId, "
            + "tr.textTitle AS textTitle, tr.textContent AS textContent, tr.finishedAt AS finishedAt, "
            + "tr.durationMs AS durationMs, tr.timeConstraintMs AS timeConstraintMs, tr.wpm AS wpm, "
            + "tr.accuracy AS accuracy, tr.mode AS mode, tr.createdAt AS createdAt, "
            + "u.userId AS userId, u.username AS username "
            + "FROM TypingResult tr JOIN tr.user u WHERE u.userId = :userId",
            countQuery = "SELECT COUNT(tr) FROM TypingResult tr WHERE tr.user.userId = :userId")
    Page<TypingResultProjection> findByUserWithUser(@Param("userId") Long userId, Pageable pageable);

    boolean existsByUser_UserIdAndTextIdAndFinishedAtAndWpmAndAccuracy(
            @Param("userId") Long userId,
            @Param("textId") Long textId,
            @Param("finishedAt") LocalDateTime finishedAt,
            @Param("wpm") BigDecimal wpm,
            @Param("accuracy") BigDecimal accuracy
    );

    @Query("SELECT AVG(tr.accuracy) FROM TypingResult tr WHERE tr.user.userId = :userId")
    Double findAverageAccuracyByUserId(@Param("userId") Long userId);
}
