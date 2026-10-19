import http from 'k6/http';
import { check } from 'k6';
import {
  BASE_URL,
  JSON_HEADERS,
  PASSWORD,
  authHeaders,
  testEmail,
  testUsername,
} from '../config.js';

export function url(path) {
  return `${BASE_URL}${path}`;
}

export function parseJson(res) {
  try {
    return res.body ? JSON.parse(res.body) : null;
  } catch (e) {
    return null;
  }
}

function authFor(token) {
  return token ? authHeaders(token) : JSON_HEADERS;
}

export function createTestUser(label, index) {
  const email = testEmail(label, index);
  const username = testUsername(label, index);
  const payload = {
    username,
    firstName: 'Load',
    lastName: 'Test',
    email,
    password: PASSWORD,
    country: 'US',
    timezone: 'UTC',
  };

  const res = http.post(url('/api/v1/auth/signup'), JSON.stringify(payload), {
    headers: JSON_HEADERS,
    tags: { endpoint: 'signup' },
  });
  const body = parseJson(res);

  check(res, {
    'signup status 201': (r) => r.status === 201,
    'signup has access token': () => !!(body && body.accessToken),
  }, { endpoint: 'signup' });

  if (res.status !== 201 || !body || !body.accessToken) {
    throw new Error(`signup failed for ${email}: status=${res.status} body=${res.body}`);
  }

  return {
    email,
    username,
    password: PASSWORD,
    token: body.accessToken,
    refreshToken: body.refreshToken,
    userId: body.userResponseDTO ? body.userResponseDTO.id : null,
  };
}

export function createTestUsers(count, label) {
  const users = [];
  for (let i = 0; i < count; i += 1) {
    users.push(createTestUser(label, i));
  }
  return users;
}

export function login(email, password) {
  const res = http.post(url('/api/v1/auth/login'), JSON.stringify({
    email,
    password,
    timezone: 'UTC',
  }), {
    headers: JSON_HEADERS,
    tags: { endpoint: 'login' },
  });
  const body = parseJson(res);

  check(res, {
    'login status 200': (r) => r.status === 200,
    'login has access token': () => !!(body && body.accessToken),
  }, { endpoint: 'login' });

  if (res.status !== 200 || !body || !body.accessToken) {
    throw new Error(`login failed for ${email}: status=${res.status} body=${res.body}`);
  }
  return body;
}

export function refreshToken(refresh) {
  const res = http.post(url('/api/v1/auth/refresh'), JSON.stringify({
    refreshToken: refresh,
  }), {
    headers: JSON_HEADERS,
    tags: { endpoint: 'refresh' },
  });
  const body = parseJson(res);

  check(res, {
    'refresh status 200': (r) => r.status === 200,
    'refresh has access token': () => !!(body && body.accessToken),
  }, { endpoint: 'refresh' });

  if (res.status !== 200 || !body || !body.accessToken) {
    throw new Error(`refresh failed: status=${res.status} body=${res.body}`);
  }
  return body;
}

export function logout(accessToken, refresh) {
  const res = http.post(url('/api/v1/auth/logout'), JSON.stringify({
    refreshToken: refresh,
  }), {
    headers: authHeaders(accessToken),
    tags: { endpoint: 'logout' },
  });

  check(res, {
    'logout status 204': (r) => r.status === 204,
  }, { endpoint: 'logout' });

  return res;
}

export function getMe(token) {
  const res = http.get(url('/api/v1/auth/me'), {
    headers: authHeaders(token),
    tags: { endpoint: 'me' },
  });
  const body = parseJson(res);
  check(res, {
    'me status 200': (r) => r.status === 200,
    'me has user id': () => !!(body && body.userId),
  }, { endpoint: 'me' });
  return res;
}

export function getRandomText(token) {
  const res = http.get(url('/api/v1/texts/random?type=SHORT'), {
    headers: authFor(token),
    tags: { endpoint: 'texts_random' },
  });
  const body = parseJson(res);
  check(res, {
    'random text status 200': (r) => r.status === 200,
    'random text has content': () => !!(body && body.textId && body.content),
  }, { endpoint: 'texts_random' });
  return res;
}

export function getTextBatch(token) {
  const res = http.get(url('/api/v1/texts?language=en&textType=MEDIUM&count=5'), {
    headers: authFor(token),
    tags: { endpoint: 'texts_batch' },
  });
  const body = parseJson(res);
  check(res, {
    'text batch status 200': (r) => r.status === 200,
    'text batch is non-empty array': () => Array.isArray(body) && body.length > 0,
  }, { endpoint: 'texts_batch' });
  return res;
}

export function getWords(token) {
  const res = http.get(url('/api/v1/words?language=en&difficulty=EASY&count=50'), {
    headers: authFor(token),
    tags: { endpoint: 'words' },
  });
  const body = parseJson(res);
  check(res, {
    'words status 200': (r) => r.status === 200,
    'words returns array': () => Array.isArray(body),
  }, { endpoint: 'words' });
  return res;
}

