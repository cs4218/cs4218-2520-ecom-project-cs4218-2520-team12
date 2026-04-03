#!/usr/bin/env bash
# Snodgrass Eliot Peter, A0269684H

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat >&2 <<EOF
Usage: $(basename "$0") [--discovery] [--auth] [--checkout] [--admin] [--all]

Flags (can be combined):
  --discovery   Run discovery stress tests
  --auth        Run auth/session stress tests
  --checkout    Run checkout transaction stress tests (internal + external)
  --admin       Run admin catalog mutation stress tests
  --all         Run all tests (default if no flags given)

Environment variables:
  REPEATS            Number of repeats per VU level (default: 1)
  BASE_URL           API base URL (default: http://localhost:6060/api/v1)
  AUTH_EMAIL         Email for auth/checkout tests (required)
  AUTH_PASSWORD      Password for auth/checkout tests (required)
  ADMIN_EMAIL        Email for admin mutation tests (required with --admin)
  ADMIN_PASSWORD     Password for admin mutation tests (required with --admin)
EOF
  exit 1
}

RUN_DISCOVERY=false
RUN_AUTH=false
RUN_CHECKOUT=false
RUN_ADMIN=false

if [[ $# -eq 0 ]]; then
  RUN_DISCOVERY=true
  RUN_AUTH=true
  RUN_CHECKOUT=true
fi

for arg in "$@"; do
  case "$arg" in
    --discovery) RUN_DISCOVERY=true ;;
    --auth)      RUN_AUTH=true ;;
    --checkout)  RUN_CHECKOUT=true ;;
    --admin)     RUN_ADMIN=true ;;
    --all)       RUN_DISCOVERY=true; RUN_AUTH=true; RUN_CHECKOUT=true; RUN_ADMIN=true ;;
    --help|-h)   usage ;;
    *) echo "ERROR: Unknown flag: $arg" >&2; usage ;;
  esac
done

if ! command -v k6 >/dev/null 2>&1; then
  echo "ERROR: k6 not found in PATH." >&2
  exit 1
fi

if [[ ! -x "$(command -v python3)" ]]; then
  echo "ERROR: python3 not found in PATH." >&2
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="stress-testing/results/${TIMESTAMP}"
RAW_DIR="${OUT_DIR}/raw"
SUMMARY_DIR="${OUT_DIR}/summaries"
mkdir -p "$RAW_DIR" "$SUMMARY_DIR"

MANIFEST="${OUT_DIR}/manifest.csv"
RAW_COMBINED="${OUT_DIR}/all_runs.txt"

echo "test_id,script,peak_vus,repeat,dependency_mode,summary_file,raw_log_file,exit_code,started_at,ended_at" > "$MANIFEST"

REPEATS="${REPEATS:-1}"

DISCOVERY_VUS=(25 50 100 150)
AUTH_VUS=(25 50 100 150)
CHECKOUT_VUS=(5 10 15 20)
ADMIN_VUS=(20 40 80 120)

AUTH_EMAIL="30march@gmail.com"
AUTH_PASSWORD="30march@gmail.com"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
BASE_URL="${BASE_URL:-http://localhost:6060/api/v1}"

if [[ "$RUN_AUTH" == true || "$RUN_CHECKOUT" == true ]]; then
  if [[ -z "$AUTH_EMAIL" || -z "$AUTH_PASSWORD" ]]; then
    echo "ERROR: AUTH_EMAIL and AUTH_PASSWORD are required for auth and checkout tests." >&2
    exit 1
  fi
fi

if [[ "$RUN_ADMIN" == true ]]; then
  if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
    echo "ERROR: ADMIN_EMAIL and ADMIN_PASSWORD are required for --admin tests." >&2
    exit 1
  fi
fi

