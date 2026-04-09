// [Your Name], [Your Student ID]
// Volume Testing - Admin View Users
// Milestone 3 - Non-Functional Testing

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

/*
Credential setup (same convention as stress tests):
1) Prefer ADMIN_EMAIL/ADMIN_PASSWORD.
2) Optional override: ADMIN_TOKEN.
3) Example:
   k6 run --env ADMIN_EMAIL=admin@example.com --env ADMIN_PASSWORD=secret ./performance-testing/k6/volume/admin-users-volume.js
*/

const BASE_URL = __ENV.BASE_URL || 'http://localhost:6060/api/v1';

const ADMIN_EMAIL = __ENV.ADMIN_EMAIL;
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD;
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN;

const LOGIN_PATH = __ENV.LOGIN_PATH || '/auth/login';
const ADMIN_AUTH_PATH = __ENV.ADMIN_AUTH_PATH || '/auth/admin-auth';

const adminAuthLatency = new Trend('admin_users_auth_latency_ms');
const adminUsersErrorRate = new Rate('admin_users_volume_error_rate');
const adminUsersRequestCount = new Counter('admin_users_volume_request_count');

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || '1m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
    admin_users_volume_error_rate: ['rate<0.05'],
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

function adminJsonHeaders(token) {
  return {
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
  };
}

function loginAndGetAdminToken(email, password) {
  const loginPayload = JSON.stringify({ email, password });
  const loginRes = http.post(`${BASE_URL}${LOGIN_PATH}`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { component: 'admin-users-volume', endpoint: 'login', actor: 'admin' },
  });
  const loginBody = safeJsonBody(loginRes);

  const ok = check(loginRes, {
    'admin login status is 200': (r) => r.status === 200,
    'admin login has token': () => !!(loginBody && loginBody.token),
  });

  if (!ok || !loginBody || !loginBody.token) {
    throw new Error('Unable to get admin token from login endpoint. Check ADMIN_EMAIL/ADMIN_PASSWORD.');
  }

  return loginBody.token;
}

export function setup() {
  console.log('Starting Admin View Users volume test initialization...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Admin users list/search API not implemented in backend; only admin route protection is tested.');

  if (!ADMIN_TOKEN && (!ADMIN_EMAIL || !ADMIN_PASSWORD)) {
    throw new Error('Missing ADMIN_TOKEN, and ADMIN_EMAIL/ADMIN_PASSWORD are not set.');
  }

  const adminToken = ADMIN_TOKEN || loginAndGetAdminToken(ADMIN_EMAIL, ADMIN_PASSWORD);

  return {
    startedAt: new Date().toISOString(),
    adminToken,
  };
}

export default function (data) {
  group('Admin Users - Validate Admin Protected Access', () => {
    const res = http.get(`${BASE_URL}${ADMIN_AUTH_PATH}`, adminJsonHeaders(data.adminToken));
    adminUsersRequestCount.add(1);
    adminAuthLatency.add(res.timings.duration);

    const expected = check(res, {
      'admin auth responds with 200': (r) => r.status === 200,
    });

    adminUsersErrorRate.add(!expected);
  });

  console.log('Completed admin-users-volume iteration.');
  sleep(1);
}

export function teardown(data) {
  console.log(`Admin View Users volume test completed. Started at ${data.startedAt}.`);
}
