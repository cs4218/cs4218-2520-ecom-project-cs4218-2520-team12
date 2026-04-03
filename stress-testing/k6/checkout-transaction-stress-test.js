// Snodgrass Eliot Peter, A0269684H
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:6060/api/v1';
const AUTH_EMAIL = __ENV.AUTH_EMAIL;
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD;

const DEPENDENCY_MODE = (__ENV.DEPENDENCY_MODE || 'internal').toLowerCase();
const PEAK_VUS = Number(__ENV.PEAK_VUS || 30);
const P95_TARGET_MS = Number(__ENV.P95_TARGET_MS || 3500);
const INTERNAL_FAILURE_TARGET = Number(__ENV.INTERNAL_FAILURE_TARGET || 0.05);

const INTERNAL_NONCE = __ENV.INTERNAL_NONCE || 'fake-valid-nonce';
const EXTERNAL_NONCE = __ENV.EXTERNAL_NONCE || 'fake-valid-nonce';

const checkoutE2E = new Trend('checkout_e2e_duration');
const checkoutFailureRate = new Rate('checkout_failure_rate');
const serverErrorRate = new Rate('server_error_rate');

function buildStressStages(peakVus) {
    const l1 = Math.floor(peakVus * 0.2);
    const l2 = Math.floor(peakVus * 0.4);
    const l3 = Math.floor(peakVus * 0.6);
    const l4 = Math.floor(peakVus * 0.8);

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
        'checkout_e2e_duration{dependency:internal}': [`p(95)<${P95_TARGET_MS}`],
        'checkout_failure_rate{dependency:internal}': [`rate<${INTERNAL_FAILURE_TARGET}`],
        server_error_rate: ['rate<0.01'],
        checks: ['rate>0.95'],
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

function recordServerErrorMetric(response, dependency) {
    serverErrorRate.add(response && response.status >= 500, { dependency });
}

function buildAuthHeaders(token, dependency) {
    return {
        headers: {
            Authorization: token,
            'Content-Type': 'application/json',
        },
        tags: { flow: 'checkout', dependency },
    };
}

function buildCart() {
    // Test cart uses stable payload shape expected by payment controller.
    return [
        { _id: '507f1f77bcf86cd799439011', name: 'Stress Item A', price: 20 },
        { _id: '507f1f77bcf86cd799439012', name: 'Stress Item B', price: 35 },
    ];
}

function runCheckoutFlow(dependency) {
    const started = Date.now();
    let failed = false;

    const loginPayload = JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD });
    const loginParams = {
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'login', flow: 'checkout', dependency },
    };
    const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, loginParams);
    recordServerErrorMetric(loginRes, dependency);
    const loginBody = safeJsonBody(loginRes);

    // Snodgrass Eliot Peter, A0269684H
    const loginOk = check(loginRes, {
        'checkout login status is 200': (r) => r.status === 200,
        'checkout login returns token': () => !!(loginBody && loginBody.token),
    });

    if (!loginOk || !loginBody || !loginBody.token) {
        failed = true;
        const elapsed = Date.now() - started;
        checkoutE2E.add(elapsed, { dependency });
        checkoutFailureRate.add(1, { dependency });
        return;
    }

    const authParams = buildAuthHeaders(loginBody.token, dependency);

    const tokenRes = http.get(`${BASE_URL}/product/braintree/token`, {
        ...authParams,
        tags: { endpoint: 'braintree-token', flow: 'checkout', dependency },
    });
    recordServerErrorMetric(tokenRes, dependency);
    const tokenBody = safeJsonBody(tokenRes);

    // Snodgrass Eliot Peter, A0269684H
    const tokenOk = check(tokenRes, {
        'braintree token status is 200': (r) => r.status === 200,
        'braintree token has clientToken': () => !!(tokenBody && tokenBody.clientToken),
    });

    if (!tokenOk) {
        failed = true;
    }

    const nonce = dependency === 'internal' ? INTERNAL_NONCE : EXTERNAL_NONCE;
    const cart = buildCart();
    const paymentPayload = JSON.stringify({ nonce, cart });

    const paymentRes = http.post(`${BASE_URL}/product/braintree/payment`, paymentPayload, {
        ...authParams,
        tags: { endpoint: 'braintree-payment', flow: 'checkout', dependency },
    });
    recordServerErrorMetric(paymentRes, dependency);
    const paymentBody = safeJsonBody(paymentRes);

    // Snodgrass Eliot Peter, A0269684H
    const paymentOk = check(paymentRes, {
        'payment status is 200': (r) => r.status === 200,
        'payment returns ok=true': () => !!(paymentBody && paymentBody.ok === true),
    });

    if (!paymentOk) {
        failed = true;
    }

    // Sample consistency checks to detect malformed order payloads under stress.
    if (!failed && Math.random() < 0.2) {
        const ordersRes = http.get(`${BASE_URL}/auth/orders`, {
            ...authParams,
            tags: { endpoint: 'orders', flow: 'checkout', dependency },
        });
        recordServerErrorMetric(ordersRes, dependency);
        const ordersBody = safeJsonBody(ordersRes);

        // Snodgrass Eliot Peter, A0269684H
        const ordersOk = check(ordersRes, {
            'orders status is 200': (r) => r.status === 200,
            'orders returns array': () => Array.isArray(ordersBody),
            'orders ids are unique in response': () => {
                if (!Array.isArray(ordersBody)) {
                    return false;
                }

                const ids = ordersBody.map((o) => o && o._id).filter(Boolean);
                return new Set(ids).size === ids.length;
            },
            'orders contain products arrays': () => {
                if (!Array.isArray(ordersBody)) {
                    return false;
                }

                return ordersBody.every((o) => Array.isArray(o && o.products));
            },
        });

        if (!ordersOk) {
            failed = true;
        }
    }

    const elapsed = Date.now() - started;
    checkoutE2E.add(elapsed, { dependency });
    checkoutFailureRate.add(failed ? 1 : 0, { dependency });
}

export function setup() {
    if (!AUTH_EMAIL || !AUTH_PASSWORD) {
        throw new Error('Missing AUTH_EMAIL or AUTH_PASSWORD. Provide valid credentials via env vars.');
    }

    if (DEPENDENCY_MODE !== 'internal' && DEPENDENCY_MODE !== 'external') {
        throw new Error('DEPENDENCY_MODE must be either internal or external.');
    }

    return { dependency: DEPENDENCY_MODE };
}

export default function (data) {
    runCheckoutFlow(data.dependency);
    sleep(1);
}