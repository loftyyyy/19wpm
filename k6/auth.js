import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import {
  createTestUser,
  getMe,
  login,
  logout,
  refreshToken,
} from './lib/api.js';
import { makeSummary } from './lib/summary.js';

const flowDuration = new Trend('auth_flow_duration', true);
const completedFlows = new Counter('auth_flows_completed');

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    auth: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.AUTH_RATE || 5),
      timeUnit: '1s',
      duration: __ENV.AUTH_DURATION || '30s',
      preAllocatedVUs: 10,
      maxVUs: 30,
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<3000'],
    'http_req_duration{endpoint:signup}': ['p(95)<3500'],
    'http_req_duration{endpoint:login}': ['p(95)<3500'],
    auth_flow_duration: ['p(95)<10000'],
  },
};

export function setup() {
  return {};
}

export default function authFlow() {
  const startedAt = Date.now();
  const label = `auth${__VU}`;
  const user = createTestUser(label, __ITER);

  const session = login(user.email, user.password);
  const rotated = refreshToken(session.refreshToken);
  check(rotated, {
    'refresh returned token pair': (r) => !!(r.accessToken && r.refreshToken),
  });
  getMe(rotated.accessToken);
  logout(rotated.accessToken, rotated.refreshToken);

  flowDuration.add(Date.now() - startedAt);
  completedFlows.add(1);
}

export const handleSummary = makeSummary({
  name: 'auth',
  notes: [
    '5 signup/login/refresh/logout flows per second for 30 seconds.',
    'Each iteration creates one disposable user; cleanup deletes k6.%@example.com users.',
    'Refresh requires Redis GETDEL support (Redis 6.2+); local Redis was upgraded to 8.10.2.',
  ],
});
