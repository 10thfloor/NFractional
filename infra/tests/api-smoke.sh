#!/bin/sh
set -eu

API_URL="${API_URL:-http://api:4000/graphql}"
WAIT_SEC="${WAIT_SEC:-20}"

# Introspection query to verify GraphQL schema presence
INTROSPECTION='{"query":"{ __schema { queryType { name } types { name } } }"}'

# Wait for API to respond to introspection
deadline=$(( $(date +%s) + WAIT_SEC ))
ok=false
while [ $(date +%s) -lt "$deadline" ]; do
  code=$(curl -sS -m 3 --retry 2 --retry-delay 1 --retry-connrefused \
    -o /tmp/api_out.json -w "%{http_code}" \
    -H 'content-type: application/json' \
    --data "$INTROSPECTION" "$API_URL" || true)
  if [ "$code" = "200" ] && grep -q '\"__schema\"' /tmp/api_out.json; then
    ok=true
    break
  fi
  sleep 1
done

if ! $ok; then
  echo "[FAIL] GraphQL schema not available (HTTP $code)" >&2
  cat /tmp/api_out.json >&2 || true
  exit 1
fi

echo "[OK] GraphQL schema available"
echo "-- schema introspection --"
cat /tmp/api_out.json


