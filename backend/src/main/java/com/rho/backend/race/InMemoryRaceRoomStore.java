package com.rho.backend.race;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.rho.backend.repository.RaceRoomRepository;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;

/**
 * In-memory, single-node implementation of {@link RaceRoomStore}.
 *
 * <p>Live room state is mutated in memory so that high-frequency progress updates never
 * round-trip the whole room through Redis. Redis is retained as a persistence layer and is
 * written on room lifecycle transitions only (create / join / start / racing / finish /
 * disconnect) via {@link #persist(RaceRoom)}.
 *
 * <p>Callers must guard multi-field mutations with {@code synchronized (room)} on the
 * instance returned by {@link #get(String)} so that concurrent updates cannot be lost.
 *
 * <p>Because the live cache is process-local, this implementation assumes a single backend
 * instance (or sticky routing of a room's participants to one instance). See
 * {@code docs/refactors/17-race-room-store-seam.md} for the scale-out path.
 */
@Component
public class InMemoryRaceRoomStore implements RaceRoomStore {

    private final Cache<String, RaceRoom> liveRooms;
    private final RaceRoomRepository raceRoomRepository;

    public InMemoryRaceRoomStore(RaceRoomRepository raceRoomRepository) {
        this.raceRoomRepository = raceRoomRepository;
        this.liveRooms = Caffeine.newBuilder()
                .expireAfterAccess(Duration.ofMinutes(30))
                .maximumSize(10_000)
                .build();
    }

    @Override
    public Optional<RaceRoom> get(String roomCode) {
        RaceRoom room = liveRooms.get(roomCode, code ->
                raceRoomRepository.findByCode(code).orElse(null));
        return Optional.ofNullable(room);
    }

    @Override
    public boolean exists(String roomCode) {
        return liveRooms.getIfPresent(roomCode) != null || raceRoomRepository.exists(roomCode);
    }

    @Override
    public void put(RaceRoom room) {
        liveRooms.put(room.getRoomCode(), room);
    }

    @Override
    public void persist(RaceRoom room) {
        raceRoomRepository.save(room);
    }

    @Override
    public void remove(String roomCode) {
        liveRooms.invalidate(roomCode);
        raceRoomRepository.delete(roomCode);
    }
}
