import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:6060/api/v1";
const AUTH_EMAIL = __ENV.AUTH_EMAIL;
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD;

const LOGIN_P95_TARGET_MS = Number(__ENV.LOGIN_P95_TARGET_MS || 1500);
const INVALID_SESSION_TARGET = Number(__ENV.INVALID_SESSION_TARGET || 0.98);
const POST_RECOVERY_DURATION = __ENV.POST_RECOVERY_DURATION || "60s";

const invalidSessionHandledRate = new Rate("invalid_session_handled_rate");

// Amos Chee Tian Ee, A0273476U - Recovery auth/session test cases and thresholds.
export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: POST_RECOVERY_DURATION,
  thresholds: {
    "http_req_duration{endpoint:login}": [`p(95)<${LOGIN_P95_TARGET_MS}`],
    invalid_session_handled_rate: [`rate>${INVALID_SESSION_TARGET}`],
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
    tags: { endpoint: "login", scenario: "auth_session_recovery" },
  });

  const body = safeJson(res);
  // Amos Chee Tian Ee, A0273476U - Login recovery test cases.
  check(res, {
    "login responds with 200": (r) => r.status === 200,
    "login returns token": () => !!(body && body.token),
  });

  return body && body.token ? body.token : null;
}

export function setup() {
  if (!AUTH_EMAIL || !AUTH_PASSWORD) {
    throw new Error("AUTH_EMAIL and AUTH_PASSWORD are required for auth-session recovery test.");
  }

  const token = login();
  if (!token) {
    throw new Error("Unable to obtain token in setup. Verify credentials and user seed data.");
  }

  return { token };
}

export default function (data) {
  const token = login() || data.token;

  const validSessionRes = http.get(`${BASE_URL}/auth/user-auth`, {
    headers: { Authorization: token, "Content-Type": "application/json" },
    tags: { endpoint: "user-auth", auth_case: "valid_token", scenario: "auth_session_recovery" },
  });
  const validSessionBody = safeJson(validSessionRes);

  // Amos Chee Tian Ee, A0273476U - Valid session recovery test cases.
  check(validSessionRes, {
    "valid token user-auth is 200": (r) => r.status === 200,
    "valid token user-auth ok=true": () => !!(validSessionBody && validSessionBody.ok === true),
  });

  const invalidSessionRes = http.get(`${BASE_URL}/auth/user-auth`, {
    headers: { Authorization: "invalid-session-token", "Content-Type": "application/json" },
    tags: { endpoint: "user-auth", auth_case: "invalid_token", scenario: "auth_session_recovery" },
  });

  const invalidHandled = invalidSessionRes.status >= 400 && invalidSessionRes.status < 500;
  invalidSessionHandledRate.add(invalidHandled);

  // Amos Chee Tian Ee, A0273476U - Invalid session recovery test case.
  check(invalidSessionRes, {
    "invalid session rejected with 4xx": () => invalidHandled,
  });

  sleep(0.5);
}
