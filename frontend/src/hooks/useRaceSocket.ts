import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { attemptTokenRefresh, getAccessToken, getAccessTokenExpiry } from '../services/api';
import { getRoomState } from '../services/race';
import { createProgressPublisher, type ProgressPublisher } from '../utils/progressThrottle';
import { createRaceRoomStore, type RaceRoomStore } from '../utils/raceRoomStore';
import type { RaceRoom } from '../types/race';

/** One outgoing progress message per 100 ms, with a trailing flush on finish. */
const PROGRESS_INTERVAL_MS = 100;

export interface RaceSocket {
  /** External room store; the page subscribes to narrow slices of it. */
  roomStore: RaceRoomStore;
  connected: boolean;
  raceStreak: number | null;
  serverOffsetMs: number;
  sendProgress: (progressPercent: number, currentWpm: number, errors: number) => void;
  sendFinish: (finalWpm: number, errors: number, correctChars: number, keyIntervalsMs?: number[]) => void;
  sendStart: () => void;
}

/**
 * Connects to the race STOMP endpoint for the duration of a room.
 *
 * The optional `onMatchmakingRoomCode` handler is intentionally *not* a dependency
 * of the connection effect: it is usually an inline arrow function from the caller,
 * so including it would tear down and re-open the socket on every parent render.
 * The latest handler is mirrored into a ref and read inside the subscription.
 */
