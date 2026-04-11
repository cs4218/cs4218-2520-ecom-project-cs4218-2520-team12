# Recovery Performance Testing (k6)

This suite validates crash-recovery behavior for:
- payment recovery after failure
- order system recovery and consistency
- login and session recovery
- product data recovery and availability

It runs each scenario as:
1. Start backend service
2. Force a crash
3. Restart service and measure time to functional probe
4. Execute a 60-second post-recovery k6 scenario with latency and consistency thresholds

## Prerequisites

- `k6` installed and available in `PATH`
- valid backend `.env` values (Mongo, JWT, etc.)
- test account credentials in env vars:
  - `AUTH_EMAIL`
  - `AUTH_PASSWORD`

## Run

Run all scenarios:

```bash
npm run test:recovery
```

Quick smoke mode (shorter duration and lower VUs):

```bash
npm run test:recovery:quick
```

Run one scenario:

```bash
npm run test:recovery:scenario -- --only payment
npm run test:recovery:scenario -- --only order
npm run test:recovery:scenario -- --only auth-session
npm run test:recovery:scenario -- --only product
```

## Optional env vars

- `BASE_URL` (default `http://localhost:6060/api/v1`)
- `SERVER_START_CMD` (default `node --experimental-modules server.js`)
- `PAYMENT_NONCE` (default `invalid-recovery-nonce`)

## Results

Artifacts are written to:

- `performance-testing/results/recovery/<timestamp>/recovery-report.md`
- `performance-testing/results/recovery/<timestamp>/recovery-summary.json`
- `performance-testing/results/recovery/<timestamp>/*-k6-summary.json`

## Mapping to backlog acceptance criteria

- Recovery time SLAs: measured as crash-to-functional-probe time per scenario
- Post-recovery response-time targets: enforced via k6 thresholds
- Session correctness: valid/invalid session handling checks
- Order and payment consistency: endpoint-level reconciliation invariants (no malformed status sets, no uncontrolled order growth on failed payment path)
- Product availability and integrity: listing endpoints recover and return non-corrupt data shape

Note: strict atomicity and duplicate-charge guarantees at gateway level require provider-side idempotency keys and transaction logs. This suite validates observable application-side recovery and consistency behavior.
