// Wong An Wei, A0273528X
// Volume Testing - Orders
// Milestone 3 - Non-Functional Testing

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

/*
Credential setup (same convention as stress tests):
1) Prefer AUTH_EMAIL/AUTH_PASSWORD.
2) Optional override: AUTH_TOKEN.
3) Example:
  k6 run --env AUTH_EMAIL=user@example.com --env AUTH_PASSWORD=secret ./performance-testing/k6/volume/orders-volume.js
*/

const BASE_URL = __ENV.BASE_URL || 'http://localhost:6060/api/v1';

const AUTH_EMAIL = __ENV.AUTH_EMAIL;
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD;

const AUTH_TOKEN = __ENV.AUTH_TOKEN;

const LOGIN_PATH = __ENV.LOGIN_PATH || '/auth/login';
const USER_ORDERS_PATH = __ENV.USER_ORDERS_PATH || '/auth/orders';
const ORDER_CREATE_PATH = __ENV.ORDER_CREATE_PATH || '/product/braintree/payment';
const ORDER_CREATE_ENABLED = (__ENV.ORDER_CREATE_ENABLED || 'true') === 'true';

const ORDER_NONCE = __ENV.ORDER_NONCE || 'fake-valid-nonce';
const ORDER_PRODUCT_ID = __ENV.ORDER_PRODUCT_ID || '507f1f77bcf86cd799439011';
const ORDER_PRODUCT_PRICE = Number(__ENV.ORDER_PRODUCT_PRICE || 19.99);

if (!ORDER_CREATE_ENABLED) {
  console.warn('WARNING: ORDER_CREATE_ENABLED=false. Order creation group will be skipped.');
}

const userOrderHistoryLatency = new Trend('orders_user_history_latency_ms');
const orderCreateLatency = new Trend('orders_create_latency_ms');
const orderErrorRate = new Rate('orders_volume_error_rate');
const orderRequestCount = new Counter('orders_volume_request_count');

export const options = {
  vus: Number(__ENV.VUS || 15),
  duration: __ENV.DURATION || '1m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
    orders_volume_error_rate: ['rate<0.05'],
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

function loginAndGetToken(email, password, actorTag) {
  const loginPayload = JSON.stringify({ email, password });
  const loginRes = http.post(`${BASE_URL}${LOGIN_PATH}`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { component: 'orders-volume', endpoint: 'login', actor: actorTag },
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
  console.log('Starting Orders volume test initialization...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`User order history path: ${USER_ORDERS_PATH}`);
  console.log(`Order create path: ${ORDER_CREATE_PATH}`);

  if (!AUTH_TOKEN && (!AUTH_EMAIL || !AUTH_PASSWORD)) {
    throw new Error('Missing AUTH_TOKEN, and AUTH_EMAIL/AUTH_PASSWORD are not set.');
  }

  const userToken = AUTH_TOKEN || loginAndGetToken(AUTH_EMAIL, AUTH_PASSWORD, 'user');

  return {
    startedAt: new Date().toISOString(),
    userToken,
  };
}

export default function (data) {
  group('Orders - Retrieve User Order History', () => {
    const res = http.get(`${BASE_URL}${USER_ORDERS_PATH}`, authJsonHeaders(data.userToken));
    orderRequestCount.add(1);
    userOrderHistoryLatency.add(res.timings.duration);

    const expected = check(res, {
      'user order-history responds with 200': (r) => r.status === 200,
    });

    orderErrorRate.add(!expected);
  });

  group('Orders - High Volume Order Creation Requests', () => {
    if (!ORDER_CREATE_ENABLED) {
      return;
    }

    const payload = JSON.stringify({
      nonce: ORDER_NONCE,
      cart: [
        {
          _id: ORDER_PRODUCT_ID,
          price: ORDER_PRODUCT_PRICE,
        },
      ],
    });

    const res = http.post(`${BASE_URL}${ORDER_CREATE_PATH}`, payload, authJsonHeaders(data.userToken));
    orderRequestCount.add(1);
    orderCreateLatency.add(res.timings.duration);

    const expected = check(res, {
      'order create equivalent responds with 200/201': (r) => r.status === 200 || r.status === 201,
    });

    orderErrorRate.add(!expected);
  });

  console.log('Completed orders-volume iteration.');
  sleep(1);
}

export function teardown(data) {
  console.log(`Orders volume test completed. Started at ${data.startedAt}.`);
}
