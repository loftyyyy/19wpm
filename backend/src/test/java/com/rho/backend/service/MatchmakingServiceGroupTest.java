package com.rho.backend.service;

import com.rho.backend.enums.TextType;
import com.rho.backend.matchmaking.MatchmakingEntry;
import com.rho.backend.race.RaceEventBus;
import com.rho.backend.redis.RedisLock;
import com.rho.backend.repository.TypingResultRepository;
import com.rho.backend.repository.UserStatRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.List;
import java.util.function.Supplier;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MatchmakingServiceGroupTest {

    @Mock
    private RedisTemplate<String, String> redisTemplate;
    @Mock
    private RaceService raceService;
    @Mock
    private RaceEventBus raceEventBus;
    @Mock
    private RedisLock redisLock;
    @Mock
    private UserStatRepository userStatRepository;
    @Mock
    private TypingResultRepository typingResultRepository;
    @Mock
    private ListOperations<String, String> listOperations;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MatchmakingService matchmakingService;

    @BeforeEach
    void setUp() {
        matchmakingService = new MatchmakingService(
                redisTemplate,
                raceService,
                raceEventBus,
                redisLock,
                objectMapper,
                userStatRepository,
                typingResultRepository);

        when(redisTemplate.opsForList()).thenReturn(listOperations);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        doAnswer(invocation -> {
            Supplier<?> action = invocation.getArgument(3);
            return action.get();
        }).when(redisLock).withLock(anyString(), any(Duration.class), any(Duration.class), any());
    }

    @Test
    @DisplayName("Groups four players who have waited past the gather window into one room")
    void groupsFourPlayersIntoOneRoom() throws Exception {
        long now = System.currentTimeMillis();
        // Redis stores newest-first; the loader reverses this to oldest-first.
        List<String> rawEntries = List.of(
                objectMapper.writeValueAsString(new MatchmakingEntry(4, 80, 95, now - 5_000)),
                objectMapper.writeValueAsString(new MatchmakingEntry(3, 70, 95, now - 5_100)),
                objectMapper.writeValueAsString(new MatchmakingEntry(2, 60, 95, now - 5_200)),
                objectMapper.writeValueAsString(new MatchmakingEntry(1, 50, 95, now - 5_300)));

        when(listOperations.range(eq("matchmaking:queue:SHORT"), anyLong(), anyLong()))
                .thenReturn(rawEntries);
        when(raceService.createRoom(null, TextType.SHORT, false)).thenReturn("ROOM01");

        matchmakingService.pollQueues();

        verify(raceService).createRoom(null, TextType.SHORT, false);
        verify(raceService).joinRoom("ROOM01", 1L);
        verify(raceService).joinRoom("ROOM01", 2L);
        verify(raceService).joinRoom("ROOM01", 3L);
        verify(raceService).joinRoom("ROOM01", 4L);
        verify(raceEventBus).sendToUser(1L, "/queue/matchmaking", "ROOM01");
        verify(raceEventBus).sendToUser(2L, "/queue/matchmaking", "ROOM01");
        verify(raceEventBus).sendToUser(3L, "/queue/matchmaking", "ROOM01");
        verify(raceEventBus).sendToUser(4L, "/queue/matchmaking", "ROOM01");
    }
}
