package com.rho.backend.model;

import com.rho.backend.enums.TextType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "texts")
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

    @Column(name = "content", nullable = false)
    private String content;

    @Column(name = "word_count", nullable = false)
    private Integer wordCount;

    @Column(name = "char_length", nullable = false)
    private Integer charLength;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TextType type;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