export function getTextById(token, textId) {
  const res = http.get(url(`/api/v1/texts/${textId}`), {
    headers: authHeaders(token),
    tags: { endpoint: 'text_by_id' },
  });
  const body = parseJson(res);
  check(res, {
    'text by id status 200': (r) => r.status === 200,
    'text by id matches': () => !!(body && String(body.textId) === String(textId)),
  }, { endpoint: 'text_by_id' });
  return res;
}

export function getStats(token) {
  const res = http.get(url('/api/v1/stats'), {
    headers: authHeaders(token),
    tags: { endpoint: 'stats' },
  });
  const body = parseJson(res);
  check(res, {
    'stats status 200': (r) => r.status === 200,
    'stats has user stat id': () => !!(body && body.userStatId),
  }, { endpoint: 'stats' });
  return res;
}

export function getResults(token) {
  const res = http.get(url('/api/v1/result?page=0&size=20'), {
    headers: authHeaders(token),
    tags: { endpoint: 'results' },
  });
  const body = parseJson(res);
  check(res, {
    'results status 200': (r) => r.status === 200,
    'results has content array': () => !!(body && Array.isArray(body.content)),
  }, { endpoint: 'results' });
  return res;
}

export const READ_ENDPOINTS = [
  'random_text',
  'text_batch',
  'words',
  'text_by_id',
  'stats',
  'results',
];

export function performRead(name, token, textId) {
  switch (name) {
    case 'random_text':
      return getRandomText(null);
    case 'text_batch':
      return getTextBatch(null);
    case 'words':
      return getWords(null);
    case 'text_by_id':
      return getTextById(token, textId);
    case 'stats':
      return getStats(token);
    case 'results':
      return getResults(token);
    default:
      throw new Error(`unknown read endpoint: ${name}`);
  }
}

export function createRaceRoom(token, opts) {
  const payload = {
    textType: (opts && opts.textType) || 'SHORT',
    isPrivate: opts && opts.isPrivate !== undefined ? opts.isPrivate : true,
  };
  const res = http.post(url('/api/v1/race/rooms'), JSON.stringify(payload), {
    headers: authHeaders(token),
    tags: { endpoint: 'race_create' },
  });
  const roomCode = res.body ? res.body.trim().replace(/^"|"$/g, '') : '';
  check(res, {
    'race create status 201': (r) => r.status === 201,
    'race create has code': () => roomCode.length > 0,
  }, { endpoint: 'race_create' });

  if (res.status !== 201 || roomCode.length === 0) {
    throw new Error(`race create failed: status=${res.status} body=${res.body}`);
  }
  return roomCode;
}

export function joinRaceRoom(token, code) {
  const res = http.post(url(`/api/v1/race/rooms/${code}/join`), null, {
    headers: authHeaders(token),
    tags: { endpoint: 'race_join' },
  });
  const body = parseJson(res);
  check(res, {
    'race join status 200': (r) => r.status === 200,
    'race join has room code': () => !!(body && body.roomCode === code),
  }, { endpoint: 'race_join' });
  return res;
}

export function getRaceRoom(token, code) {
  const res = http.get(url(`/api/v1/race/rooms/${code}`), {
    headers: authHeaders(token),
    tags: { endpoint: 'race_state' },
  });
  const body = parseJson(res);
  check(res, {
    'race state status 200': (r) => r.status === 200,
    'race state has room code': () => !!(body && body.roomCode === code),
  }, { endpoint: 'race_state' });
  return { res, body };
}

export function nowLocalIso() {
  return new Date().toISOString().slice(0, 23);
}

export function submitResult(token, opts) {
  const payload = {
    textId: opts && opts.textId !== undefined ? opts.textId : null,
    finishedAt: (opts && opts.finishedAt) || nowLocalIso(),
    durationMs: (opts && opts.durationMs) || 30000,
    timeConstraintMs: (opts && opts.timeConstraintMs) || 60000,
    wpm: (opts && opts.wpm) || 60.5,
    accuracy: (opts && opts.accuracy) || 97.5,
    textContent: (opts && opts.textContent) || 'load test words for the result endpoint',
    mode: (opts && opts.mode) || 'WORDS',
  };

  const res = http.post(url('/api/v1/result'), JSON.stringify(payload), {
    headers: authHeaders(token),
    tags: { endpoint: 'result_create' },
  });
  const body = parseJson(res);
  check(res, {
    'result create status 201': (r) => r.status === 201,
    'result create has id': () => !!(body && body.typingResultId),
  }, { endpoint: 'result_create' });

  if (__ENV.DEBUG_WRITE && res.status !== 201) {
    console.log(`submitResult status=${res.status} body=${res.body}`);
  }
  return res;
}