run_case() {
  local test_id="$1"
  local script_path="$2"
  local peak_vus="$3"
  local repeat_no="$4"
  local dependency_mode="$5"

  local started_at
  started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  local run_key="${test_id}-vus${peak_vus}-r${repeat_no}"
  if [[ -n "$dependency_mode" ]]; then
    run_key="${run_key}-${dependency_mode}"
  fi

  local summary_file="${SUMMARY_DIR}/${run_key}.json"
  local raw_file="${RAW_DIR}/${run_key}.txt"

  echo "============================================================" | tee -a "$RAW_COMBINED"
  echo "RUN: ${run_key}" | tee -a "$RAW_COMBINED"
  echo "SCRIPT: ${script_path}" | tee -a "$RAW_COMBINED"
  echo "START: ${started_at}" | tee -a "$RAW_COMBINED"

  (
    export BASE_URL
    export AUTH_EMAIL
    export AUTH_PASSWORD
    export ADMIN_EMAIL
    export ADMIN_PASSWORD

    case "$test_id" in
      discovery)
        export PEAK_VUS="$peak_vus"
        export P95_TARGET_MS="3500"
        k6 run --summary-export "$summary_file" "$script_path"
        ;;
      auth_session)
        export PEAK_VUS="$peak_vus"
        export LOGIN_P95_TARGET_MS="1500"
        export SERVER_5XX_TARGET="0.01"
        k6 run --summary-export "$summary_file" "$script_path"
        ;;
      checkout_internal)
        export DEPENDENCY_MODE="internal"
        export PEAK_VUS="$peak_vus"
        export P95_TARGET_MS="3500"
        export INTERNAL_FAILURE_TARGET="0.05"
        k6 run --summary-export "$summary_file" "$script_path"
        ;;
      checkout_external)
        export DEPENDENCY_MODE="external"
        export PEAK_VUS="$peak_vus"
        export P95_TARGET_MS="3500"
        export INTERNAL_FAILURE_TARGET="0.05"
        k6 run --summary-export "$summary_file" "$script_path"
        ;;
      admin_mutation)
        export PEAK_VUS="$peak_vus"
        export WRITE_P95_TARGET_MS="2500"
        export SERVER_5XX_TARGET="0.02"
        k6 run --summary-export "$summary_file" "$script_path"
        ;;
      *)
        echo "Unknown test_id: $test_id" >&2
        exit 2
        ;;
    esac
  ) 2>&1 | tee "$raw_file" | tee -a "$RAW_COMBINED"

  local exit_code=${PIPESTATUS[0]}
  local ended_at
  ended_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  echo "END: ${ended_at}" | tee -a "$RAW_COMBINED"
  echo "EXIT: ${exit_code}" | tee -a "$RAW_COMBINED"
  echo "" | tee -a "$RAW_COMBINED"

  echo "${test_id},${script_path},${peak_vus},${repeat_no},${dependency_mode},${summary_file},${raw_file},${exit_code},${started_at},${ended_at}" >> "$MANIFEST"
}

for ((r=1; r<=REPEATS; r++)); do
  if [[ "$RUN_DISCOVERY" == true ]]; then
    for vus in "${DISCOVERY_VUS[@]}"; do
      run_case "discovery" "stress-testing/k6/discovery-stress-test.js" "$vus" "$r" ""
    done
  fi

  if [[ "$RUN_AUTH" == true ]]; then
    for vus in "${AUTH_VUS[@]}"; do
      run_case "auth_session" "stress-testing/k6/auth-session-stress-test.js" "$vus" "$r" ""
    done
  fi

  if [[ "$RUN_CHECKOUT" == true ]]; then
    for vus in "${CHECKOUT_VUS[@]}"; do
      run_case "checkout_internal" "stress-testing/k6/checkout-transaction-stress-test.js" "$vus" "$r" "internal"
      run_case "checkout_external" "stress-testing/k6/checkout-transaction-stress-test.js" "$vus" "$r" "external"
    done
  fi

  if [[ "$RUN_ADMIN" == true ]]; then
    for vus in "${ADMIN_VUS[@]}"; do
      run_case "admin_mutation" "stress-testing/k6/admin-catalog-mutation-stress-test.js" "$vus" "$r" ""
    done
  fi
done

python3 stress-testing/tools/build_stress_report.py \
  --manifest "$MANIFEST" \
  --output "${OUT_DIR}/stress-report.md"

echo "Completed stress matrix." 
echo "Results directory: ${OUT_DIR}"
echo "Manifest: ${MANIFEST}"
echo "Report: ${OUT_DIR}/stress-report.md"
