import { check, sleep } from 'k6';
import ws from 'k6/ws';
import { Counter, Trend } from 'k6/metrics';
import {
  createRaceRoom,
  createTestUser,
  getRaceRoom,
} from './lib/api.js';
import { WS_URL } from './config.js';
import { makeSummary } from './lib/summary.js';

const connectDuration = new Trend('ws_connect_duration', true);
const countdownDuration = new Trend('ws_countdown_duration', true);
const raceDuration = new Trend('ws_race_duration', true);
const racesCompleted = new Counter('ws_races_completed');
const wsErrors = new Counter('ws_errors');

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    race: {
      executor: 'per-vu-iterations',
      vus: 3,
      iterations: 1,
      maxDuration: '45s',
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    ws_connect_duration: ['p(95)<2000'],
    ws_countdown_duration: ['p(95)<7000'],
    ws_race_duration: ['p(95)<15000'],
    ws_errors: ['count<1'],
  },
};

export function setup() {
  const host = createTestUser('ws-host', 0);
  const guest = createTestUser('ws-guest', 1);
  const roomCode = createRaceRoom(host.token, { textType: 'SHORT', isPrivate: true });
  return {
    roomCode,
    hostToken: host.token,
    guestToken: guest.token,
  };
}

function stompFrame(command, headers, body) {
  const lines = [command];
  Object.keys(headers || {}).forEach((key) => {
    lines.push(`${key}:${headers[key]}`);
  });
  return `${lines.join('\n')}\n\n${body || ''}\u0000`;
}

function sendStomp(socket, command, headers, body) {
  socket.send(stompFrame(command, headers, body));
}

function parseFrames(raw, onFrame) {
  raw.split('\u0000').forEach((chunk) => {
    const frame = chunk.replace(/^\n+/, '');
    if (!frame) return;

    const separator = frame.indexOf('\n\n');
    const headerBlock = separator >= 0 ? frame.slice(0, separator) : frame;
    const body = separator >= 0 ? frame.slice(separator + 2) : '';
    const lines = headerBlock.split('\n');
    const command = lines.shift();
    const headers = {};

    lines.forEach((line) => {
      const colon = line.indexOf(':');
      if (colon > 0) {
        headers[line.slice(0, colon)] = line.slice(colon + 1);
      }
    });

    onFrame(command, headers, body);
  });
}

function sendJson(socket, destination, payload) {
  const body = JSON.stringify(payload);
  sendStomp(socket, 'SEND', {
    destination,
    'content-type': 'application/json',
    'content-length': body.length,
  }, body);
}

function runRace(data) {
  const role = __VU === 1 ? 'guest' : __VU === 2 ? 'host' : 'starter';
  const token = role === 'guest' ? data.guestToken : data.hostToken;
  let connected = false;
  let reachedRacing = false;
  let completed = false;
  let progressTimer = null;
  let finishTimer = null;
  let startSentAt = 0;

  if (role === 'starter') {
    let participantsConnected = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const room = getRaceRoom(data.hostToken, data.roomCode).body;
      const participants = (room && room.participants) || [];
      if (participants.filter((p) => p.connected).length >= 2) {
        participantsConnected = true;
        break;
      }
      sleep(0.2);
    }

    if (!check(participantsConnected, {
      'two participants connected before start': (value) => value === true,
    })) {
      wsErrors.add(1);
      return;
    }
  }

  const connectStarted = Date.now();
  const res = ws.connect(WS_URL, { tags: { endpoint: 'race_ws' } }, (socket) => {
    socket.on('open', () => {
      sendStomp(socket, 'CONNECT', {
        'accept-version': '1.2',
        'heart-beat': '0,0',
        token,
      }, '');
    });

    socket.on('message', (raw) => {
      parseFrames(raw, (command, headers, body) => {
        if (command === 'CONNECTED') {
          connected = true;
          connectDuration.add(Date.now() - connectStarted);
          check(true, { 'stomp connected': (value) => value === true });

          sendStomp(socket, 'SUBSCRIBE', {
            id: `room-${__VU}`,
            destination: `/topic/room/${data.roomCode}`,
          }, '');

          if (role === 'starter') {
            startSentAt = Date.now();
            sendStomp(socket, 'SEND', {
              destination: `/app/room/${data.roomCode}/start`,
              'content-length': 0,
            }, '');
          } else {
            sendStomp(socket, 'SEND', {
              destination: `/app/room/${data.roomCode}/join`,
              'content-length': 0,
            }, '');
          }
          return;
        }

        if (command === 'MESSAGE') {
          let room;
          try {
            room = JSON.parse(body);
          } catch (e) {
            wsErrors.add(1);
            check(false, { 'race message is valid JSON': () => false });
            return;
          }

          if (room.state === 'RACING' && !reachedRacing) {
            reachedRacing = true;
            check(true, { 'race reached RACING': (value) => value === true });

            if (role === 'starter') {
              countdownDuration.add(Date.now() - startSentAt);
            } else {
              let progress = 0;
              progressTimer = socket.setInterval(() => {
                progress = Math.min(100, progress + 20);
                sendJson(socket, `/app/room/${data.roomCode}/progress`, {
                  progressPercent: progress,
                  currentWpm: 80 + progress,
                  errors: progress >= 100 ? 2 : 0,
                });
              }, 300);

              finishTimer = socket.setTimeout(() => {
                if (progressTimer) {
                  socket.clearInterval(progressTimer);
                  progressTimer = null;
                }
                sendJson(socket, `/app/room/${data.roomCode}/finish`, {
                  finalWpm: 110,
                  errors: 2,
                  correctChars: 250,
                });
              }, 2200);
            }
          }

          if (room.state === 'FINISHED' && !completed) {
            completed = true;
            racesCompleted.add(1);
            raceDuration.add(Date.now() - connectStarted);
            check(true, { 'race completed': (value) => value === true });
            socket.close();
          }
          return;
        }

        if (command === 'ERROR') {
          wsErrors.add(1);
          check(false, { 'stomp returned an error frame': () => false });
          socket.close();
        }
      });
    });

    socket.on('error', () => {
      wsErrors.add(1);
      check(false, { 'websocket error': () => false });
    });

    socket.on('close', () => {
      if (progressTimer) {
        socket.clearInterval(progressTimer);
        progressTimer = null;
      }
      if (finishTimer) {
        socket.clearTimeout(finishTimer);
        finishTimer = null;
      }
    });

    socket.setTimeout(() => {
      if (!completed) {
        wsErrors.add(1);
        check(false, { 'race completed before timeout': () => false });
      }
      socket.close();
    }, 20000);
  });

  check(res, {
    'websocket handshake status 101': (r) => !!r && r.status === 101,
  });

  if (connected && !reachedRacing) {
    wsErrors.add(1);
  }
}

export default function race(data) {
  runRace(data);
}

export const handleSummary = makeSummary({
  name: 'websocket',
  notes: [
    'Three VUs run one private race: guest participant, host participant, and starter.',
    'Participants subscribe, join via STOMP, send progress ticks and finish frames.',
    'Starter opens a STOMP connection only after REST polling confirms two connected participants.',
    'Countdown duration measures start-send to the RACING broadcast; it should be close to 3500ms.',
  ],
});
