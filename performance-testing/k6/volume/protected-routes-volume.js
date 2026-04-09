// [Your Name], [Your Student ID]
// Volume Testing - Protected Routes
// Milestone 3 - Non-Functional Testing

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

/*
Credential setup (same convention as stress tests):
1) Prefer AUTH_EMAIL/AUTH_PASSWORD and ADMIN_EMAIL/ADMIN_PASSWORD.
2) Optional override: AUTH_TOKEN and ADMIN_TOKEN.
3) Example:
   k6 run --env AUTH_EMAIL=user@example.com --env AUTH_PASSWORD=secret --env ADMIN_EMAIL=admin@example.com --env ADMIN_PASSWORD=secret ./performance-testing/k6/volume/protected-routes-volume.js
*/

const BASE_URL = __ENV.BASE_URL || 'http://localhost:6060/api/v1';

const AUTH_EMAIL = __ENV.AUTH_EMAIL;
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD;
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL;
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD;

const AUTH_TOKEN = __ENV.AUTH_TOKEN;
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN;

const LOGIN_PATH = __ENV.LOGIN_PATH || '/auth/login';
const USER_AUTH_PATH = __ENV.USER_AUTH_PATH || '/auth/user-auth';
const ADMIN_AUTH_PATH = __ENV.ADMIN_AUTH_PATH || '/auth/admin-auth';

const unauthLatency = new Trend('protected_unauth_latency_ms');
const userAuthLatency = new Trend('protected_user_auth_latency_ms');
const adminAuthLatency = new Trend('protected_admin_auth_latency_ms');
const protectedErrorRate = new Rate('protected_routes_error_rate');
const protectedRequestCount = new Counter('protected_routes_request_count');
const status401Count = new Counter('protected_routes_status_401_count');
const status200Count = new Counter('protected_routes_status_200_count');

export const options = {
  vus: Number(__ENV.VUS || 12),
  duration: __ENV.DURATION || '1m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
    protected_routes_error_rate: ['rate<0.05'],
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

function jsonHeaders(token) {
  return {
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
  };
}

const expected401 = http.expectedStatuses(401);
const expected200 = http.expectedStatuses(200);

function loginAndGetToken(email, password, actorTag) {
  const loginPayload = JSON.stringify({ email, password });
  const loginRes = http.post(`${BASE_URL}${LOGIN_PATH}`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { component: 'protected-routes', endpoint: 'login', actor: actorTag },
  });
  const loginBody = safeJsonBody(loginRes);

  const ok = check(loginRes, {
    [`${actorTag} login status is 200`]: (r) => r.status === 200,
    [`${actorTag} login has token`]: () => !!(loginBody && loginBody.token),
  });

  if (!ok || !loginBody || !loginBody.token) {
    throw new Error(`Unable to get ${actorTag} token from login endpoint. Check credentials/env vars.`);
  }

  return loginBody.token;
}

export function setup() {
  console.log('Starting Protected Routes volume test initialization...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`User auth endpoint: ${USER_AUTH_PATH}`);
  console.log(`Admin auth endpoint: ${ADMIN_AUTH_PATH}`);

  if (!AUTH_TOKEN && (!AUTH_EMAIL || !AUTH_PASSWORD)) {
    throw new Error('Missing AUTH_TOKEN, and AUTH_EMAIL/AUTH_PASSWORD are not set.');
  }

  if (!ADMIN_TOKEN && (!ADMIN_EMAIL || !ADMIN_PASSWORD)) {
    throw new Error('Missing ADMIN_TOKEN, and ADMIN_EMAIL/ADMIN_PASSWORD are not set.');
  }

  const userToken = AUTH_TOKEN || loginAndGetToken(AUTH_EMAIL, AUTH_PASSWORD, 'user');
  const adminToken = ADMIN_TOKEN || loginAndGetToken(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');

  return {
    startedAt: new Date().toISOString(),
    userToken,
    adminToken,
  };
}

export default function (data) {
  group('Protected Route - Unauthenticated Rejections', () => {
    const res = http.get(`${BASE_URL}${USER_AUTH_PATH}`, {
      responseCallback: expected401,
      tags: { component: 'protected-routes', endpoint: 'user-auth', auth_case: 'unauthenticated' },
    });
    protectedRequestCount.add(1);
    unauthLatency.add(res.timings.duration);

    const expected = check(res, {
      'unauth request rejected (401)': (r) => r.status === 401,
    });

    if (res.status === 401) {
      status401Count.add(1);
    }

    protectedErrorRate.add(!expected);
  });

  group('Protected Route - Authenticated User Access', () => {
    const res = http.get(`${BASE_URL}${USER_AUTH_PATH}`, {
      ...jsonHeaders(data.userToken),
      responseCallback: expected200,
      tags: { component: 'protected-routes', endpoint: 'user-auth', auth_case: 'authenticated' },
    });
    protectedRequestCount.add(1);
    userAuthLatency.add(res.timings.duration);

    const expected = check(res, {
      'authenticated user request succeeds (200)': (r) => r.status === 200,
    });

    if (res.status === 200) {
      status200Count.add(1);
    }

    protectedErrorRate.add(!expected);
  });

  group('Protected Route - Admin Access Validation', () => {
    const res = http.get(`${BASE_URL}${ADMIN_AUTH_PATH}`, {
      ...jsonHeaders(data.adminToken),
      responseCallback: expected200,
      tags: { component: 'protected-routes', endpoint: 'admin-auth', auth_case: 'authenticated' },
    });
    protectedRequestCount.add(1);
    adminAuthLatency.add(res.timings.duration);

    const expected = check(res, {
      'authenticated admin request succeeds (200)': (r) => r.status === 200,
    });

    if (res.status === 200) {
      status200Count.add(1);
    }

    if (res.status === 401) {
      status401Count.add(1);
    }

    protectedErrorRate.add(!expected);
  });

  console.log('Completed protected-route iteration.');
  sleep(0.5);
}

export function teardown(data) {
  console.log(`Protected Routes volume test completed. Started at ${data.startedAt}.`);
}
