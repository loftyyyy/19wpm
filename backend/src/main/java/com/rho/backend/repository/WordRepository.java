package com.rho.backend.repository;

import com.rho.backend.model.Word;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WordRepository extends JpaRepository<Word, Long> {

    @Query(value = "SELECT * FROM words WHERE language = :language AND difficulty = :difficulty ORDER BY random() LIMIT :count", nativeQuery = true)
    List<Word> findRandomByLanguageAndDifficulty(@Param("language") String language, @Param("difficulty") String difficulty, @Param("count") int count);
}
