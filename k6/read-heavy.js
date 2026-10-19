import { Counter, Trend } from 'k6/metrics';
import {
  createTestUser,
  getRandomText,
  performRead,
  READ_ENDPOINTS,
} from './lib/api.js';
import { makeSummary } from './lib/summary.js';

const requestDuration = new Trend('read_request_duration', true);
const requestsCompleted = new Counter('read_requests_completed');

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    reads: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.READ_RATE || 100),
      timeUnit: '1s',
      duration: __ENV.READ_DURATION || '2m',
      preAllocatedVUs: 30,
      maxVUs: 100,
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    read_request_duration: ['p(95)<1000'],
  },
};

export function setup() {
  const user = createTestUser('read', 0);
  const random = getRandomText(null);
  const body = random.json();
  if (!body || !body.textId) {
    throw new Error('read setup could not load a random text');
  }
  return {
    token: user.token,
    textId: body.textId,
  };
}

export default function reads(data) {
  const endpoint = READ_ENDPOINTS[Math.floor(Math.random() * READ_ENDPOINTS.length)];
  const res = performRead(endpoint, data.token, data.textId);
  requestDuration.add(res.timings.duration);
  requestsCompleted.add(1);
}

export const handleSummary = makeSummary({
  name: 'read-heavy',
  notes: [
    '100 read requests per second for 2 minutes.',
    'Endpoint mix is uniform across random text, text batch, words, text by id, stats, and result history.',
    'All reads use one authenticated disposable user; no writes are performed.',
  ],
});
