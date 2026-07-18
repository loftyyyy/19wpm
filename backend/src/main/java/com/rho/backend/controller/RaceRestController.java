package com.rho.backend.controller;

import com.rho.backend.config.CustomUserDetails;
import com.rho.backend.dto.race.CreateRoomRequestDTO;
import com.rho.backend.race.RaceRoom;
import com.rho.backend.service.MatchmakingService;
import com.rho.backend.service.RaceService;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/race")
public class RaceRestController {

    private final RaceService raceService;
    private final MatchmakingService matchmakingService;
    private final RedisTemplate<String, String> redisTemplate;

    public RaceRestController(RaceService raceService, MatchmakingService matchmakingService, RedisTemplate<String, String> redisTemplate) {
        this.raceService = raceService;
        this.matchmakingService = matchmakingService;
        this.redisTemplate = redisTemplate;
    }

    @PostMapping("/rooms")
    public ResponseEntity<?> createRoom(@RequestBody CreateRoomRequestDTO createRoomRequestDTO, @AuthenticationPrincipal CustomUserDetails userDetails) {
        String roomCode = raceService.createRoom(userDetails.getUserId(), createRoomRequestDTO.textType(), createRoomRequestDTO.isPrivate());
        return ResponseEntity.status(HttpStatus.CREATED).body(roomCode);
    }

    @PostMapping("/rooms/{code}/join")
    public ResponseEntity<?> joinRoom(@PathVariable String code, @AuthenticationPrincipal CustomUserDetails customUserDetails) {
        RaceRoom raceRoom = raceService.joinRoom(code, customUserDetails.getUserId());
        return ResponseEntity.status(HttpStatus.OK).body(raceRoom);
    }

    @PostMapping("/matchmaking/join")
    public ResponseEntity<?> joinMatchmaking(@AuthenticationPrincipal CustomUserDetails customUserDetails, @RequestBody CreateRoomRequestDTO createRoomRequestDTO) {
        matchmakingService.joinQueue(customUserDetails.getUserId(), createRoomRequestDTO.textType());
        return ResponseEntity.status(HttpStatus.OK).body("Searching...");
    }

    @PostMapping("/matchmaking/leave")
    public ResponseEntity<?> leaveMatchmaking(@AuthenticationPrincipal CustomUserDetails customUserDetails) {
        matchmakingService.leaveQueue(customUserDetails.getUserId());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/matchmaking/pending")
    public ResponseEntity<?> getPendingMatch(@AuthenticationPrincipal CustomUserDetails customUserDetails) {
        String key = "matchmaking:pending:" + customUserDetails.getUserId();
        String roomCode = (String) redisTemplate.opsForValue().get(key);
        if (roomCode == null) {
            return ResponseEntity.noContent().build();
        }
        redisTemplate.delete(key);
        return ResponseEntity.ok(roomCode);
    }
}
