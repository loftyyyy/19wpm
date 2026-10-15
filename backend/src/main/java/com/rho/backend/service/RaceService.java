package com.rho.backend.service;

import com.rho.backend.dto.race.RaceProgressDTO;
import com.rho.backend.dto.text.response.TextResponseDTO;
import com.rho.backend.enums.RaceState;
import com.rho.backend.enums.TextType;
import com.rho.backend.exception.InvalidResourceException;
import com.rho.backend.exception.UnauthorizedResourceException;
import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.model.RaceResult;
import com.rho.backend.model.RaceSession;
import com.rho.backend.model.User;
import com.rho.backend.race.RaceParticipant;
import com.rho.backend.race.RaceRoom;
import com.rho.backend.race.RaceRoomStore;
import com.rho.backend.repository.RaceResultRepository;
import com.rho.backend.repository.RaceSessionRepository;
import com.rho.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class RaceService {
    private final TextService textService;
    private final RaceRoomStore raceRoomStore;
    private static final String ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int CODE_LENGTH = 6;
    public static final long COUNTDOWN_DURATION_MS = 3500L;
    private static final Logger logger = LoggerFactory.getLogger(RaceService.class);
    private final UserRepository userRepository;
    private final RaceSessionRepository raceSessionRepository;
    private final RaceResultRepository raceResultRepository;
    private final StreakService streakService;

    public RaceService(TextService textService, RaceRoomStore raceRoomStore, UserRepository userRepository, RaceSessionRepository raceSessionRepository, RaceResultRepository raceResultRepository, StreakService streakService) {
        this.textService = textService;
        this.raceRoomStore = raceRoomStore;
        this.userRepository = userRepository;
        this.raceSessionRepository = raceSessionRepository;
        this.raceResultRepository = raceResultRepository;
        this.streakService = streakService;
    }

    private RaceRoom getRoom(String roomCode) {
        return raceRoomStore.get(roomCode)
                .orElseThrow(() -> new ResourceNotFoundException("Room code not found"));
    }

    public String createRoom(Long hostUserId, TextType textType, boolean isPrivate) {
        int maxAttempts = 5;
        String roomCode;

        for (int i = 0; i < maxAttempts; i++) {
            roomCode = generateRoomCode();

            if (raceRoomStore.exists(roomCode)) {
                continue;
            }

            RaceRoom raceRoom = new RaceRoom(roomCode, textType, isPrivate, hostUserId);
            TextResponseDTO text = (textType != null) ? textService.getRandomTextByType(textType) : textService.getRandomText();
            raceRoom.setText(text);
            raceRoomStore.put(raceRoom);
            raceRoomStore.persist(raceRoom);

            return roomCode;

        }
        throw new RuntimeException();

    }

    public RaceRoom joinRoom(String roomCode, Long userId) {
        RaceRoom raceRoom = getRoom(roomCode);
        User user = userRepository.findByIdWithRole(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));

        synchronized (raceRoom) {
            if (!raceRoom.getState().equals(RaceState.LOBBY)) {
                return raceRoom; // return current state so late joiner gets broadcast of actual room state
            }

            if (raceRoom.findParticipant(userId) != null) {
                return raceRoom;
            }

            if (raceRoom.getParticipants().size() >= 8) {
                throw new InvalidResourceException("Race room is already full");
            }

            RaceParticipant raceParticipant = new RaceParticipant(userId, user.getUsername());
            raceRoom.getParticipants().add(raceParticipant);

            raceRoomStore.persist(raceRoom);

            return raceRoom;
        }
    }

    public RaceRoom markConnected(String roomCode, Long userId, String sessionId) {
        RaceRoom raceRoom = getRoom(roomCode);

        synchronized (raceRoom) {
            RaceParticipant participant = raceRoom.findParticipant(userId);
            if (participant == null) {
                return raceRoom;
            }
            participant.setConnected(true);
            participant.setSessionId(sessionId);
            if (raceRoom.getState() == RaceState.LOBBY) {
                participant.setDisconnected(false);
            }
            raceRoomStore.persist(raceRoom);
            return raceRoom;
        }
    }

    private long countConnected(RaceRoom raceRoom) {
        return raceRoom.getParticipants().stream()
                .filter(RaceParticipant::isConnected)
                .count();
    }

    public RaceRoom startRoom(String roomCode, Long userId) {
        RaceRoom raceRoom = getRoom(roomCode);
        boolean isPublicRoom = raceRoom.getHostUserId() == null;
        if (!isPublicRoom && !raceRoom.isHost(userId)) {
            throw new UnauthorizedResourceException("Only the room creator can start the race");
        }

        synchronized (raceRoom) {
            if (!raceRoom.getState().equals(RaceState.LOBBY)) {
                return raceRoom;
            }

            if (countConnected(raceRoom) < 2) {
                throw new InvalidResourceException("Must have at least 2 connected participants to start the race");
            }

            raceRoom.setState(RaceState.COUNTDOWN);
            raceRoom.setCountdownStartTime(Instant.now());
            raceRoom.setCountdownDurationMs(COUNTDOWN_DURATION_MS);
            logger.info("Room {} entering COUNTDOWN; countdownStartTime={}, durationMs={}",
                    roomCode, raceRoom.getCountdownStartTime(), raceRoom.getCountdownDurationMs());
            raceRoomStore.persist(raceRoom);
            return raceRoom;
        }
    }

    public RaceRoom transitionToRacing(String roomCode) {
        RaceRoom raceRoom = getRoom(roomCode);

        synchronized (raceRoom) {
            if (!raceRoom.getState().equals(RaceState.COUNTDOWN)) {
                throw new InvalidResourceException("Cannot start race");
            }

            raceRoom.setState(RaceState.RACING);
            raceRoom.setStartTime(Instant.now());
            raceRoomStore.persist(raceRoom);
            return raceRoom;
        }
    }

    /**
     * Applies a progress tick in memory and returns a lightweight delta for broadcasting.
     * The room is intentionally NOT persisted to Redis here: this runs several times per
     * second per participant and only the final state matters.
     */
    public RaceProgressDTO updateProgress(String roomCode, Long userId, double progressPercent, int currentWpm, String typedContent) {
        RaceRoom raceRoom = getRoom(roomCode);

        synchronized (raceRoom) {
            if (!raceRoom.getState().equals(RaceState.RACING)) {
                throw new InvalidResourceException("Race is not in progress");
            }

            RaceParticipant raceParticipant = raceRoom.findParticipant(userId);
            if (raceParticipant == null) {
                throw new ResourceNotFoundException("Participant not found in room");
            }

            int errors = calculateErrors(typedContent, raceRoom.getText().content());
            raceParticipant.setProgressPercent(progressPercent);
            raceParticipant.setCurrentWpm(currentWpm);
            raceParticipant.setErrors(errors);

            return new RaceProgressDTO(userId, progressPercent, currentWpm, errors);
        }
    }

    public RaceRoom finishRace(String roomCode, Long userId, int finalWpm, int errors, int correctChars) {
        RaceRoom raceRoom = getRoom(roomCode);
        RaceParticipant raceParticipant;
        boolean roomFinished = false;

        synchronized (raceRoom) {
            if (!raceRoom.getState().equals(RaceState.RACING)) {
                throw new InvalidResourceException("Can't finish a not started race");
            }

            raceParticipant = raceRoom.findParticipant(userId);
            if (raceParticipant == null) {
                throw new ResourceNotFoundException("Participant not found in room");
            }

            if (raceParticipant.isFinished()) {
                return null;
            }

            raceParticipant.setFinishRank(raceRoom.getFinishCount() + 1);
            raceRoom.setFinishCount(raceRoom.getFinishCount() + 1);
            raceParticipant.setFinished(true);
            raceParticipant.setCurrentWpm(finalWpm);
            raceParticipant.setErrors(errors);
            raceParticipant.setCorrectChars(correctChars);
            raceParticipant.setAccuracy(computeAccuracy(correctChars, errors));

            if (raceRoom.allActiveFinished()) {
                raceRoom.setState(RaceState.FINISHED);
                raceRoom.setDurationSeconds((int) Math.max(0, Duration.between(raceRoom.getStartTime(), Instant.now()).toSeconds()));
                roomFinished = true;
            }

            raceRoomStore.persist(raceRoom);
        }

        raceParticipant.setLatestStreak(streakService.recordActivity(userId));

        if (roomFinished) {
            persistRacePublic(raceRoom);
        }

        return raceRoom;
    }

    public void persistRacePublic(RaceRoom raceRoom) {
        RaceSession raceSession = RaceSession.builder()
                .roomCode(raceRoom.getRoomCode())
                .textId(raceRoom.getText().textId())
                .textType(raceRoom.getTextType())
                .isPrivate(raceRoom.isPrivate())
                .startedAt(raceRoom.getStartTime())
                .finishedAt(Instant.now())
                .build();

        raceSessionRepository.save(raceSession);
        List<RaceResult> raceResults = raceRoom.getParticipants().stream().map(
                participant -> {
                    return RaceResult.builder()
                            .session(raceSession)
                            .userId(participant.getUserId())
                            .finishRank(participant.getFinishRank())
                            .finalWpm(participant.getCurrentWpm())
                            .errorCount(participant.getErrors())
                            .correctChars(participant.getCorrectChars())
                            .accuracy(participant.getAccuracy())
                            .finished(participant.isFinished())
                            .build();
                }).toList();

        raceResultRepository.saveAll(raceResults);

    }

    private int computeAccuracy(int correctChars, int errors) {
        int total = correctChars + errors;
        if (total <= 0) {
            return 0;
        }
        return (int) Math.round(correctChars * 100.0 / total);
    }

    private int calculateErrors(String typed, String passage) {
        int errors = 0;
        for (int i = 0; i < typed.length(); i++) {
            if (i >= passage.length() || typed.charAt(i) != passage.charAt(i)) {
                errors++;
            }
        }
        return errors;
    }

    private String generateRoomCode(){
        return RANDOM.ints(CODE_LENGTH, 0, ALPHANUMERIC.length())
                .mapToObj(ALPHANUMERIC::charAt)
                .map(Object::toString)
                .collect(Collectors.joining());

    }

}
