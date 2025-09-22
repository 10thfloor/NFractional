#!/bin/sh
set -eu

SCYLLA_HOST="${SCYLLA_HOST:-scylla}"
SCYLLA_PORT="${SCYLLA_PORT:-9042}"

fail() { echo "[FAIL] $1" >&2; exit 1; }
ok() { echo "[OK] $1"; }

cql() {
  cqlsh "$SCYLLA_HOST" "$SCYLLA_PORT" -e "$1"
}

# Verify keyspace exists
cql "DESCRIBE KEYSPACE fractional" >/dev/null 2>&1 || fail "Missing keyspace fractional"
ok "Keyspace fractional present"

# Verify tables
for t in vaults events buyouts balances processed_events share_tokens listings listings_by_seller pools pools_by_asset distributions claims; do
  cql "DESCRIBE TABLE fractional.$t" >/dev/null 2>&1 || fail "Missing table fractional.$t"
  ok "Table fractional.$t present"
done

# Verify materialized views
for v in buyouts_by_state balances_by_account; do
  cql "DESCRIBE MATERIALIZED VIEW fractional.$v" >/dev/null 2>&1 || fail "Missing MV fractional.$v"
  ok "MV fractional.$v present"
done

# CRUD smoke on balances
now=$(date +%s000)
stmt="INSERT INTO fractional.balances (network, asset_symbol, account, amount, updated_at) VALUES ('emulator','TEST','acct1','100', toTimestamp($now));"
cql "$stmt" || fail "Insert failed"

out=$(cql "SELECT amount FROM fractional.balances WHERE network='emulator' AND asset_symbol='TEST' AND account='acct1';" | awk 'NR==4{print $1}')
[ "$out" = "100" ] || fail "Read mismatch on balances"
ok "CRUD on balances works"

echo "Scylla smoke OK"
