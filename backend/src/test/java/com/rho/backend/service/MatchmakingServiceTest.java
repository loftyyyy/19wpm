package com.rho.backend.service;

import com.rho.backend.enums.TextType;
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
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.List;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MatchmakingServiceTest {

    @Mock
    private RedisTemplate<String, String> redisTemplate;
    @Mock
    private RaceService raceService;
    @Mock
    private RaceEventBus raceEventBus;
    @Mock
    private RedisLock redisLock;
    @Mock
    private ObjectMapper objectMapper;
    @Mock
    private UserStatRepository userStatRepository;
    @Mock
    private TypingResultRepository typingResultRepository;
    @Mock
    private ListOperations<String, String> listOperations;

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
        // Run the critical section inline instead of exercising the real Redis lock.
        doAnswer(invocation -> {
            Supplier<?> action = invocation.getArgument(3);
            return action.get();
        }).when(redisLock).withLock(anyString(), any(Duration.class), any(Duration.class), any());
    }

    @Test
    @DisplayName("Sweeping empty queues does not throw")
    void emptyQueuesAreSweptWithoutThrowing() {
        when(listOperations.range(anyString(), anyLong(), anyLong())).thenReturn(List.of());

        assertThatCode(() -> matchmakingService.pollQueues()).doesNotThrowAnyException();

        verify(listOperations, times(TextType.values().length))
                .range(anyString(), anyLong(), anyLong());
    }

    @Test
    @DisplayName("A failing queue does not abort the remaining sweeps")
    void oneFailingQueueDoesNotAbortTheSweep() {
        when(listOperations.range(anyString(), anyLong(), anyLong()))
                .thenThrow(new RuntimeException("redis unavailable"))
                .thenReturn(List.of());

        assertThatCode(() -> matchmakingService.pollQueues()).doesNotThrowAnyException();

        verify(listOperations, times(TextType.values().length))
                .range(anyString(), anyLong(), anyLong());
    }
}
