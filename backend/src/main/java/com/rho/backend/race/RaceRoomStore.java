package com.rho.backend.race;

import java.util.Optional;
import java.util.function.Function;

/**
 * Abstraction over the live race-room store: the authoritative home of in-flight room state.
 *
 * <p>Live state is read and written through Redis so every backend replica observes the same
 * room. Mutations that span more than one field must go through {@link #mutate(String, Function)}
 * which executes the supplied function under a per-room distributed lock, reloads the latest
 * room, applies the change, and writes it back atomically.
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

    /**
     * Applies {@code mutation} to the latest room state under a distributed lock and persists the
     * result. The function must not retain or mutate the room after returning. Returns empty when
     * the room no longer exists.
     */
    <T> Optional<T> mutate(String roomCode, Function<RaceRoom, T> mutation);
}
