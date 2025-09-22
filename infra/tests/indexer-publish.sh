#!/bin/sh
set -eu

NATS_URL="${NATS_URL:-nats://nats:4222}"
NETWORK="${NETWORK:-emulator}"
VLT_ID="${VLT_ID:-vlt-indexer-smoke}"

publish() {
  subj="$1"; shift
  body="$1"; shift
  nats -s "${NATS_URL}" pub "${subj}" "${body}" >/dev/null
}

subject_base="flow.events.norm.${NETWORK}.fractional"

msg_vault_created=$(cat <<JSON
{"network":"${NETWORK}","type":"VaultCreated","vaultId":"${VLT_ID}","blockHeight":1,"txIndex":0,"evIndex":0,"txId":"t-${VLT_ID}","payload":{"vaultId":"${VLT_ID}","collection":"ExampleNFT","tokenId":42,"shareSymbol":"EX42","policy":"buyoutOnly","creator":"0x01"}}
JSON
)

msg_buyout_proposed=$(cat <<JSON
{"network":"${NETWORK}","type":"BuyoutProposed","vaultId":"${VLT_ID}","blockHeight":2,"txIndex":0,"evIndex":0,"txId":"t-${VLT_ID}-p","payload":{"vaultId":"${VLT_ID}","proposalId":"p1","proposer":"0xB","asset":"FLOW","amount":"2000.0","quorumPercent":60,"supportPercent":60,"expiresAt":1700000000000}}
JSON
)

msg_buyout_voted=$(cat <<JSON
{"network":"${NETWORK}","type":"BuyoutVoted","vaultId":"${VLT_ID}","blockHeight":3,"txIndex":0,"evIndex":0,"txId":"t-${VLT_ID}-v","payload":{"vaultId":"${VLT_ID}","proposalId":"p1","forVotes":"500000.0","againstVotes":"100000.0"}}
JSON
)

msg_buyout_finalized=$(cat <<JSON
{"network":"${NETWORK}","type":"BuyoutFinalized","vaultId":"${VLT_ID}","blockHeight":4,"txIndex":0,"evIndex":0,"txId":"t-${VLT_ID}-f","payload":{"vaultId":"${VLT_ID}","proposalId":"p1","result":"succeeded"}}
JSON
)

msg_redeemed=$(cat <<JSON
{"network":"${NETWORK}","type":"Redeemed","vaultId":"${VLT_ID}","blockHeight":5,"txIndex":0,"evIndex":0,"txId":"t-${VLT_ID}-r","payload":{"vaultId":"${VLT_ID}"}}
JSON
)

echo "Publishing indexer smoke events for ${VLT_ID}"
publish "${subject_base}.VaultCreated"     "${msg_vault_created}"
## Mint 2 holders and a transfer between them
msg_shares_minted=$(cat <<JSON
{"network":"${NETWORK}","type":"SharesMinted","vaultId":"${VLT_ID}","blockHeight":1,"txIndex":1,"evIndex":0,"txId":"t-${VLT_ID}-m","payload":{"symbol":"EX42","mints":[{"account":"0xA","amount":"100.0"},{"account":"0xB","amount":"50.0"}]}}
JSON
)
publish "${subject_base}.SharesMinted"     "${msg_shares_minted}"

msg_transfer=$(cat <<JSON
{"network":"${NETWORK}","type":"Transfer","vaultId":"${VLT_ID}","blockHeight":1,"txIndex":2,"evIndex":0,"txId":"t-${VLT_ID}-x","payload":{"symbol":"EX42","from":"0xA","to":"0xB","amount":"10.0"}}
JSON
)
publish "${subject_base}.Transfer"         "${msg_transfer}"
publish "${subject_base}.BuyoutProposed"   "${msg_buyout_proposed}"
publish "${subject_base}.BuyoutVoted"      "${msg_buyout_voted}"
publish "${subject_base}.BuyoutFinalized"  "${msg_buyout_finalized}"
publish "${subject_base}.Redeemed"         "${msg_redeemed}"

echo "Indexer publish done"
