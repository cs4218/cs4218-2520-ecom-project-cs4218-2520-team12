import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:6060/api/v1";
const AUTH_EMAIL = __ENV.AUTH_EMAIL;
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD;

const ORDER_P95_TARGET_MS = Number(__ENV.ORDER_P95_TARGET_MS || 2000);
const ORDER_CONSISTENCY_TARGET = Number(__ENV.ORDER_CONSISTENCY_TARGET || 0.98);
const POST_RECOVERY_DURATION = __ENV.POST_RECOVERY_DURATION || "60s";

const orderConsistencyRate = new Rate("order_consistency_rate");

const VALID_STATUSES = new Set([
  "Not Process",
  "Processing",
  "Shipped",
  "deliverd",
  "cancel",
]);

// Amos Chee Tian Ee, A0273476U - Recovery order test cases and thresholds.
export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: POST_RECOVERY_DURATION,
  thresholds: {
    "http_req_duration{endpoint:orders}": [`p(95)<${ORDER_P95_TARGET_MS}`],
    order_consistency_rate: [`rate>${ORDER_CONSISTENCY_TARGET}`],
    checks: ["rate>0.95"],
    http_req_failed: ["rate<0.05"],
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
    tags: { endpoint: "login", scenario: "order_recovery" },
  });

  const body = safeJson(res);
  const ok =
    res.status === 200 &&
    body &&
    body.success === true &&
    typeof body.token === "string" &&
    body.token.length > 0;

  // Amos Chee Tian Ee, A0273476U - Login recovery test cases.
  check(res, {
    "order setup login returns 200": (r) => r.status === 200,
    "order setup login has token": () => !!(body && body.token),
  });

  return ok ? body.token : null;
}

function hasUniqueOrderIds(orders) {
  const ids = orders.map((order) => order && order._id).filter(Boolean);
  return ids.length === new Set(ids).size;
}

function hasValidStatuses(orders) {
  return orders.every((order) => !order?.status || VALID_STATUSES.has(order.status));
}

export function setup() {
  if (!AUTH_EMAIL || !AUTH_PASSWORD) {
    throw new Error("AUTH_EMAIL and AUTH_PASSWORD are required for order recovery test.");
  }

  const token = login();
  if (!token) {
    throw new Error("Unable to obtain token in setup. Verify credentials and user seed data.");
  }

  return { token };
}

export default function (data) {
  const headers = {
    Authorization: data.token,
    "Content-Type": "application/json",
  };

  const ordersRes = http.get(`${BASE_URL}/auth/orders`, {
    headers,
    tags: { endpoint: "orders", scenario: "order_recovery" },
  });
  const ordersBody = safeJson(ordersRes);
  const orders = Array.isArray(ordersBody) ? ordersBody : [];

  const consistent =
    ordersRes.status === 200 && hasUniqueOrderIds(orders) && hasValidStatuses(orders);
  orderConsistencyRate.add(consistent);

  // Amos Chee Tian Ee, A0273476U - Order consistency recovery test cases.
  check(ordersRes, {
    "orders endpoint returns 200": (r) => r.status === 200,
    "orders payload is an array": () => Array.isArray(ordersBody),
    "orders ids are unique": () => hasUniqueOrderIds(orders),
    "orders statuses are valid": () => hasValidStatuses(orders),
  });

  sleep(0.5);
}
