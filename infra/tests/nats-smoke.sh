#!/bin/sh
set -eu

NATS_URL="${NATS_URL:-nats://localhost:4222}"
NETWORK="${NETWORK:-emulator}"

fail() { echo "[FAIL] $1" >&2; exit 1; }
ok() { echo "[OK] $1"; }

# Helper: JS request
js_req() {
  subj="$1"; shift
  payload="${1:-{}}"
  nats -s "$NATS_URL" request --timeout=5s "$subj" "$payload"
}

# Verify streams exist via JS API
js_req "\$JS.API.STREAM.INFO.FLOW_EVENTS_RAW" '{}' >/dev/null 2>&1 || fail "Missing stream FLOW_EVENTS_RAW"
ok "Stream FLOW_EVENTS_RAW present"

js_req "\$JS.API.STREAM.INFO.FLOW_EVENTS_NORM" '{}' >/dev/null 2>&1 || fail "Missing stream FLOW_EVENTS_NORM"
ok "Stream FLOW_EVENTS_NORM present"

# Verify consumer exists via JS API with retry (eventual consistency)
retries=10
while [ $retries -gt 0 ]; do
  if js_req "\$JS.API.CONSUMER.INFO.FLOW_EVENTS_NORM.indexer" '{}' >/dev/null 2>&1; then
    ok "Consumer indexer on FLOW_EVENTS_NORM present"
    break
  fi
  retries=$((retries-1))
  sleep 0.5
done
[ $retries -gt 0 ] || fail "Missing consumer indexer on FLOW_EVENTS_NORM"

# Verify KV stream exists
js_req "\$JS.API.STREAM.INFO.KV_FLOW_INDEX_CHKPT" '{}' >/dev/null 2>&1 || fail "Missing KV FLOW_INDEX_CHKPT stream"
ok "KV FLOW_INDEX_CHKPT stream present"

echo "NATS smoke OK"
