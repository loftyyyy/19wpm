import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getAccessToken } from '../services/api';
import type { RaceRoom } from '../types/race';

interface UseRaceSocketOpts {
  onMatchmakingRoomCode?: (code: string) => void;
}

export function useRaceSocket(roomCode: string | null, opts?: UseRaceSocketOpts) {
  const [room, setRoom] = useState<RaceRoom | null>(null);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    const wsHost = import.meta.env.VITE_WS_HOST || 'localhost:8080';
    const wsProtocol = import.meta.env.VITE_WS_HOST ? 'https' : 'http';
    const wsUrl = `${wsProtocol}://${wsHost}/ws`;
    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
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
      client.deactivate();
      clientRef.current = null;
    };
  }, [roomCode, opts?.onMatchmakingRoomCode]);

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
