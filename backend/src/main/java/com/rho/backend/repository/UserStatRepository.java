package com.rho.backend.repository;

import com.rho.backend.model.UserStat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Optional;

@Repository
public interface UserStatRepository extends JpaRepository<UserStat, Long> {

    Optional<UserStat>  findByUser_UserId(Long userId);

    @Modifying
    @Query(value = """
            UPDATE user_stats
            SET last_speed = :wpm,
                best_speed = GREATEST(COALESCE(best_speed, 0), :wpm),
                average_speed = ROUND((COALESCE(average_speed, 0) * text_completed + :wpm)
                                      / (text_completed + 1), 2),
                text_completed = text_completed + 1
            WHERE user_id = :userId
            """, nativeQuery = true)
    int applyResult(@Param("userId") Long userId, @Param("wpm") BigDecimal wpm);

}
