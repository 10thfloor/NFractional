#!/bin/sh
set -eu

NETWORK="${NETWORK:-emulator}"
VLT_ID="${VLT_ID:-vlt-indexer-smoke}"
TIMEOUT_SEC="${TIMEOUT_SEC:-20}"

deadline=$(( $(date +%s) + TIMEOUT_SEC ))

have_all_events=false
have_vault_state=false
have_buyout_row=false
have_balances=false

while [ $(date +%s) -lt "$deadline" ]; do
  # 1) Events table should contain core types including mint/transfer
  ev_types=$(cqlsh scylla 9042 -e "SELECT type FROM fractional.events WHERE network='${NETWORK}' AND vault_id='${VLT_ID}' LIMIT 100;" 2>/dev/null | awk 'NR>=4 && NF>0{print $1}') || ev_types=""
  if echo "$ev_types" | grep -q "VaultCreated" && \
     echo "$ev_types" | grep -q "BuyoutProposed" && \
     echo "$ev_types" | grep -q "BuyoutVoted" && \
     echo "$ev_types" | grep -q "BuyoutFinalized" && \
     echo "$ev_types" | grep -q "Redeemed" && \
     echo "$ev_types" | grep -q "SharesMinted" && \
     echo "$ev_types" | grep -q "Transfer"; then
    have_all_events=true
  else
    have_all_events=false
  fi

  # 2) Vault state should be 'redeemed'
  vault_state=$(cqlsh scylla 9042 -e "SELECT state FROM fractional.vaults WHERE network='${NETWORK}' AND vault_id='${VLT_ID}';" 2>/dev/null | awk 'NR==4{print $1}') || vault_state=""
  if [ "$vault_state" = "redeemed" ]; then
    have_vault_state=true
  else
    have_vault_state=false
  fi

  # 3) Buyout row should exist and be 'succeeded'
  buyout_state=$(cqlsh scylla 9042 -e "SELECT state FROM fractional.buyouts WHERE network='${NETWORK}' AND vault_id='${VLT_ID}' AND proposal_id='p1';" 2>/dev/null | awk 'NR==4{print $1}') || buyout_state=""
  if [ "$buyout_state" = "succeeded" ]; then
    have_buyout_row=true
  else
    have_buyout_row=false
  fi

  # 4) Balances should reflect mints and transfer: 0xA = 90, 0xB = 60, supply = 150
  bal_a=$(cqlsh scylla 9042 -e "SELECT amount FROM fractional.balances WHERE network='${NETWORK}' AND asset_symbol='EX42' AND account='0xA';" 2>/dev/null | awk 'NR==4{print $1}') || bal_a=""
  bal_b=$(cqlsh scylla 9042 -e "SELECT amount FROM fractional.balances WHERE network='${NETWORK}' AND asset_symbol='EX42' AND account='0xB';" 2>/dev/null | awk 'NR==4{print $1}') || bal_b=""
  supply=$(cqlsh scylla 9042 -e "SELECT total_supply FROM fractional.share_tokens WHERE network='${NETWORK}' AND symbol='EX42';" 2>/dev/null | awk 'NR==4{print $1}') || supply=""
  if [ "$bal_a" = "90" ] || [ "$bal_a" = "90.0" ]; then
    if [ "$bal_b" = "60" ] || [ "$bal_b" = "60.0" ]; then
      if [ "$supply" = "150" ] || [ "$supply" = "150.0" ]; then
        have_balances=true
      else
        have_balances=false
      fi
    else
      have_balances=false
    fi
  else
    have_balances=false
  fi

  if $have_all_events && $have_vault_state && $have_buyout_row && $have_balances; then
    echo "[OK] Indexed events and projections verified for vault_id=${VLT_ID}"
    # Print a compact summary
    echo "-- events --"
    cqlsh scylla 9042 -e "SELECT type, tx_id FROM fractional.events WHERE network='${NETWORK}' AND vault_id='${VLT_ID}' ORDER BY block_height ASC, tx_index ASC, ev_index ASC LIMIT 20;" 2>/dev/null | sed -n '1,12p'
    echo "-- vault --"
    cqlsh scylla 9042 -e "SELECT network, vault_id, state FROM fractional.vaults WHERE network='${NETWORK}' AND vault_id='${VLT_ID}';" 2>/dev/null | sed -n '1,8p'
    echo "-- buyout --"
    cqlsh scylla 9042 -e "SELECT network, vault_id, proposal_id, state FROM fractional.buyouts WHERE network='${NETWORK}' AND vault_id='${VLT_ID}' AND proposal_id='p1';" 2>/dev/null | sed -n '1,8p'
    echo "-- balances --"
    cqlsh scylla 9042 -e "SELECT account, amount FROM fractional.balances WHERE network='${NETWORK}' AND asset_symbol='EX42' LIMIT 10;" 2>/dev/null | sed -n '1,12p'
    cqlsh scylla 9042 -e "SELECT symbol, total_supply FROM fractional.share_tokens WHERE network='${NETWORK}' AND symbol='EX42';" 2>/dev/null | sed -n '1,8p'
    exit 0
  fi

  sleep 1
done

echo "[FAIL] Verification failed for vault_id=${VLT_ID}" >&2
echo "Have events: $have_all_events, vault redeemed: $have_vault_state, buyout succeeded: $have_buyout_row, balances ok: $have_balances" >&2
exit 1
