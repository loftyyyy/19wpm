package com.rho.backend.repository;

import com.rho.backend.model.TypingResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TypingResultRepository extends JpaRepository<TypingResult, Long> {

    @Query("SELECT tr FROM TypingResult tr JOIN FETCH tr.user u WHERE u.userId = :userId ORDER BY tr.createdAt DESC")
    List<TypingResult> findByUserWithUser(@Param("userId") Long userId);

    boolean existsByUser_UserIdAndTextIdAndFinishedAtAndWpmAndAccuracy(
            @Param("userId") Long userId,
            @Param("textId") Long textId,
            @Param("finishedAt") LocalDateTime finishedAt,
            @Param("wpm") BigDecimal wpm,
            @Param("accuracy") BigDecimal accuracy
    );
}
