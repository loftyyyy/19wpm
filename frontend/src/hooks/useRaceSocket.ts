import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getAccessToken } from '../services/api';
import { getRoomState } from '../services/race';
import type { RaceRoom } from '../types/race';

interface UseRaceSocketOpts {
  onMatchmakingRoomCode?: (code: string) => void;
}

export function useRaceSocket(roomCode: string | null, opts?: UseRaceSocketOpts) {
  const [room, setRoom] = useState<RaceRoom | null>(null);
  const [connected, setConnected] = useState(false);
  const [isTokenReady, setIsTokenReady] = useState(false);
  const clientRef = useRef<Client | null>(null);
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsTokenReady(false);
      return;
    }
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || '';
    fetch(`${apiBase}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(async res => {
      if (res.ok) {
        setIsTokenReady(true);
      } else if (res.status === 401) {
        const refreshToken = localStorage.getItem('19wpm-refresh-token');
        if (!refreshToken) { setIsTokenReady(false); return; }
        const refreshRes = await fetch(`${apiBase}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem('19wpm-access-token', data.accessToken);
          localStorage.setItem('19wpm-refresh-token', data.refreshToken);
          setIsTokenReady(true);
        } else {
          setIsTokenReady(false);
        }
      }
    }).catch(() => setIsTokenReady(false));
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
      connectHeaders: { token: getAccessToken() ?? '' },
      reconnectDelay: 5000,
    });

    client.onConnect = () => {
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
    };

    client.onDisconnect = () => {
      setConnected(false);
    };

    client.activate();
    clientRef.current = client;

    return () => {
      hasJoinedRef.current = false;
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

  const sendFinish = useCallback((finalWpm: number) => {
    if (!clientRef.current?.connected || !roomCode) return;
    clientRef.current.publish({
      destination: `/app/room/${roomCode}/finish`,
      body: JSON.stringify({ finalWpm }),
    });
  }, [roomCode]);

  const sendStart = useCallback(() => {
    if (!clientRef.current?.connected || !roomCode) return;
    clientRef.current.publish({
      destination: `/app/room/${roomCode}/start`,
      body: JSON.stringify({}),
    });
  }, [roomCode]);

  return { room, connected, sendProgress, sendFinish, sendStart };
}
