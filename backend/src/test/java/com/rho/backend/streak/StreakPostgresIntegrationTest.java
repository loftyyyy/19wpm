package com.rho.backend.streak;

import com.rho.backend.enums.AuthProvider;
import com.rho.backend.model.User;
import com.rho.backend.repository.RoleRepository;
import com.rho.backend.repository.UserRepository;
import com.rho.backend.service.StreakService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@Testcontainers
@ActiveProfiles("test")
@Transactional
class StreakPostgresIntegrationTest {

    private static final ZoneId UTC = ZoneId.of("UTC");

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.flyway.locations", () -> "classpath:db/migration");
        registry.add("spring.sql.init.mode", () -> "never");
    }

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private StreakService streakService;
    @PersistenceContext
    private EntityManager entityManager;

    @BeforeEach
    void setUp() {
        assertThat(roleRepository.getRoleByName("USER")).isNotNull();
    }

    private User newUser() {
        return User.builder()
                .username("streak_user")
                .firstName("Streak")
                .lastName("User")
                .email("streak@example.com")
                .password("password")
                .isActive(Boolean.TRUE)
                .provider(AuthProvider.LOCAL)
                .timezone("UTC")
                .role(roleRepository.getRoleByName("USER"))
                .build();
    }

    @DisplayName("First-ever activity (lastPlayedDate null) starts the streak at 1 on real Postgres")
    @Test
    void firstActivityEverStartsStreakAtOne() {
        User user = userRepository.save(newUser());
        assertThat(user.getLastPlayedDate()).isNull();
        assertThat(user.getStreak()).isNull();

        Integer streak = streakService.recordActivity(user.getUserId());

        assertThat(streak).isEqualTo(1);
        entityManager.flush();
        entityManager.clear();
        User persisted = userRepository.findById(user.getUserId()).orElseThrow();
        assertThat(persisted.getStreak()).isEqualTo(1);
        assertThat(persisted.getLastPlayedDate()).isEqualTo(LocalDate.now(UTC));
    }

    @DisplayName("Consecutive-day activity increments the streak on real Postgres")
    @Test
    void consecutiveDayIncrementsStreak() {
        LocalDate today = LocalDate.now(UTC);
        User user = userRepository.save(newUser());
        user.setStreak(5);
        user.setLastPlayedDate(today.minusDays(1));
        userRepository.save(user);

        Integer streak = streakService.recordActivity(user.getUserId());

        assertThat(streak).isEqualTo(6);
        entityManager.flush();
        entityManager.clear();
        User persisted = userRepository.findById(user.getUserId()).orElseThrow();
        assertThat(persisted.getStreak()).isEqualTo(6);
        assertThat(persisted.getLastPlayedDate()).isEqualTo(today);
    }

    @DisplayName("Same-day activity is a no-op that keeps the streak on real Postgres")
    @Test
    void sameDayActivityKeepsStreak() {
        LocalDate today = LocalDate.now(UTC);
        User user = userRepository.save(newUser());
        user.setStreak(7);
        user.setLastPlayedDate(today);
        userRepository.save(user);

        Integer streak = streakService.recordActivity(user.getUserId());

        assertThat(streak).isEqualTo(7);
        entityManager.flush();
        entityManager.clear();
        User persisted = userRepository.findById(user.getUserId()).orElseThrow();
        assertThat(persisted.getStreak()).isEqualTo(7);
        assertThat(persisted.getLastPlayedDate()).isEqualTo(today);
    }

    @DisplayName("Boundary: UTC-stored user at 05:00 local on a new day keeps the streak (5) until the UTC date advances")
    @Test
    void boundaryUtcStoredUserKeepsStreakWithinSameUtcDate() {
        Instant boundary = Instant.parse("2026-08-11T21:00:00Z"); // = 2026-08-12T05:00 Asia/Manila
        User user = userRepository.save(newUser());
        user.setProvider(AuthProvider.GITHUB);
        user.setStreak(5);
        user.setLastPlayedDate(LocalDate.of(2026, 8, 11));
        userRepository.save(user);

        StreakService fixedClockService = new StreakService(userRepository, Clock.fixed(boundary, UTC));

        Integer streak = fixedClockService.recordActivity(user.getUserId());

        assertThat(streak).isEqualTo(5);
    }

    @DisplayName("Boundary control: same instant with correctly stored Asia/Manila timezone increments to 6")
    @Test
    void boundaryManilaStoredUserIncrementsOnNewLocalDay() {
        Instant boundary = Instant.parse("2026-08-11T21:00:00Z"); // = 2026-08-12T05:00 Asia/Manila
        User user = userRepository.save(newUser());
        user.setTimezone("Asia/Manila");
        user.setStreak(5);
        user.setLastPlayedDate(LocalDate.of(2026, 8, 11));
        userRepository.save(user);

        StreakService fixedClockService = new StreakService(userRepository, Clock.fixed(boundary, UTC));

        Integer streak = fixedClockService.recordActivity(user.getUserId());

        assertThat(streak).isEqualTo(6);
        entityManager.flush();
        entityManager.clear();
        User persisted = userRepository.findById(user.getUserId()).orElseThrow();
        assertThat(persisted.getStreak()).isEqualTo(6);
        assertThat(persisted.getLastPlayedDate()).isEqualTo(LocalDate.of(2026, 8, 12));
    }
}
