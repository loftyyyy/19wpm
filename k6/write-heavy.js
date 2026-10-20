import { Counter, Trend } from 'k6/metrics';
import {
  createTestUser,
  getRandomText,
  submitResult,
} from './lib/api.js';
import { makeSummary } from './lib/summary.js';

const USER_COUNT = 10;
const resultDuration = new Trend('write_result_duration', true);
const resultsCreated = new Counter('write_results_created');

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    writes: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.WRITE_RATE || 25),
      timeUnit: '1s',
      duration: __ENV.WRITE_DURATION || '2m',
      preAllocatedVUs: 10,
      maxVUs: 30,
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
    write_result_duration: ['p(95)<2000'],
  },
};

export function setup() {
  const users = [];
  for (let i = 0; i < USER_COUNT; i += 1) {
    users.push(createTestUser('write', i));
  }
  const text = getRandomText(null).json();
  if (!text || !text.textId) {
    throw new Error('write setup could not load a random text');
  }
  return {
    users,
    textId: text.textId,
  };
}

export default function writes(data) {
  const user = data.users[(__VU - 1) % data.users.length];
  const offsetMs = (__VU * 137) + ((__ITER % 100000) * 1000);
  const finishedAt = new Date(Date.now() - offsetMs).toISOString().slice(0, 23);

  const res = submitResult(user.token, {
    textId: data.textId,
    finishedAt,
    durationMs: 30000,
    timeConstraintMs: 60000,
    wpm: Math.round((40 + Math.random() * 80) * 100) / 100,
    accuracy: Math.round((90 + Math.random() * 10) * 100) / 100,
    textContent: 'Load test result content for the authenticated result endpoint.',
    mode: 'TEXT',
  });

  resultDuration.add(res.timings.duration);
  resultsCreated.add(1);
}

export const handleSummary = makeSummary({
  name: 'write-heavy',
  notes: [
    '25 result writes per second for 2 minutes.',
    `Writes are spread across ${USER_COUNT} disposable users.`,
    'finishedAt values are deliberately unique per write to avoid duplicate-result rejection.',
  ],
});
