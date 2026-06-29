package com.rho.backend.service;

import com.rho.backend.dto.text.response.TextResponseDTO;
import com.rho.backend.enums.TextType;
import com.rho.backend.race.RaceRoom;
import com.rho.backend.repository.RaceRoomRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
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

    public String generateRoomCode(){

        return RANDOM.ints(CODE_LENGTH, 0, ALPHANUMERIC.length())
                .mapToObj(ALPHANUMERIC::charAt)
                .map(Object::toString)
                .collect(Collectors.joining());

    }
}
