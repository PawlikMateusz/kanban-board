#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT"

PB_IMAGE="${PB_IMAGE:-kanban-backend:latest}"
PB_TEST_PORT="${PB_TEST_PORT:-8091}"
VITE_PORT="${VITE_PORT:-5174}"
PLAYWRIGHT_IMAGE="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.49.1-jammy}"

# 1. Isolated PocketBase test instance on a fresh DB (docker volume so the wipe
#    never hits host-permission issues with root-owned files).
PB_VOLUME="${PB_VOLUME:-kanban-e2e-pb-test}"
docker rm -f kanban-backend-test >/dev/null 2>&1 || true
docker volume rm "$PB_VOLUME" >/dev/null 2>&1 || true
echo ">> Starting isolated test backend (${PB_IMAGE}) on :${PB_TEST_PORT}"
docker run -d --name kanban-backend-test \
  -p "${PB_TEST_PORT}:8080" \
  -v "$PB_VOLUME:/pb_data" \
  "$PB_IMAGE" >/dev/null

cleanup() {
  echo ">> Stopping test backend"
  docker rm -f kanban-backend-test >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo ">> Waiting for test backend to be healthy"
ok=0
for _ in $(seq 1 60); do
  if curl -sf "http://localhost:${PB_TEST_PORT}/api/health" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 1
done
if [ "$ok" != "1" ]; then
  echo "Test backend failed to become healthy" >&2
  exit 1
fi

# 2. Run Playwright inside a node/browser container using host networking so it
#    can reach the test backend and the Vite dev server it spawns.
echo ">> Running Playwright (${PLAYWRIGHT_IMAGE})"
docker run --rm --network host \
  -v "$FRONTEND:/app" \
  -e PB_TEST_URL="http://localhost:${PB_TEST_PORT}" \
  -w /app \
  "$PLAYWRIGHT_IMAGE" \
  bash -c "npm install && npx playwright install chromium && npx playwright test"
