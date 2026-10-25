package com.rho.backend.repository;

import com.rho.backend.enums.TextType;
import com.rho.backend.model.Text;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TextRepository extends JpaRepository<Text, Long> {
    Text getByTextId(Long textId);
    List<Text> findByIsCustomFalse();
    List<Text> findByCreatedBy(Long userId);
    List<Text> findByLanguage(String language);
    List<Text> findByType(TextType type);

    Optional<Text> findByTextId(Long textId);

    long countByIsCustomFalse();

    long countByIsCustomFalseAndType(TextType type);

    long countByLanguage(String language);

    long countByLanguageAndType(String language, TextType type);

    @Query(value = "SELECT * FROM texts WHERE is_custom = false ORDER BY text_id LIMIT :count OFFSET :offset", nativeQuery = true)
    List<Text> findPresetPage(@Param("count") int count, @Param("offset") long offset);

    @Query(value = "SELECT * FROM texts WHERE is_custom = false AND type = :type ORDER BY text_id LIMIT :count OFFSET :offset", nativeQuery = true)
    List<Text> findPresetPageByType(
            @Param("type") String type,
            @Param("count") int count,
            @Param("offset") long offset);

    @Query(value = "SELECT * FROM texts WHERE language = :language AND type = :type ORDER BY text_id LIMIT :count OFFSET :offset", nativeQuery = true)
    List<Text> findPageByLanguageAndType(
            @Param("language") String language,
            @Param("type") String type,
            @Param("count") int count,
            @Param("offset") long offset);
}