export function useRaceSocket(
  roomCode: string | null,
  onMatchmakingRoomCode?: (code: string) => void
): RaceSocket {
  const [roomStore] = useState<RaceRoomStore>(() => createRaceRoomStore());
  const [raceStreak, setRaceStreak] = useState<number | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [connected, setConnected] = useState(false);
  const [isTokenReady, setIsTokenReady] = useState(false);
  const clientRef = useRef<Client | null>(null);
  const bestRttRef = useRef(Number.POSITIVE_INFINITY);
  const pendingFinishRef = useRef<{ finalWpm: number; errors: number; correctChars: number; keyIntervalsMs: number[] } | null>(null);
  const progressPublisherRef = useRef<ProgressPublisher | null>(null);
  // Latest matchmaking handler, kept out of the connection effect's deps (see below).
  const onMatchmakingRoomCodeRef = useRef(onMatchmakingRoomCode);

  useEffect(() => {
    onMatchmakingRoomCodeRef.current = onMatchmakingRoomCode;
  }, [onMatchmakingRoomCode]);

  // Clearing the streak is a render-phase adjustment keyed on the room code, the
  // same guarded pattern the old room `useState` used. The store clear itself is
  // an effect: notifying its subscribers during render is unsafe.
  const [prevRoomCode, setPrevRoomCode] = useState(roomCode);
  if (prevRoomCode !== roomCode) {
    setPrevRoomCode(roomCode);
    if (roomCode === null) setRaceStreak(null);
  }

  useEffect(() => {
    if (roomCode !== null) return;
    roomStore.set(null);
  }, [roomCode, roomStore]);

  // The publisher belongs to one room. Disposing on change drops a queued tick
  // that would otherwise be published to the room the user just left.
  useEffect(() => {
    if (!roomCode) return;

    const publisher = createProgressPublisher({
      intervalMs: PROGRESS_INTERVAL_MS,
      send: ({ progressPercent, currentWpm, errors }) => {
        const client = clientRef.current;
        if (!client?.connected) return;
        client.publish({
          destination: `/app/room/${roomCode}/progress`,
          body: JSON.stringify({ progressPercent, currentWpm, errors }),
        });
      },
    });
    progressPublisherRef.current = publisher;

    return () => {
      publisher.dispose();
      if (progressPublisherRef.current === publisher) {
        progressPublisherRef.current = null;
      }
    };
  }, [roomCode]);

  useEffect(() => {
    let cancelled = false;

    async function ensureValidToken() {
      const token = getAccessToken();
      if (!token) {
        setIsTokenReady(false);
        return;
      }
      const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || '';
      try {
        const res = await fetch(`${apiBase}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (cancelled) return;
        if (res.ok) {
          setIsTokenReady(true);
          return;
        }
        if (res.status === 401) {
          console.info('[race-socket] access token rejected (401); refreshing via shared gate');
          const refreshed = await attemptTokenRefresh();
          if (cancelled) return;
          console.info(refreshed
            ? '[race-socket] token refreshed; connecting'
            : '[race-socket] token refresh failed; staying disconnected');
          setIsTokenReady(refreshed);
          return;
        }
        console.warn(`[race-socket] /auth/me returned ${res.status}; deferring connection`);
        setIsTokenReady(false);
      } catch (err) {
        if (!cancelled) {
          console.warn('[race-socket] /auth/me check failed', err);
          setIsTokenReady(false);
        }
      }
    }

    void ensureValidToken();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isTokenReady) return;

    let active = true;
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || '';
    const client = new Client({
      webSocketFactory: () => new SockJS(
        apiBase ? apiBase + '/ws' : 'http://localhost:8080/ws',
        null,
        { transports: ['websocket', 'xhr-streaming', 'xhr-polling'] }
      ),
      beforeConnect: async (stompClient) => {
        const expiry = getAccessTokenExpiry();
        if (expiry !== null && expiry - Date.now() < 30_000) {
          await attemptTokenRefresh();
        }
        stompClient.connectHeaders = { token: getAccessToken() ?? '' };
      },
      reconnectDelay: 5000,
    });

    client.onConnect = () => {
      console.info('[race-socket] connected to message broker');
      setConnected(true);

      bestRttRef.current = Number.POSITIVE_INFINITY;
      client.subscribe('/user/queue/time', (message) => {
        const sample: { clientSentAt: number; serverReceivedAt: number; serverSentAt: number } =
          JSON.parse(message.body);
        const t4 = Date.now();
        const roundTrip = (t4 - sample.clientSentAt) - (sample.serverSentAt - sample.serverReceivedAt);
        const offset = ((sample.serverReceivedAt - sample.clientSentAt) + (sample.serverSentAt - t4)) / 2;
        if (roundTrip < bestRttRef.current) {
          bestRttRef.current = roundTrip;
          setServerOffsetMs(Math.round(offset));
        }
      });
      [0, 200, 400].forEach((delay) => {
        setTimeout(() => {
          if (active && client.connected) {
            client.publish({
              destination: '/app/time',
              body: JSON.stringify({ clientSentAt: Date.now() }),
            });
          }
        }, delay);
      });

      if (roomCode) {
        client.subscribe(`/topic/room/${roomCode}`, (message) => {
          if (!active) return;
          const raceRoom: RaceRoom = JSON.parse(message.body);
          roomStore.set(raceRoom);
        });

        // High-frequency progress deltas are broadcast separately from full room state
        // so the server only sends the changed participant fields per tick.
        client.subscribe(`/topic/room/${roomCode}/progress`, (message) => {
          if (!active) return;
          const delta: { userId: number; progressPercent: number; currentWpm: number; errors: number } =
            JSON.parse(message.body);
          roomStore.applyProgress(delta);
        });

        client.subscribe('/user/queue/race-resume', (message) => {
          if (!active) return;
          const raceRoom: RaceRoom = JSON.parse(message.body);
          roomStore.set(raceRoom);
        });

        // Reconnecting clients re-join on every connect. The backend treats join as
        // idempotent and replies with a targeted snapshot on /user/queue/race-resume,
        // so a player can recover mid-race after a network drop or replica restart.
        client.publish({
          destination: `/app/room/${roomCode}/join`,
          body: JSON.stringify({}),
        });

        if (pendingFinishRef.current !== null) {
          const pendingFinish = pendingFinishRef.current;
          pendingFinishRef.current = null;
          try {
            client.publish({
              destination: `/app/room/${roomCode}/finish`,
              body: JSON.stringify({ finalWpm: pendingFinish.finalWpm, errors: pendingFinish.errors, correctChars: pendingFinish.correctChars, keyIntervalsMs: pendingFinish.keyIntervalsMs }),
            });
          } catch (err) {
            console.warn('[race-socket] finish redelivery failed; re-queued', err);
            pendingFinishRef.current = pendingFinish;
          }
        }

        // Fetch current room state immediately after subscribing in case we missed a broadcast
        getRoomState(roomCode).then(room => {
          if (active && room) roomStore.set(room);
        });
      }

      client.subscribe('/user/queue/matchmaking', (message) => {
        onMatchmakingRoomCodeRef.current?.(message.body);
      });

      client.subscribe('/user/queue/race-finish', (message) => {
        const dto: { streak?: number | null } = JSON.parse(message.body);
        if (typeof dto.streak === 'number') {
          setRaceStreak(dto.streak);
        }
      });
    };

    client.onDisconnect = () => {
      console.info('[race-socket] disconnected from message broker');
      setConnected(false);
    };

    client.onStompError = (frame) => {
      console.warn('[race-socket] STOMP error:', frame.headers?.message);
    };

    client.onWebSocketClose = () => {
      console.warn('[race-socket] websocket closed');
      setConnected(false);
    };

    client.activate();
    clientRef.current = client;

    return () => {
      active = false;
      pendingFinishRef.current = null;
      client.deactivate();
      clientRef.current = null;
    };
  }, [roomCode, isTokenReady, roomStore]);

  const sendProgress = useCallback((progressPercent: number, currentWpm: number, errors: number) => {
    progressPublisherRef.current?.push({ progressPercent, currentWpm, errors });
  }, []);

  const sendFinish = useCallback((finalWpm: number, errors: number, correctChars: number, keyIntervalsMs: number[] = []) => {
    // Deliver the newest progress before the finish message so the server sees
    // the completed run, not the last 100 ms sample plus a jump.
    progressPublisherRef.current?.flush();
    if (!roomCode) return;
    if (!clientRef.current?.connected) {
      pendingFinishRef.current = { finalWpm, errors, correctChars, keyIntervalsMs };
      return;
    }
    clientRef.current.publish({
      destination: `/app/room/${roomCode}/finish`,
      body: JSON.stringify({ finalWpm, errors, correctChars, keyIntervalsMs }),
    });
  }, [roomCode]);

  const sendStart = useCallback(() => {
    if (!clientRef.current?.connected || !roomCode) return;
    clientRef.current.publish({
      destination: `/app/room/${roomCode}/start`,
      body: JSON.stringify({}),
    });
  }, [roomCode]);

  return { roomStore, connected, raceStreak, serverOffsetMs, sendProgress, sendFinish, sendStart };
}
