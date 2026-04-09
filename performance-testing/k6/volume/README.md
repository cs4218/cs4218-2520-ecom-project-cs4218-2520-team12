<!-- [Your Name], [Your Student ID] -->
<!-- Volume Testing - Documentation -->
<!-- Milestone 3 - Non-Functional Testing -->

# Volume Testing Suite (k6)

This folder contains volume testing scripts for the following Milestone 3 components:
- Protected Routes
- Orders
- Profile
- Admin View Users

Volume testing here focuses on behavior with large data volume (large users/orders tables), not only high concurrent user count.

## Files
- protected-routes-volume.js: Verifies 401 rejection without auth and 200 success with valid auth tokens.
- orders-volume.js: Measures user order history retrieval and order-create equivalent flow.
- profile-volume.js: Measures profile fetch and profile update behavior under sustained traffic with large user table assumptions.
- admin-users-volume.js: Measures admin route protection for admin users module. Unimplemented list/search APIs are intentionally not tested.
- run-all.sh: Unix runner script.
- run-all.ps1: Windows PowerShell runner script.
- seed-instructions.md: Instructions to seed large test data before running volume tests.

## Prerequisites
- k6 installed and available on PATH
- Backend API running locally
- Seeded test data (see seed-instructions.md)
- Credentials for an existing user and admin account
- Optional direct JWT token overrides

## Base URL
Default is http://localhost:6060/api/v1.
This now matches your stress-test URL convention.

PowerShell example:
$env:BASE_URL = "http://localhost:6060/api/v1"

Bash example:
export BASE_URL="http://localhost:6060/api/v1"

## Authentication (No Hardcoded Credentials)
These scripts follow the same style as stress tests:
- AUTH_EMAIL and AUTH_PASSWORD
- ADMIN_EMAIL and ADMIN_PASSWORD

Optional token override variables:
- AUTH_TOKEN
- ADMIN_TOKEN

### How to obtain tokens safely
1. Preferred: provide AUTH_EMAIL/AUTH_PASSWORD and ADMIN_EMAIL/ADMIN_PASSWORD.
2. Each script logs in in setup() and extracts JWT.
3. Optional: provide AUTH_TOKEN and ADMIN_TOKEN to skip login step.
4. Do not commit tokens or passwords to repository files.

Example (regular user):
curl -X POST http://localhost:6060/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"existinguser@example.com","password":"theirpassword"}'

Example run:
k6 run --env AUTH_EMAIL=<user email> --env AUTH_PASSWORD=<user password> ./performance-testing/k6/volume/orders-volume.js

Important:
- Your current backend middleware expects raw JWT in Authorization.
- These scripts follow that behavior and send the token directly.

## Run Tests
Single file examples:
- k6 run --env AUTH_EMAIL=<user email> --env AUTH_PASSWORD=<user password> --env ADMIN_EMAIL=<admin email> --env ADMIN_PASSWORD=<admin password> ./performance-testing/k6/volume/protected-routes-volume.js
- k6 run --env AUTH_EMAIL=<user email> --env AUTH_PASSWORD=<user password> ./performance-testing/k6/volume/orders-volume.js
- k6 run --env AUTH_EMAIL=<user email> --env AUTH_PASSWORD=<user password> ./performance-testing/k6/volume/profile-volume.js
- k6 run --env ADMIN_EMAIL=<admin email> --env ADMIN_PASSWORD=<admin password> ./performance-testing/k6/volume/admin-users-volume.js

Run all:
- Bash: chmod +x ./performance-testing/k6/volume/run-all.sh && ./performance-testing/k6/volume/run-all.sh
- PowerShell: ./performance-testing/k6/volume/run-all.ps1

## Test Coverage by Component
1. Protected Routes
- Unauthenticated requests should return 401.
- Authenticated user route checks should return 200.
- Authenticated admin route checks should return 200.
- Tracked metrics: response time, status distribution (401 vs 200), error rate.

2. Orders
- Retrieves user order history with large order table.
- Sends high-volume order creation equivalent requests.
- Tracked metrics: p50/p90/p95/p99 latency, request count, error rate.

3. Profile
- Fetches profile-auth data path repeatedly under volume.
- Updates profile fields repeatedly under volume.
- Tracked metrics: response time, throughput, error rate.

4. Admin View Users
- Validates admin protected route first.
- Users list/search volume checks are intentionally excluded because backend endpoints are not implemented.

## Endpoint Placeholder Notes
Current backend includes:
- /auth/user-auth
- /auth/admin-auth
- /auth/profile (PUT)
- /auth/orders

The /auth/all-orders endpoint currently returns 500 in this environment, so it is intentionally excluded from this test suite.

Current backend does not expose dedicated admin users list/search endpoints, so those tests were removed from this suite.

## Thresholds and Pass/Fail Criteria
All scripts define thresholds such as:
- http_req_duration: p(95) < 2000
- http_req_failed: rate < 0.05
- component-specific error rates: rate < 0.05

k6 summary output is used directly to determine pass/fail.

## Reporting Template
| Endpoint              | p50 (ms) | p95 (ms) | p99 (ms) | Error Rate | Notes |
|-----------------------|----------|----------|----------|------------|-------|
| GET /orders           |          |          |          |            |       |
| PUT /auth/profile     |          |          |          |            |       |
| GET /auth/admin-auth  |          |          |          |            |       |

## Notes for Written Report Alignment
In your report, reference these scripts for:
- Test approach and rationale for choosing volume testing
- Data volume assumptions and seeding strategy
- Extracted k6 metrics: p50/p90/p95/p99, error rates, throughput
- Observed bottlenecks and endpoint behavior with large datasets
