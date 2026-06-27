package com.rho.backend.model;

import com.rho.backend.enums.TextType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;


@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "race_sessions")
public class RaceSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long sessionId;

    @Column(nullable = false, length = 10)
    private String roomCode;

    @Column(nullable = false)
    private Long textId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TextType textType;

    @Column(nullable = false)
    private boolean isPrivate;

    @Column(nullable = false)
    private Instant startedAt;

    @Column(nullable = false)
    private Instant finishedAt;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RaceResult> results = new ArrayList<>();

}
