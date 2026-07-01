package com.rho.backend.service;

import com.rho.backend.dto.text.response.TextResponseDTO;
import com.rho.backend.enums.RaceState;
import com.rho.backend.enums.TextType;
import com.rho.backend.exception.InvalidResourceException;
import com.rho.backend.exception.UnauthorizedResourceException;
import com.rho.backend.exception.user.DuplicateResourceException;
import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.race.RaceParticipant;
import com.rho.backend.race.RaceRoom;
import com.rho.backend.repository.RaceRoomRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class RaceService {
    private final TextService textService;
    private final RaceRoomRepository raceRoomRepository;
    private static final String ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int CODE_LENGTH = 6;
    private static final Logger logger = LoggerFactory.getLogger(RaceService.class);

    public RaceService(TextService textService, RaceRoomRepository raceRoomRepository){
        this.textService = textService;
        this.raceRoomRepository = raceRoomRepository;
    }

    public String createRoom(Long hostUserId, TextType textType, boolean isPrivate){
        int maxAttempts = 5;
        String roomCode;

        for(int i = 0; i < maxAttempts; i++){
            roomCode = generateRoomCode();

            if(raceRoomRepository.exists(roomCode)){
                continue;
            }

            RaceRoom raceRoom = new RaceRoom(roomCode, textType, isPrivate, hostUserId);
            TextResponseDTO text = (textType != null) ? textService.getRandomTextByType(textType) : textService.getRandomText();
            raceRoom.setText(text);
            raceRoomRepository.save(raceRoom);

            return roomCode;

        }
        throw new RuntimeException();

    }

    public RaceRoom joinRoom(String roomCode, Long userId, String username){
        RaceRoom raceRoom = raceRoomRepository.findByCode(roomCode).orElseThrow(() -> new ResourceNotFoundException("Room code not found"));

        if(!raceRoom.getState().equals(RaceState.LOBBY)){
            throw new InvalidResourceException("Race already started");
        }

        if(raceRoom.findParticipant(userId) != null){
            throw new DuplicateResourceException("Participant already exists");
        }

        if (raceRoom.getParticipants().size() >= 8){
            throw new InvalidResourceException("Race room is already full");
        }

        RaceParticipant raceParticipant = new RaceParticipant(userId, username);
        raceRoom.getParticipants().add(raceParticipant);

        raceRoomRepository.save(raceRoom);

        return raceRoom;
    }

    public RaceRoom startRoom(String roomCode, Long userId){
        RaceRoom raceRoom = raceRoomRepository.findByCode(roomCode).orElseThrow(() -> new ResourceNotFoundException("Room code not found"));
        if(!raceRoom.isHost(userId)){
            throw new UnauthorizedResourceException("Only the room creator can start the race");
        }

        if(!raceRoom.getState().equals(RaceState.LOBBY)){
            throw new InvalidResourceException("Race already started");
        }

        if(raceRoom.getParticipants().size() < 2){
            throw new InvalidResourceException("Must have at least 2 participants to start the race");
        }

        raceRoom.setState(RaceState.COUNTDOWN);
        raceRoomRepository.save(raceRoom);
        return raceRoom;
    }

    public RaceRoom transitionToRacing(String roomCode){
        RaceRoom raceRoom = raceRoomRepository.findByCode(roomCode).orElseThrow(() -> new ResourceNotFoundException("Room code not found"));

        if (!raceRoom.getState().equals(RaceState.COUNTDOWN)) {
            throw new InvalidResourceException("Cannot start race");
        }

        raceRoom.setState(RaceState.RACING);
        raceRoom.setStartTime(Instant.now());
        raceRoomRepository.save(raceRoom);
        return raceRoom;
    }

    public String generateRoomCode(){

        return RANDOM.ints(CODE_LENGTH, 0, ALPHANUMERIC.length())
                .mapToObj(ALPHANUMERIC::charAt)
                .map(Object::toString)
                .collect(Collectors.joining());

    }
}
