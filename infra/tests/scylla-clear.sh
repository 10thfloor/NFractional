#!/bin/sh
set -eu

SCYLLA_HOST="${SCYLLA_HOST:-scylla}"
SCYLLA_PORT="${SCYLLA_PORT:-9042}"
KEYSPACE="${KEYSPACE:-fractional}"

run() {
  cqlsh "$SCYLLA_HOST" "$SCYLLA_PORT" -e "$1"
}

# Base tables
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
  claims
 do
  echo "TRUNCATE ${KEYSPACE}.${tbl};"
  run "TRUNCATE ${KEYSPACE}.${tbl};" || true
 done

# Materialized views (best-effort; ignore if unsupported)
for mv in \
  buyouts_by_state \
  balances_by_account
 do
  echo "TRUNCATE MATERIALIZED VIEW ${KEYSPACE}.${mv};"
  run "TRUNCATE MATERIALIZED VIEW ${KEYSPACE}.${mv};" || true
 done

echo "[OK] Scylla tables truncated in keyspace ${KEYSPACE}"
