
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 200 },
        { duration: '1m', target: 500 },
        { duration: '1m', target: 1000 },
        { duration: '2m', target: 1000 },
        { duration: '30s', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(90)<1500'], 
        http_req_failed: ['rate<0.01'],
    },
};

const BASE_URL = 'http://localhost:6060/api/v1';

export default function () {
    // 1. Visit Homepage (Get Products List)
    // Simulating initial load of products
    const resProducts = http.get(`${BASE_URL}/product/product-list/1`);
    
    check(resProducts, {
        'status is 200': (r) => r.status === 200,
        'has products': (r) => r.json('products') !== undefined,
    });

    sleep(1);

    // 2. Get Categories (Simulate Sidebar Load)
    const resCategories = http.get(`${BASE_URL}/category/get-category`);

    check(resCategories, {
        'status is 200': (r) => r.status === 200,
        'has categories': (r) => r.json('category') !== undefined || r.json('success') === true,
    });

    sleep(2);

    // 3. View More Products (Pagination)
    const page = Math.floor(Math.random() * 5) + 1; // Random page 1-5
    const resPage = http.get(`${BASE_URL}/product/product-list/${page}`);
    
    check(resPage, {
        'status is 200': (r) => r.status === 200,
    });

    sleep(1);
}
