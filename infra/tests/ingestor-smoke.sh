#!/bin/sh
set -eu

NATS_URL="${NATS_URL:-nats://nats:4222}"
NETWORK="${NETWORK:-emulator}"
CONTRACT="Fractional"
EVENT="VaultCreated"
RAW_SUBJ="flow.events.raw.${NETWORK}.${CONTRACT}.${EVENT}"

deadline=$(( $(date +%s) + ${TIMEOUT_SEC:-20} ))

echo "[ingestor-smoke] Subscribing for RAW ${RAW_SUBJ}"
nats -s "${NATS_URL}" sub -C 1 "${RAW_SUBJ}" >/tmp/ingestor_raw.json 2>/dev/null &
sub_pid=$!
sleep 0.5

echo "[ingestor-smoke] Triggering flow-ingestor by backfilling 0..0 (no-op expected)"
# The ingestor polls automatically; just wait until it publishes at least one event if ACCESS emits any

while [ $(date +%s) -lt "$deadline" ]; do
  if kill -0 "$sub_pid" 2>/dev/null; then
    if grep -q '"type": "VaultCreated"' /tmp/ingestor_raw.json 2>/dev/null; then
      echo "[OK] Ingestor published a RAW event"
      exit 0
    fi
  else
    break
  fi
  sleep 1
done

echo "[WARN] Did not observe RAW message. Ensure FLOW_ACCESS points to emulator/testnet with events for ${EVENT}."
exit 1


