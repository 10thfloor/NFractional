#!/bin/sh
set -eu

# Dev reset script: clears NATS JetStream streams/consumers/KV checkpoints
# and truncates Scylla tables. Intended for local docker-compose env.
#
# Env vars (override as needed):
#   NETWORK=emulator|testnet        (default: emulator)
#   NATS_URL=nats://nats:4222       (default for docker-compose network)
#   KEYSPACE=fractional             (default app keyspace)
#
# Usage:
#   chmod +x infra/reset-dev.sh
#   ./infra/reset-dev.sh

NETWORK="${NETWORK:-emulator}"
NATS_URL="${NATS_URL:-nats://localhost:4222}"
KEYSPACE="${KEYSPACE:-fractional}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT_DIR}"

echo "[reset] NETWORK=${NETWORK} NATS_URL=${NATS_URL} KEYSPACE=${KEYSPACE}"

require() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is required to run this script." >&2
    exit 1
  fi
  if ! command -v docker compose >/dev/null 2>&1; then
    # Fallback for older docker-compose
    if ! command -v docker-compose >/dev/null 2>&1; then
      echo "docker compose (or docker-compose) is required." >&2
      exit 1
    fi
  fi
  if ! command -v nats >/dev/null 2>&1; then
    echo "The 'nats' CLI is required. Install via: brew install nats-io/nats-tools/nats (macOS)" >&2
    exit 1
  fi
}

compose() {
  if command -v docker compose >/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

run_nats() {
  cmd="$1"
  /bin/sh -lc "${cmd}"
}

reset_nats() {
  echo "[reset:nats] Purging JetStream streams (FLOW_EVENTS_RAW, FLOW_EVENTS_NORM)"
  run_nats "nats -s '${NATS_URL}' stream purge -f FLOW_EVENTS_RAW || true"
  run_nats "nats -s '${NATS_URL}' stream purge -f FLOW_EVENTS_NORM || true"


  echo "[reset:nats] Ensuring FLOW_EVENTS_NORM stream uses updated subjects (drop & recreate)"
  run_nats "nats -s '${NATS_URL}' stream rm -f FLOW_EVENTS_NORM || true"

  echo "[reset:nats] Deleting durable consumer 'indexer' on FLOW_EVENTS_NORM (if exists)"
  run_nats "nats -s '${NATS_URL}' consumer delete -f FLOW_EVENTS_NORM indexer || true"

  echo "[reset:nats] Clearing KV checkpoint key '${NETWORK}.indexer' in bucket FLOW_INDEX_CHKPT (if exists)"
  run_nats "nats -s '${NATS_URL}' kv rm -f FLOW_INDEX_CHKPT '${NETWORK}.indexer' || true"
  echo "[reset:nats] Clearing KV checkpoint key '${NETWORK}.ingestor' in bucket FLOW_INDEX_CHKPT (if exists)"
  run_nats "nats -s '${NATS_URL}' kv rm -f FLOW_INDEX_CHKPT '${NETWORK}.ingestor' || true"

  echo "[reset:nats] Ensuring JetStream resources exist (streams, consumer, KV)"
  NETWORK="${NETWORK}" NATS_URL="${NATS_URL}" sh infra/nats/jetstream-setup.sh
}

reset_scylla() {
  echo "[reset:scylla] Truncating keyspace '${KEYSPACE}' tables"
  for tbl in \
    events \
    vaults \
    buyouts \
    balances \
    processed_events \
    share_tokens \
    listings \
    listings_by_seller \
    pools \
    pools_by_asset \
    distributions \
    claims \
    fees \
    vault_fee_state
  do
    echo "TRUNCATE ${KEYSPACE}.${tbl};"
    compose exec -T scylla cqlsh -e "TRUNCATE ${KEYSPACE}.${tbl};" || true
  done

  # Scylla does not support TRUNCATE MATERIALIZED VIEW; skip MV truncation
}

restart_ingestor() {
  echo "[reset:ingestor] Restarting flow-ingestor"
  compose restart flow-ingestor || {
    echo "Failed to restart flow-ingestor. Is it running?" >&2
    exit 1
  }
}

restart_normalizer() {
  echo "[reset:normalizer] Restarting flow-normalizer"
  compose restart flow-normalizer || {
    echo "Failed to restart flow-normalizer. Is it running?" >&2
    exit 1
  }
}

restart_indexer() {
  echo "[reset:indexer] Restarting flow-indexer"
  compose restart flow-indexer || {
    echo "Failed to restart flow-indexer. Is it running?" >&2
    exit 1
  }
}

require

echo "[reset] Starting NATS reset"
reset_nats

echo "[reset] Starting Scylla reset"
reset_scylla

echo "[reset] Restarting services to pick up fresh checkpoint and stream filters"
restart_ingestor
restart_normalizer
restart_indexer

echo "[reset] Done. Environment reset for development."


