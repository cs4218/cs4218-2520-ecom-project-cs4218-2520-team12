// [Your Name], [Your Student ID]
// Volume Testing - Profile
// Milestone 3 - Non-Functional Testing

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

/*
Credential setup (same convention as stress tests):
1) Prefer AUTH_EMAIL/AUTH_PASSWORD.
2) Optional override: AUTH_TOKEN.
3) Example:
   k6 run --env AUTH_EMAIL=user@example.com --env AUTH_PASSWORD=secret ./performance-testing/k6/volume/profile-volume.js
*/

const BASE_URL = __ENV.BASE_URL || 'http://localhost:6060/api/v1';
const AUTH_EMAIL = __ENV.AUTH_EMAIL;
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD;
const AUTH_TOKEN = __ENV.AUTH_TOKEN;

const LOGIN_PATH = __ENV.LOGIN_PATH || '/auth/login';
const PROFILE_GET_PATH = __ENV.PROFILE_GET_PATH || '/auth/user-auth';
const PROFILE_UPDATE_PATH = __ENV.PROFILE_UPDATE_PATH || '/auth/profile';

const profileFetchLatency = new Trend('profile_fetch_latency_ms');
const profileUpdateLatency = new Trend('profile_update_latency_ms');
const profileErrorRate = new Rate('profile_volume_error_rate');
const profileRequestCount = new Counter('profile_volume_request_count');

export const options = {
  vus: Number(__ENV.VUS || 12),
  duration: __ENV.DURATION || '1m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
    profile_volume_error_rate: ['rate<0.05'],
  },
  summaryTrendStats: ['min', 'avg', 'med', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function safeJsonBody(response) {
  if (!response || !response.body) {
    return null;
  }

  try {
    return response.json();
  } catch (_error) {
    return null;
  }
}

function authJsonHeaders(token) {
  return {
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
  };
}

function loginAndGetToken(email, password) {
  const loginPayload = JSON.stringify({ email, password });
  const loginRes = http.post(`${BASE_URL}${LOGIN_PATH}`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { component: 'profile-volume', endpoint: 'login', actor: 'user' },
  });
  const loginBody = safeJsonBody(loginRes);

  const ok = check(loginRes, {
    'profile user login status is 200': (r) => r.status === 200,
    'profile user login has token': () => !!(loginBody && loginBody.token),
  });

  if (!ok || !loginBody || !loginBody.token) {
    throw new Error('Unable to get user token from login endpoint. Check AUTH_EMAIL/AUTH_PASSWORD.');
  }

  return loginBody.token;
}

export function setup() {
  console.log('Starting Profile volume test initialization...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Profile fetch path: ${PROFILE_GET_PATH}`);
  console.log(`Profile update path: ${PROFILE_UPDATE_PATH}`);

  if (!AUTH_TOKEN && (!AUTH_EMAIL || !AUTH_PASSWORD)) {
    throw new Error('Missing AUTH_TOKEN, and AUTH_EMAIL/AUTH_PASSWORD are not set.');
  }

  const userToken = AUTH_TOKEN || loginAndGetToken(AUTH_EMAIL, AUTH_PASSWORD);

  return {
    startedAt: new Date().toISOString(),
    userToken,
  };
}

export default function (data) {
  group('Profile - Fetch Profile Data With Large User Table', () => {
    const res = http.get(`${BASE_URL}${PROFILE_GET_PATH}`, authJsonHeaders(data.userToken));
    profileRequestCount.add(1);
    profileFetchLatency.add(res.timings.duration);

    const expected = check(res, {
      'profile fetch responds with 200': (r) => r.status === 200,
    });

    profileErrorRate.add(!expected);
  });

  group('Profile - Update Profile Fields At Volume', () => {
    const suffix = Math.floor(Math.random() * 100000);
    const payload = JSON.stringify({
      name: `Volume Test User ${suffix}`,
      phone: `8${String(suffix).padStart(7, '0').slice(0, 7)}`,
      address: `Volume Street ${suffix}`,
      password: '',
    });

    const res = http.put(`${BASE_URL}${PROFILE_UPDATE_PATH}`, payload, authJsonHeaders(data.userToken));
    profileRequestCount.add(1);
    profileUpdateLatency.add(res.timings.duration);

    const expected = check(res, {
      'profile update responds with 200': (r) => r.status === 200,
      'profile update returns success flag': (r) => {
        try {
          const body = r.json();
          return body && body.success === true;
        } catch (_error) {
          return false;
        }
      },
    });

    profileErrorRate.add(!expected);
  });

  sleep(0.5);
}

export function teardown(data) {
  console.log(`Profile volume test completed. Started at ${data.startedAt}.`);
}
