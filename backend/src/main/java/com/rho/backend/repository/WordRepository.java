package com.rho.backend.repository;

import com.rho.backend.enums.TextDifficulty;
import com.rho.backend.model.Word;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WordRepository extends JpaRepository<Word, Long> {

    @Query(value = "SELECT MAX(id) FROM words WHERE language = :language AND difficulty = :difficulty", nativeQuery = true)
    Optional<Long> findMaxIdByLanguageAndDifficulty(@Param("language") String language, @Param("difficulty") String difficulty);

    @Query("SELECT w FROM Word w WHERE w.id >= :randId AND w.language = :language AND w.difficulty = :difficulty ORDER BY w.id ASC")
    List<Word> findFirstByIdGreaterThanEqualAndLanguageAndDifficulty(@Param("randId") Long randId, @Param("language") String language, @Param("difficulty") TextDifficulty difficulty, Pageable pageable);
}
