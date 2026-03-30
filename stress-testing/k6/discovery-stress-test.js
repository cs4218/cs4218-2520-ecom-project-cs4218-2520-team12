// Snodgrass Eliot Peter, A0269684H
import http from 'k6/http';
import { check, sleep } from 'k6';

const PEAK_VUS = Number(__ENV.PEAK_VUS || 3300);
const P95_TARGET_MS = Number(__ENV.P95_TARGET_MS || 2000);
const FAIL_RATE_TARGET = Number(__ENV.FAIL_RATE_TARGET || 0.03);
const CHECK_RATE_TARGET = Number(__ENV.CHECK_RATE_TARGET || 0.97);

function buildStressStages(peakVus) {
    // Keep a similar curve to original run while scaling automatically by peak.
    const l1 = Math.max(50, Math.floor(peakVus * 0.25));
    const l2 = Math.max(100, Math.floor(peakVus * 0.5));
    const l3 = Math.max(150, Math.floor(peakVus * 0.7));
    const l4 = Math.max(200, Math.floor(peakVus * 0.85));

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
        http_req_duration: [`p(95)<${P95_TARGET_MS}`],
        http_req_failed: [`rate<${FAIL_RATE_TARGET}`],
        checks: [`rate>${CHECK_RATE_TARGET}`],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:6060/api/v1';
const searchTerms = ['watch', 'shirt', 'laptop', 'mobile', 'shoes', 'bag', 'camera'];
const priceRanges = [
    [0, 100],
    [100, 300],
    [300, 700],
    [700, 1500],
];

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

export default function () {
    // Mix target for discovery stress: 55% browse/listing, 30% search, 15% filter.
    const roll = Math.random();

    if (roll < 0.55) {
        const page = Math.floor(Math.random() * 8) + 1;
        const resBrowse = http.get(`${BASE_URL}/product/product-list/${page}`, {
            tags: { flow: 'browse', endpoint: 'product-list' },
        });
        const browseBody = safeJsonBody(resBrowse);
        const browseProducts = browseBody && Array.isArray(browseBody.products) ? browseBody.products : [];

        // Snodgrass Eliot Peter, A0269684H
        check(resBrowse, {
            'browse status is 200': (r) => r.status === 200,
            'browse has products array': (r) => r.status === 200 && Array.isArray(browseProducts),
            'browse page size <= 6': (r) => r.status === 200 && browseProducts.length <= 6,
            'browse page has unique ids': (r) => {
                if (r.status !== 200) {
                    return false;
                }

                const ids = browseProducts.map((p) => p && p._id).filter(Boolean);
                return new Set(ids).size === ids.length;
            },
        });
    } else if (roll < 0.85) {
        const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
        const resSearch = http.get(`${BASE_URL}/product/search/${term}`, {
            tags: { flow: 'search', endpoint: 'search' },
        });
        const searchBody = safeJsonBody(resSearch);

        // Snodgrass Eliot Peter, A0269684H
        check(resSearch, {
            'search status is 200': (r) => r.status === 200,
            'search returns array': (r) => r.status === 200 && Array.isArray(searchBody),
        });
    } else {
        const selectedRange = priceRanges[Math.floor(Math.random() * priceRanges.length)];
        const filterPayload = JSON.stringify({
            checked: [],
            radio: selectedRange,
        });

        const params = {
            headers: {
                'Content-Type': 'application/json',
            },
            tags: { flow: 'filter', endpoint: 'product-filters' },
        };

        const resFilter = http.post(`${BASE_URL}/product/product-filters`, filterPayload, params);
        const filterBody = safeJsonBody(resFilter);
        const filterProducts = filterBody && Array.isArray(filterBody.products) ? filterBody.products : [];

        // Snodgrass Eliot Peter, A0269684H
        check(resFilter, {
            'filter status is 200': (r) => r.status === 200,
            'filter success true': (r) => r.status === 200 && filterBody && filterBody.success === true,
            'filter returns products array': (r) => r.status === 200 && Array.isArray(filterProducts),
        });
    }

    sleep(1);
}