package com.rho.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Table(name = "texts")
@Entity
public class Text {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "text_id")
    private Long textId;

    @Column(name = "is_custom", nullable = false)
    private boolean isCustom;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 100)
    private String author;

    @Column(nullable = false, length = 100)
    private String source;

    @Column(nullable = false, length = 50)
    private String language = "en";

    @Lob
    @Column(name = "content", nullable = false)
    private String content;

    @Column(name = "word_count", nullable = false)
    private Integer wordCount;

    @Column(name = "char_length", nullable = false)
    private Integer charLength;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
