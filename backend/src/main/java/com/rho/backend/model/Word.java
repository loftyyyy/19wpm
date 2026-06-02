package com.rho.backend.model;


import com.rho.backend.enums.TextDifficulty;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "words")
public class Word {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "word_id", nullable = false)
    private Long wordId;

    @Column(nullable = false)
    private String word;

    @Column(nullable = false, length = 50)
    private String language = "en";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TextDifficulty difficulty;
}
