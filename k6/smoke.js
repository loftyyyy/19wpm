import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import {
  createTestUser,
  getMe,
  getRandomText,
  getResults,
  getStats,
  getTextBatch,
  getTextById,
  getWords,
  login,
  logout,
  refreshToken,
  submitResult,
} from './lib/api.js';
import { makeSummary } from './lib/summary.js';

const flowDuration = new Trend('smoke_flow_duration', true);

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    smoke_flow_duration: ['p(95)<5000'],
  },
};

export function setup() {
  const user = createTestUser('smoke', 0);
  const randomText = getRandomText(user.token);
  const textBody = randomText.json();
  const words = getWords(user.token);
  if (!textBody || !textBody.textId || !words.status) {
    throw new Error('smoke setup could not load test data');
  }
  return {
    token: user.token,
    email: user.email,
    password: user.password,
    textId: textBody.textId,
  };
}

export default function smoke(data) {
  const startedAt = Date.now();

  getMe(data.token);
  getStats(data.token);
  getRandomText(null);
  getTextBatch(null);
  getWords(null);
  getTextById(data.token, data.textId);

  const result = submitResult(data.token, {
    textId: data.textId,
    durationMs: 30000,
    timeConstraintMs: 60000,
    wpm: 72.25,
    accuracy: 98.5,
    textContent: 'The quick brown fox jumps over the lazy dog.',
    mode: 'TEXT',
  });
  check(result, { 'smoke result accepted': (r) => r.status === 201 });

  getResults(data.token);

  const session = login(data.email, data.password);
  const rotated = refreshToken(session.refreshToken);
  getMe(rotated.accessToken);
  logout(rotated.accessToken, rotated.refreshToken);

  flowDuration.add(Date.now() - startedAt);
  sleep(0.2);
}

export const handleSummary = makeSummary({
  name: 'smoke',
  notes: [
    'One VU, one complete user journey over HTTP.',
    'Covers signup, reads, result write, result history, login, refresh, and logout.',
  ],
});
