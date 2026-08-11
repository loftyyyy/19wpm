package com.rho.backend.repository;


import com.rho.backend.enums.AuthProvider;
import com.rho.backend.model.StreakState;
import com.rho.backend.model.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);
    Boolean existsByUsername(String username);
    Boolean existsByEmail(String email);

    Optional<User> findByEmail(String email);

    @Query("SELECT u from User u JOIN FETCH u.role WHERE u.userId = :id")
    Optional<User> findByIdWithRole(@Param("id") Long id);

    @Query("SELECT u from User u JOIN FETCH u.role WHERE u.email = :email")
    Optional<User> findByEmailWithRole(@Param("email") String email);

    @Query("SELECT u FROM User u JOIN FETCH u.role")
    List<User> findAllWithRole();

    @Query("SELECT new com.rho.backend.model.StreakState(u.streak, u.lastPlayedDate, u.timezone) FROM User u WHERE u.userId = :userId")
    Optional<StreakState> findStreakState(@Param("userId") Long userId);

    @Modifying
    @Query("""
            UPDATE User u
            SET u.streak = :newStreak, u.lastPlayedDate = :today
            WHERE u.userId = :userId
              AND (u.lastPlayedDate IS NULL OR u.lastPlayedDate = :expectedLastPlayed)
            """)
    int updateStreakConditionally(@Param("userId") Long userId,
                                  @Param("newStreak") int newStreak,
                                  @Param("today") LocalDate today,
                                  @Param("expectedLastPlayed") LocalDate expectedLastPlayed);
}
