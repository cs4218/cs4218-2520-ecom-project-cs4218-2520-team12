#!/usr/bin/env bash
# [Your Name], [Your Student ID]
# Volume Testing - Run All
# Milestone 3 - Non-Functional Testing

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:6060/api/v1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "${AUTH_TOKEN:-}" && ( -z "${AUTH_EMAIL:-}" || -z "${AUTH_PASSWORD:-}" ) ]]; then
  echo "ERROR: set AUTH_TOKEN, or set AUTH_EMAIL and AUTH_PASSWORD."
  exit 1
fi

if [[ -z "${ADMIN_TOKEN:-}" && ( -z "${ADMIN_EMAIL:-}" || -z "${ADMIN_PASSWORD:-}" ) ]]; then
  echo "ERROR: set ADMIN_TOKEN, or set ADMIN_EMAIL and ADMIN_PASSWORD."
  exit 1
fi

echo "Running volume test suite against ${BASE_URL}"

echo "1) Protected Routes"
k6 run --env BASE_URL="${BASE_URL}" --env AUTH_EMAIL="${AUTH_EMAIL:-}" --env AUTH_PASSWORD="${AUTH_PASSWORD:-}" --env ADMIN_EMAIL="${ADMIN_EMAIL:-}" --env ADMIN_PASSWORD="${ADMIN_PASSWORD:-}" --env AUTH_TOKEN="${AUTH_TOKEN:-}" --env ADMIN_TOKEN="${ADMIN_TOKEN:-}" "${SCRIPT_DIR}/protected-routes-volume.js"

echo "2) Orders"
k6 run --env BASE_URL="${BASE_URL}" --env AUTH_EMAIL="${AUTH_EMAIL:-}" --env AUTH_PASSWORD="${AUTH_PASSWORD:-}" --env ADMIN_EMAIL="${ADMIN_EMAIL:-}" --env ADMIN_PASSWORD="${ADMIN_PASSWORD:-}" --env AUTH_TOKEN="${AUTH_TOKEN:-}" --env ADMIN_TOKEN="${ADMIN_TOKEN:-}" "${SCRIPT_DIR}/orders-volume.js"

echo "3) Profile"
k6 run --env BASE_URL="${BASE_URL}" --env AUTH_EMAIL="${AUTH_EMAIL:-}" --env AUTH_PASSWORD="${AUTH_PASSWORD:-}" --env AUTH_TOKEN="${AUTH_TOKEN:-}" "${SCRIPT_DIR}/profile-volume.js"

echo "4) Admin View Users"
k6 run --env BASE_URL="${BASE_URL}" --env ADMIN_EMAIL="${ADMIN_EMAIL:-}" --env ADMIN_PASSWORD="${ADMIN_PASSWORD:-}" --env ADMIN_TOKEN="${ADMIN_TOKEN:-}" "${SCRIPT_DIR}/admin-users-volume.js"

echo "All volume tests completed."
