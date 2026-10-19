export const BASE_URL = (__ENV.BASE_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
export const WS_URL = __ENV.WS_URL || BASE_URL.replace(/^http/, 'ws') + '/ws/websocket';

export const RUN_ID = __ENV.RUN_ID || (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));
export const PASSWORD = __ENV.TEST_PASSWORD || 'Loadtest123!';
export const TEST_EMAIL_DOMAIN = __ENV.TEST_EMAIL_DOMAIN || 'example.com';
export const USER_AGENT = __ENV.USER_AGENT || '19wpm-k6-loadtest';

export const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': USER_AGENT,
};

export function authHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': USER_AGENT,
  };
}

export function testEmail(label, index) {
  return `k6.${RUN_ID}.${label}.${index}@${TEST_EMAIL_DOMAIN}`;
}

export function testUsername(label, index) {
  return `k6_${RUN_ID}_${label}_${index}`.slice(0, 50);
}
