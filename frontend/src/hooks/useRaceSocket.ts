import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { attemptTokenRefresh, getAccessToken } from '../services/api';
import { getRoomState } from '../services/race';
import type { RaceRoom } from '../types/race';

interface UseRaceSocketOpts {
  onMatchmakingRoomCode?: (code: string) => void;
}

export function useRaceSocket(roomCode: string | null, opts?: UseRaceSocketOpts) {
  const [room, setRoom] = useState<RaceRoom | null>(null);
  const [raceStreak, setRaceStreak] = useState<number | null>(null);
  const [prevRoomCode, setPrevRoomCode] = useState(roomCode);
  if (prevRoomCode !== roomCode) {
    setPrevRoomCode(roomCode);
    if (roomCode === null) {
      setRoom(null);
      setRaceStreak(null);
    }
  }
  const [connected, setConnected] = useState(false);
  const [isTokenReady, setIsTokenReady] = useState(false);
  const clientRef = useRef<Client | null>(null);
  const hasJoinedRef = useRef(false);
  const pendingFinishRef = useRef<{ finalWpm: number; errors: number; correctChars: number } | null>(null);

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

    hasJoinedRef.current = false;
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || '';
    const client = new Client({
      webSocketFactory: () => new SockJS(
        apiBase ? apiBase + '/ws' : 'http://localhost:8080/ws',
        null,
        { transports: ['websocket', 'xhr-streaming', 'xhr-polling'] }
      ),
      beforeConnect: (stompClient) => {
        stompClient.connectHeaders = { token: getAccessToken() ?? '' };
      },
      reconnectDelay: 5000,
    });

    client.onConnect = () => {
      console.info('[race-socket] connected to message broker');
      setConnected(true);

      if (roomCode) {
        client.subscribe(`/topic/room/${roomCode}`, (message) => {
          const raceRoom: RaceRoom = JSON.parse(message.body);
          setRoom(raceRoom);
        });

        if (!hasJoinedRef.current) {
          hasJoinedRef.current = true;
          client.publish({
            destination: `/app/room/${roomCode}/join`,
            body: JSON.stringify({}),
          });
        }

        if (pendingFinishRef.current !== null) {
          const pendingFinish = pendingFinishRef.current;
          pendingFinishRef.current = null;
          try {
            client.publish({
              destination: `/app/room/${roomCode}/finish`,
              body: JSON.stringify({ finalWpm: pendingFinish.finalWpm, errors: pendingFinish.errors, correctChars: pendingFinish.correctChars }),
            });
          } catch (err) {
            console.warn('[race-socket] finish redelivery failed; re-queued', err);
            pendingFinishRef.current = pendingFinish;
          }
        }

        // Fetch current room state immediately after subscribing in case we missed a broadcast
        getRoomState(roomCode).then(room => {
          if (room) setRoom(room);
        });
      }

      if (opts?.onMatchmakingRoomCode) {
        client.subscribe('/user/queue/matchmaking', (message) => {
          const code: string = message.body;
          opts!.onMatchmakingRoomCode!(code);
        });
      }

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
      hasJoinedRef.current = false;
      pendingFinishRef.current = null;
      client.deactivate();
      clientRef.current = null;
    };
  }, [roomCode, opts?.onMatchmakingRoomCode, isTokenReady]);

  const sendProgress = useCallback((progressPercent: number, currentWpm: number, typedContent: string) => {
    if (!clientRef.current?.connected || !roomCode) return;
    clientRef.current.publish({
      destination: `/app/room/${roomCode}/progress`,
      body: JSON.stringify({ progressPercent, currentWpm, typedContent }),
    });
  }, [roomCode]);

  const sendFinish = useCallback((finalWpm: number, errors: number, correctChars: number) => {
    if (!roomCode) return;
    if (!clientRef.current?.connected) {
      pendingFinishRef.current = { finalWpm, errors, correctChars };
      return;
    }
    clientRef.current.publish({
      destination: `/app/room/${roomCode}/finish`,
      body: JSON.stringify({ finalWpm, errors, correctChars }),
    });
  }, [roomCode]);

  const sendStart = useCallback(() => {
    if (!clientRef.current?.connected || !roomCode) return;
    clientRef.current.publish({
      destination: `/app/room/${roomCode}/start`,
      body: JSON.stringify({}),
    });
  }, [roomCode]);

  return { room, connected, raceStreak, sendProgress, sendFinish, sendStart };
}
