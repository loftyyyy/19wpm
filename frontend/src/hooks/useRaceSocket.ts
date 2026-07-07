import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import { getAccessToken } from '../services/api';
import type { RaceRoom } from '../types/race';

export function useRaceSocket(roomCode: string | null) {
  const [room, setRoom] = useState<RaceRoom | null>(null);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    const wsHost = import.meta.env.VITE_WS_HOST || 'localhost:8080';
    const client = new Client({
      brokerURL: `ws://${wsHost}/ws`,
      connectHeaders: { token: getAccessToken() ?? '' },
      reconnectDelay: 5000,
    });

    client.onConnect = () => {
      setConnected(true);
      client.subscribe(`/topic/room/${roomCode}`, (message) => {
        const raceRoom: RaceRoom = JSON.parse(message.body);
        setRoom(raceRoom);
      });
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
  }, [roomCode]);

  const sendProgress = useCallback((progressPercent: number, currentWpm: number, typedContent: string) => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: `/app/room/${roomCode}/progress`,
      body: JSON.stringify({ progressPercent, currentWpm, typedContent }),
    });
  }, [roomCode]);

  const sendFinish = useCallback((finalWpm: number) => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: `/app/room/${roomCode}/finish`,
      body: JSON.stringify({ finalWpm }),
    });
  }, [roomCode]);

  const sendStart = useCallback(() => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: `/app/room/${roomCode}/start`,
      body: JSON.stringify({}),
    });
  }, [roomCode]);

  return { room, connected, sendProgress, sendFinish, sendStart };
}
