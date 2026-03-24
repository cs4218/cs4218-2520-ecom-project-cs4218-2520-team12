// David Vicedo, A0273234J
import http from "k6/http";
import { check, sleep } from "k6";
import exec from "k6/execution";

const BASE_URL = __ENV.BASE_URL || "http://localhost:6060/api/v1/product";
const ENDPOINT = "/product-list/1";

// Stage breakpoints (seconds):
// - baseline: 0 -> 90s
// - spike: 90 -> 160s
// - recovery: 160s onwards
function currentPhase() {
    const elapsedMs = exec.instance.currentTestRunDuration;

    if (elapsedMs < 90_000) return "baseline";
    if (elapsedMs < 160_000) return "spike";
    return "recovery";
}

export const options = {
    scenarios: {
        spike_product_list: {
            executor: "ramping-vus",
            startVUs: 0,
            gracefulRampDown: "5s",
            stages: [
                { duration: "30s", target: 10 }, // baseline ramp-up
                { duration: "1m", target: 10 }, // baseline steady
                { duration: "10s", target: 120 }, // sudden spike
                { duration: "1m", target: 120 }, // spike steady
                { duration: "20s", target: 10 }, // recovery ramp-down
                { duration: "1m", target: 10 }, // recovery steady
            ],
        },
    },
    thresholds: {
        http_req_duration: ["avg<600", "p(95)<1200"],
        "http_req_duration{phase:recovery}": ["p(95)<700"],
        http_req_failed: ["rate<0.05"],
        checks: ["rate>0.95"],
    },
    summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "max"],
};

export default function () {
    const phase = currentPhase();
    const res = http.get(`${BASE_URL}${ENDPOINT}`, {
        tags: { test_type: "spike", phase, endpoint: "product-list-1" },
    });

    check(res, {
        "status is 200": (r) => r.status === 200,
    });

    // Simple pacing to avoid a zero-think-time tight loop.
    sleep(1);
}
