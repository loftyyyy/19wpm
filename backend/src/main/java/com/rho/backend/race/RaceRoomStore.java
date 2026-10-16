package com.rho.backend.race;

import java.util.Optional;

/**
 * Abstraction over the live race-room store: the authoritative home of in-flight room state.
 *
 * <p>Two distinct concerns are deliberately separated by this seam. Live room state is held by
 * {@link #get(String)} / {@link #put(RaceRoom)} (fast, mutable, read on every progress tick),
 * whereas {@link #persist(RaceRoom)} is the durable write-through to Redis that is only invoked on
 * room lifecycle transitions (create / join / start / racing / finish / disconnect), never per
 * progress tick.
 *
 * <p>The only implementation today, {@link InMemoryRaceRoomStore}, keeps that authoritative state
 * in a single JVM. The application therefore assumes a <strong>single backend instance</strong>
 * (or sticky routing of a room's participants to one instance). Swapping in a distributed
 * implementation — shared state plus cross-instance broadcast — is the scale-out path; see
 * {@code docs/refactors/17-race-room-store-seam.md}.
 */
public interface RaceRoomStore {

    /** Returns the live room, transparently loading it from the durable layer on a miss. */
    Optional<RaceRoom> get(String roomCode);

    /** Returns whether a room exists, either live or in the durable layer. */
    boolean exists(String roomCode);

    /** Registers a freshly created room as live. Call {@link #persist(RaceRoom)} to make it durable. */
    void put(RaceRoom room);

    /** Writes the room through to the durable layer. Call on lifecycle transitions, not per tick. */
    void persist(RaceRoom room);

    /** Removes the room from both the live and durable layers. */
    void remove(String roomCode);
}
