// Snodgrass Eliot Peter, A0269684H
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:6060/api/v1';
const AUTH_EMAIL = __ENV.AUTH_EMAIL;
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD;

const PEAK_VUS = Number(__ENV.PEAK_VUS || 1200);
const LOGIN_P95_TARGET_MS = Number(__ENV.LOGIN_P95_TARGET_MS || 1500);
const SERVER_5XX_TARGET = Number(__ENV.SERVER_5XX_TARGET || 0.01);
const CHECK_RATE_TARGET = Number(__ENV.CHECK_RATE_TARGET || 0.97);

const serverErrorRate = new Rate('server_error_rate');

function buildStressStages(peakVus) {
    const l1 = Math.max(50, Math.floor(peakVus * 0.2));
    const l2 = Math.max(100, Math.floor(peakVus * 0.4));
    const l3 = Math.max(150, Math.floor(peakVus * 0.6));
    const l4 = Math.max(200, Math.floor(peakVus * 0.8));

    return [
        { duration: '30s', target: l1 },
        { duration: '1m', target: l2 },
        { duration: '1m', target: l3 },
        { duration: '1m', target: l4 },
        { duration: '1m', target: peakVus },
        { duration: '45s', target: 0 },
    ];
}

export const options = {
    stages: buildStressStages(PEAK_VUS),
    thresholds: {
        'http_req_duration{endpoint:login,auth_case:valid}': [`p(95)<${LOGIN_P95_TARGET_MS}`],
        server_error_rate: [`rate<${SERVER_5XX_TARGET}`],
        checks: [`rate>${CHECK_RATE_TARGET}`],
    },
};

function safeJsonBody(response) {
    if (!response || !response.body) {
        return null;
    }

    try {
        return response.json();
    } catch (error) {
        return null;
    }
}

function recordServerErrorMetric(response) {
    serverErrorRate.add(response && response.status >= 500);
}

export function setup() {
    if (!AUTH_EMAIL || !AUTH_PASSWORD) {
        throw new Error('Missing AUTH_EMAIL or AUTH_PASSWORD. Provide valid credentials via env vars.');
    }

    const payload = JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD });
    const params = {
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'login', auth_case: 'valid', phase: 'setup' },
    };

    const loginRes = http.post(`${BASE_URL}/auth/login`, payload, params);
    recordServerErrorMetric(loginRes);
    const body = safeJsonBody(loginRes);

    // Snodgrass Eliot Peter, A0269684H
    const ok = check(loginRes, {
        'setup login status is 200': (r) => r.status === 200,
        'setup login has token': () => !!(body && body.token),
    });

    if (!ok || !body || !body.token) {
        throw new Error('Setup login failed. Check AUTH_EMAIL/AUTH_PASSWORD and backend data.');
    }

    return { token: body.token };
}

export default function (data) {
    // Mix target for auth/session stress:
    // 60% login traffic (valid+invalid credentials), 25% valid token validation, 15% invalid token validation.
    const roll = Math.random();

    if (roll < 0.6) {
        const validLogin = Math.random() < 0.75;
        const payload = JSON.stringify({
            email: validLogin ? AUTH_EMAIL : `${Date.now()}-invalid@example.com`,
            password: validLogin ? AUTH_PASSWORD : 'bad-password',
        });

        const params = {
            headers: { 'Content-Type': 'application/json' },
            tags: {
                endpoint: 'login',
                auth_case: validLogin ? 'valid' : 'invalid_credential',
                flow: 'auth',
            },
        };

        const resLogin = http.post(`${BASE_URL}/auth/login`, payload, params);
        recordServerErrorMetric(resLogin);
        const loginBody = safeJsonBody(resLogin);

        // Snodgrass Eliot Peter, A0269684H
        if (validLogin) {
            check(resLogin, {
                'valid login status is 200': (r) => r.status === 200,
                'valid login returns token': () => !!(loginBody && loginBody.token),
            });
        } else {
            check(resLogin, {
                'invalid credential response is 4xx': (r) => r.status >= 400 && r.status < 500,
            });
        }
    } else if (roll < 0.85) {
        const params = {
            headers: {
                Authorization: data.token,
                'Content-Type': 'application/json',
            },
            tags: { endpoint: 'user-auth', auth_case: 'valid_token', flow: 'session' },
        };

        const resValidToken = http.get(`${BASE_URL}/auth/user-auth`, params);
        recordServerErrorMetric(resValidToken);
        const authBody = safeJsonBody(resValidToken);

        // Snodgrass Eliot Peter, A0269684H
        check(resValidToken, {
            'valid token status is 200': (r) => r.status === 200,
            'valid token returns ok=true': () => !!(authBody && authBody.ok === true),
        });
    } else {
        const params = {
            headers: {
                Authorization: 'invalid-or-expired-token',
                'Content-Type': 'application/json',
            },
            tags: { endpoint: 'user-auth', auth_case: 'invalid_token', flow: 'session' },
        };

        const resInvalidToken = http.get(`${BASE_URL}/auth/user-auth`, params);
        recordServerErrorMetric(resInvalidToken);

        // Snodgrass Eliot Peter, A0269684H
        check(resInvalidToken, {
            'invalid token response is 4xx': (r) => r.status >= 400 && r.status < 500,
        });
    }

    sleep(1);
}