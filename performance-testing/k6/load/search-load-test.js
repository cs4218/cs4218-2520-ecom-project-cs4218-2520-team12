
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 200 },
        { duration: '1m', target: 1000 }, // Faster ramp up for search
        { duration: '2m', target: 1000 },
        { duration: '30s', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(90)<1500'], 
        http_req_failed: ['rate<0.01'],
    },
};

const BASE_URL = 'http://localhost:6060/api/v1';

// Search terms to simulate
const searchTerms = ['watch', 'shirt', 'laptop', 'mobile', 'shoes'];

export default function () {
    const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];

    // 1. Search for Product
    const resSearch = http.get(`${BASE_URL}/product/search/${term}`);

    check(resSearch, {
        'status is 200': (r) => r.status === 200,
        'returns array': (r) => Array.isArray(r.json()),
    });

    sleep(1);

    // 2. Apply Filters (Simulate filtering by price)
    // Mock payload for filtering
    const filterPayload = JSON.stringify({
        checked: [], // categories
        radio: [0, 999], // price range
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const resFilter = http.post(`${BASE_URL}/product/product-filters`, filterPayload, params);

    check(resFilter, {
        'status is 200': (r) => r.status === 200,
        'filter success': (r) => r.json('success') === true,
    });

    sleep(1);
}
