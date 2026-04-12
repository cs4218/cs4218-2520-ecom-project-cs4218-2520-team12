// Anthony Hermanto, A0269607R
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const users = new SharedArray('users', function () {
    return open('../../data/users.csv').split('\n').slice(1).map(line => {
        const parts = line.split(',');
        return {
            email: parts[1],
            password: parts[2],
        };
    }).filter(u => u.email && u.password);
});

export const options = {
    stages: [
        { duration: '30s', target: 200 },
        { duration: '1m', target: 1000 }, 
        { duration: '2m', target: 1000 },
        { duration: '30s', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(90)<4000'], 
        http_req_failed: ['rate<0.05'],    
    },
};

const BASE_URL = 'http://localhost:6060/api/v1';

export default function () {
    const user = users[Math.floor(Math.random() * users.length)];
    const payloadStart = JSON.stringify({ email: user.email, password: user.password });
    const paramsJson = { headers: { 'Content-Type': 'application/json' } };

    // 1. Login
    const loginRes = http.post(`${BASE_URL}/auth/login`, payloadStart, paramsJson);

    // If login fails, abort iteration
    if (loginRes.status !== 200) {
        return; 
    }

    const token = loginRes.json('token');
    const authParams = {
        headers: {
            'Authorization': token, // Verify if 'Bearer ' prefix is needed based on middleware
            'Content-Type': 'application/json',
        },
    };

    sleep(1);

    // 2. Get Braintree Token
    const tokenRes = http.get(`${BASE_URL}/product/braintree/token`, authParams);
    
    check(tokenRes, {
        'status is 200': (r) => r.status === 200,
        'has client token': (r) => r.json('clientToken') !== undefined || (r.body && r.body.length > 10),
    });

    sleep(2);

    // 3. Process Payment (Checkout)
    // Mock Cart
    const cart = [
        { _id: "507f1f77bcf86cd799439011", name: 'Test Product 1', price: 10 },
        { _id: "507f1f77bcf86cd799439012", name: 'Test Product 2', price: 20 },
    ];
    
    // "fake-valid-nonce" is a special nonce for Braintree Sandbox testing
    const paymentPayload = JSON.stringify({
        nonce: "fake-valid-nonce", 
        cart: cart,
    });

    const paymentRes = http.post(`${BASE_URL}/product/braintree/payment`, paymentPayload, authParams);

    check(paymentRes, {
        'status is 200': (r) => r.status === 200,
        'payment success': (r) => r.json('ok') === true || r.json('success') === true,
    });

    sleep(1);
}
