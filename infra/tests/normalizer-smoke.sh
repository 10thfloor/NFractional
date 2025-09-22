#!/bin/sh
set -eu

NATS_URL="${NATS_URL:-nats://nats:4222}"
NETWORK="${NETWORK:-emulator}"

RAW_SUBJ="flow.events.raw.${NETWORK}.Fractional.VaultCreated"
NORM_SUBJ="flow.events.norm.${NETWORK}.fractional.VaultCreated"

tmp_out="/tmp/norm_out.json"

echo "[normalizer-smoke] Subscribing once to ${NORM_SUBJ}"
nats -s "${NATS_URL}" sub -C 1 "${NORM_SUBJ}" >"${tmp_out}" 2>/dev/null &
sub_pid=$!
sleep 0.5

echo "[normalizer-smoke] Publishing RAW event to ${RAW_SUBJ}"
body=$(cat <<JSON
{
  "network":"${NETWORK}",
  "blockHeight": 1,
  "txIndex": 0,
  "evIndex": 0,
  "txId": "t-normalizer-smoke",
  "contract": {"name":"Fractional","address":"0x01"},
  "type": "VaultCreated",
  "payload": {
    "vaultId":"vlt-norm",
    "collection":"ExampleNFT",
    "tokenId":42,
    "shareSymbol":"EX42",
    "policy":"buyoutOnly",
    "creator":"0x01"
  }
}
JSON
)

nats -s "${NATS_URL}" pub "${RAW_SUBJ}" "${body}" >/dev/null

echo "[normalizer-smoke] Waiting for normalized output..."
wait "$sub_pid" || true

if grep -q "t-normalizer-smoke" "${tmp_out}"; then
  echo "[OK] Normalizer forwarded RAW → NORM"
  exit 0
fi

echo "[FAIL] Did not observe normalized message on ${NORM_SUBJ}" >&2
echo "Output:" >&2
cat "${tmp_out}" >&2 || true
exit 1


