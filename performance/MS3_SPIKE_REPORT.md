# MS3 Non-Functional Testing Report (Spike Testing)

## 1. Objective
Evaluate the behavior of the e-commerce backend under a sudden traffic spike on one endpoint (`GET /api/v1/product/product-list/1`) and verify whether the system can recover after the spike.

## 2. Approach
- Tool: k6 (JavaScript-based load testing)
- Endpoint under test: `/product-list/1` (single endpoint only)
- Spike model:
  - Baseline phase
  - Sudden spike phase
  - Recovery phase
- Validation:
  - Functional check: HTTP status is `200`
  - Performance thresholds: latency and failure rate

## 3. Assumptions
- Baseline concurrent users: `10` VUs
- Spike concurrent users: `120` VUs
- Acceptable latency:
  - Overall average response time `< 600 ms`
  - Overall p95 response time `< 1200 ms`
  - Recovery p95 `< 700 ms`
- Acceptable error rate: `< 5%`
- Test environment: local development backend connected to MongoDB
- Workload model: repeated `GET` requests with `1s` sleep between iterations

## 4. Test Setup
- Script: `performance/spike-product-list.js`
- k6 stages:
  - `30s` ramp to `10` VUs
  - `1m` steady at `10` VUs
  - `10s` ramp to `120` VUs (sudden spike)
  - `1m` steady at `120` VUs
  - `20s` ramp down to `10` VUs
  - `1m` steady recovery at `10` VUs
- Command used (clean run):

```powershell
$env:BASE_URL="http://localhost:6060/api/v1/product"
k6 run --summary-export="$env:TEMP\k6-spike-run5\summary.json" --out json="$env:TEMP\k6-spike-run5\raw.json" performance\spike-product-list.js
```

## 5. Metrics Reported
- Average response time: average latency across all requests.
- p95 response time: latency threshold experienced by 95% of requests.
- Error rate: percentage of failed requests (`http_req_failed`).
- Throughput (req/s): requests processed per second.
- Recovery behavior: latency and failure behavior after the spike ends.

## 6. Results

### 6.1 Overall Results (Run 5 - Clean)
- Total requests: `9252`
- Avg latency: `140.35 ms`
- p95 latency: `380.08 ms`
- Error rate: `0.00%`
- Check pass rate (`status is 200`): `100.00%`
- Throughput: `38.41 req/s`

### 6.2 Phase Results (Run 5 - Clean)

| Phase | Requests | Avg Latency | P95 | Error Rate | Throughput |
|---|---:|---:|---:|---:|---:|
| Baseline | 669 | 107.80 ms | 227.91 ms | 0.00% | 7.69 req/s |
| Spike | 6866 | 151.82 ms | 403.80 ms | 0.00% | 98.09 req/s |
| Recovery | 1717 | 107.17 ms | 256.81 ms | 0.00% | 21.46 req/s |

### 6.3 Threshold Evaluation
- `http_req_duration avg < 600ms`: PASS
- `http_req_duration p95 < 1200ms`: PASS
- `http_req_duration{phase:recovery} p95 < 700ms`: PASS
- `http_req_failed rate < 5%`: PASS
- `checks rate > 95%`: PASS

## 7. Analysis
The system stayed stable at baseline and handled the traffic surge without request failures. During the spike, average and p95 latency increased (as expected under higher concurrency), but values remained within acceptable thresholds. In recovery, latency returned close to baseline, indicating effective post-spike stabilization.

## 8. Bug Identified
Identified issue: development hot-reload configuration (`nodemon`) restarted the backend when test result files were written into watched directories.

Why it occurs under spike testing:
- k6 writes large JSON output files during/after execution.
- If output paths are watched by nodemon, file-write events trigger restarts.
- Restarts cause temporary connection refusal and inflated response times.

Impact:
- False negatives in performance testing (availability drops not caused by application logic).
- Distorted latency/error measurements during test windows.

## 9. Fix and Improvement
Fix implemented for clean measurement:
- Export k6 artifacts to a non-watched directory (`%TEMP%`) or configure nodemon to ignore performance artifact paths.

Before vs After (Observed):

| Metric | Before (run with watcher interference) | After (clean run) |
|---|---:|---:|
| Error rate | 0.75% | 0.00% |
| Check pass rate | 99.24% | 100.00% |
| Avg latency | 136.46 ms | 140.35 ms |
| p95 latency | 447.92 ms | 380.08 ms |
| Reliability | Intermittent connection refused | Stable |

Conclusion:
- After removing watcher interference, spike test results are consistent and valid for MS3 submission.
- The endpoint demonstrates acceptable spike resilience under the defined workload and thresholds.

## 10. Artifacts
- Script: `performance/spike-product-list.js`
- Latest overall summary JSON: `performance/results/spike-summary-latest.json`
- Latest phase summary JSON: `performance/results/spike-phase-summary-latest.json`
