package com.rho.backend.repository;

import com.rho.backend.enums.TextType;
import com.rho.backend.model.Text;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Pageable;

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
    
    @Query("SELECT MAX(t.textId) FROM Text t WHERE t.isCustom = false")
    Optional<Long> findMaxPresetId();

    @Query("SELECT t FROM Text t WHERE t.textId >= :randId AND t.isCustom = false ORDER BY t.textId ASC")
    List<Text> findFirstPresetByIdGreaterThanEqual(@Param("randId") Long randId, Pageable pageable);

    @Query("SELECT MAX(t.textId) FROM Text t WHERE t.isCustom = false AND t.type = :type")
    Optional<Long> findMaxPresetIdByType(@Param("type") TextType type);

    @Query("SELECT t FROM Text t WHERE t.textId >= :randId AND t.isCustom = false AND t.type = :type ORDER BY t.textId ASC")
    List<Text> findFirstPresetByIdGreaterThanEqualAndType(@Param("randId") Long randId, @Param("type") TextType type, Pageable pageable);

    List<Text> findByLanguageAndType(String language, TextType type);
}
