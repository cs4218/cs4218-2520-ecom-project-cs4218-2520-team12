import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:6060/api/v1";
const AUTH_EMAIL = __ENV.AUTH_EMAIL;
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD;

const PAYMENT_P95_TARGET_MS = Number(__ENV.PAYMENT_P95_TARGET_MS || 2000);
const RECONCILIATION_TARGET = Number(__ENV.RECONCILIATION_TARGET || 0.95);
const POST_RECOVERY_DURATION = __ENV.POST_RECOVERY_DURATION || "60s";

const reconciliationRate = new Rate("payment_reconciliation_rate");

// Amos Chee Tian Ee, A0273476U - Recovery payment test cases and thresholds.
export const options = {
  vus: Number(__ENV.VUS || 15),
  duration: POST_RECOVERY_DURATION,
  thresholds: {
    "http_req_duration{endpoint:payment}": [`p(95)<${PAYMENT_P95_TARGET_MS}`],
    payment_reconciliation_rate: [`rate>${RECONCILIATION_TARGET}`],
    checks: ["rate>0.9"],
    http_req_failed: ["rate<0.1"],
  },
};

function safeJson(response) {
  if (!response || !response.body) {
    return null;
  }

  try {
    return response.json();
  } catch (_error) {
    return null;
  }
}

function login() {
  const payload = JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD });
  const res = http.post(`${BASE_URL}/auth/login`, payload, {
    headers: { "Content-Type": "application/json" },
    tags: { endpoint: "login", scenario: "payment_recovery" },
  });
  const body = safeJson(res);

  // Amos Chee Tian Ee, A0273476U - Login recovery test cases.
  check(res, {
    "payment setup login returns 200": (r) => r.status === 200,
    "payment setup login has token": () => !!(body && body.token),
  });

  return body && body.token ? body.token : null;
}

function getOrders(token) {
  const response = http.get(`${BASE_URL}/auth/orders`, {
    headers: { Authorization: token, "Content-Type": "application/json" },
    tags: { endpoint: "orders", scenario: "payment_recovery" },
  });

  const body = safeJson(response);
  return {
    status: response.status,
    list: Array.isArray(body) ? body : [],
  };
}

export function setup() {
  if (!AUTH_EMAIL || !AUTH_PASSWORD) {
    throw new Error("AUTH_EMAIL and AUTH_PASSWORD are required for payment recovery test.");
  }

  const token = login();
  if (!token) {
    throw new Error("Unable to obtain token in setup. Verify credentials and user seed data.");
  }

  return { token };
}

export default function (data) {
  const token = login() || data.token;
  const headers = { Authorization: token, "Content-Type": "application/json" };

  const tokenRes = http.get(`${BASE_URL}/product/braintree/token`, {
    headers,
    tags: { endpoint: "braintree-token", scenario: "payment_recovery" },
  });
  const tokenBody = safeJson(tokenRes);

  // Amos Chee Tian Ee, A0273476U - Braintree token recovery test cases.
  check(tokenRes, {
    "braintree token endpoint returns 200": (r) => r.status === 200,
    "braintree token contains clientToken": () => !!(tokenBody && tokenBody.clientToken),
  });

  const beforeOrders = getOrders(token);

  const paymentPayload = JSON.stringify({
    nonce: __ENV.PAYMENT_NONCE || "invalid-recovery-nonce",
    cart: [{ _id: "507f191e810c19729de860ea", name: "Recovery Item", price: 10 }],
  });

  const paymentRes = http.post(`${BASE_URL}/product/braintree/payment`, paymentPayload, {
    headers,
    tags: { endpoint: "payment", scenario: "payment_recovery" },
  });
  const paymentBody = safeJson(paymentRes);

  const paymentSucceeded = paymentRes.status === 200 && paymentBody && paymentBody.ok === true;
  const paymentFailed = paymentRes.status >= 400;

  // Amos Chee Tian Ee, A0273476U - Payment request recovery behavior test case.
  check(paymentRes, {
    "payment request returns success or explicit failure": () => paymentSucceeded || paymentFailed,
  });

  const afterOrders = getOrders(token);

  let reconciled = false;
  if (beforeOrders.status === 200 && afterOrders.status === 200) {
    if (paymentFailed) {
      // For failure path, order count should remain unchanged (rollback/no partial writes).
      reconciled = afterOrders.list.length === beforeOrders.list.length;
    } else if (paymentSucceeded) {
      // For success path, order count should not jump by more than one per request.
      reconciled = afterOrders.list.length >= beforeOrders.list.length &&
        afterOrders.list.length <= beforeOrders.list.length + 1;
    }
  }

  reconciliationRate.add(reconciled);

  // Amos Chee Tian Ee, A0273476U - Post-payment reconciliation test case.
  check(afterOrders, {
    "payment and order state reconciled": () => reconciled,
  });

  sleep(0.5);
}
