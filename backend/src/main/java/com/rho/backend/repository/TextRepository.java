package com.rho.backend.repository;

import com.rho.backend.model.Text;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TextRepository extends JpaRepository<Text, Long> {
    Text getByTextId(Long textId);
    List<Text> findByIsCustomFalse();
    List<Text> findByCreatedBy(Long userId);
    List<Text> findByLanguage(String language);

}
