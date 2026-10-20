import { sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import {
  createTestUser,
  getRandomText,
  getResults,
  getStats,
  performRead,
  READ_ENDPOINTS,
  submitResult,
} from './lib/api.js';
import { makeSummary } from './lib/summary.js';

const readDuration = new Trend('mixed_read_duration', true);
const writeDuration = new Trend('mixed_write_duration', true);
const mixedReads = new Counter('mixed_reads_completed');
const mixedWrites = new Counter('mixed_writes_completed');

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    mixed: {
      executor: 'constant-vus',
      vus: Number(__ENV.MIXED_VUS || 20),
      duration: __ENV.MIXED_DURATION || '2m',
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
    mixed_read_duration: ['p(95)<1500'],
    mixed_write_duration: ['p(95)<2000'],
  },
};

export function setup() {
  const user = createTestUser('mixed', 0);
  const text = getRandomText(null).json();
  if (!text || !text.textId) {
    throw new Error('mixed setup could not load a random text');
  }
  return {
    token: user.token,
    textId: text.textId,
  };
}

export default function mixed(data) {
  const roll = Math.random();

  if (roll < 0.70) {
    const endpoint = READ_ENDPOINTS[Math.floor(Math.random() * READ_ENDPOINTS.length)];
    const res = performRead(endpoint, data.token, data.textId);
    readDuration.add(res.timings.duration);
    mixedReads.add(1);
  } else if (roll < 0.95) {
    const offsetMs = (__VU * 137) + ((__ITER % 100000) * 1000);
    const finishedAt = new Date(Date.now() - offsetMs).toISOString().slice(0, 23);
    const res = submitResult(data.token, {
      textId: data.textId,
      finishedAt,
      durationMs: 30000,
      timeConstraintMs: 60000,
      wpm: Math.round((40 + Math.random() * 80) * 100) / 100,
      accuracy: Math.round((90 + Math.random() * 10) * 100) / 100,
      textContent: 'Mixed workload result content.',
      mode: 'TEXT',
    });
    writeDuration.add(res.timings.duration);
    mixedWrites.add(1);
  } else if (roll < 0.975) {
    const res = getStats(data.token);
    readDuration.add(res.timings.duration);
    mixedReads.add(1);
  } else {
    const res = getResults(data.token);
    readDuration.add(res.timings.duration);
    mixedReads.add(1);
  }

  sleep(0.1 + Math.random() * 0.2);
}

export const handleSummary = makeSummary({
  name: 'mixed',
  notes: [
    '20 constant VUs for 2 minutes with 100-300ms think time.',
    'Workload mix: 70% reads, 25% result writes, 5% stats/result-history reads.',
    'Uses one disposable user and unique finishedAt values per write.',
  ],
});
