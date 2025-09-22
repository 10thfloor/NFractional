### Emulator walkthrough (absolute paths, non-interactive)

- Assumes Flow CLI is installed and `flow.json` is at `/Users/mk/flow-hackathon/flow/flow.json`.

1) Start emulator (in a separate terminal)

```bash
flow emulator --init --verbose
```

2) (Optional but recommended) Ensure emulator accounts in `flow.json` exist

```bash
ruby /Users/mk/flow-hackathon/flow/bootstrap-accounts.rb
```

3) Deploy contracts

```bash
cd /Users/mk/flow-hackathon/flow && flow project deploy --network emulator --yes
```

4) Set up admin (admin resource) on `flow-admin`

```bash
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/setup/admin/setup-admin.cdc \
  --network emulator --signer flow-admin --yes
```

5) Initialize scheduler (FeeActivator cap, Manager, Handler) on `flow-admin`

```bash
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/scheduler/admin/init.cdc \
  --network emulator --signer flow-admin --yes
```

Optional: Schedule fee activation (demo)

```bash
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/scheduler/admin/schedule.cdc \
  --network emulator --signer flow-admin \
  --args-json '[{"type":"String","value":"vault-1"}]' \
  --yes
```

Or via API GraphQL:

```graphql
mutation ScheduleFeeActivation {
  scheduleFeeActivation(network: "emulator", vaultId: "vault-1") { txId }
}
```

6) Set up ExampleNFT collection for the user (e.g., `holder-1`)

```bash
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/example-nft/user/setup-collection.cdc \
  --network emulator --signer holder-1 --yes
```

7) Mint an ExampleNFT to the user (minter lives in contract account `emulator-account`)

```bash
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/example-nft/admin/mint-to.cdc \
  --network emulator --signer emulator-account \
  --args-json '[{"type":"Address","value":"0xe03daebed8ca0615"},{"type":"String","value":"My NFT"},{"type":"String","value":"Demo NFT for fractionalization"},{"type":"String","value":"https://example.com/img.png"}]' \
  --yes
```

8) Get the user’s ExampleNFT token IDs (to pick a `tokenId` to fractionalize)

```bash
flow scripts execute /Users/mk/flow-hackathon/flow/cadence/scripts/ExampleNFTGetIDs.cdc \
  --network emulator \
  --args-json '[{"type":"Address","value":"0xe03daebed8ca0615"}]'
```

9) Set up Fractional custody in the user’s account

```bash
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/custody/user/setup.cdc \
  --network emulator --signer holder-1 --yes
```

9) User submits NFT for fractionalization (multi-authorizer: user + admin)

- Replace `<TOKEN_ID>` with a value returned from step 7 (string format).
- IMPORTANT: `collectionStoragePath` here is just the identifier `"exampleNFTCollection"`. Same for `collectionPublicPath` (it is only recorded/emitted here).

```bash
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/vault/user/submit-from-collection.cdc \
  --network emulator \
  --authorizer holder-1 \
  --authorizer flow-admin \
  --payer emulator-account \
  --proposer holder-1 \
  --args-json '[{"type":"String","value":"vault-1"},{"type":"String","value":"exampleNFTCollection"},{"type":"String","value":"exampleNFTCollection"},{"type":"UInt64","value":"<NFT_ID>"},{"type":"String","value":"EX1"},{"type":"String","value":"free-transfer"}]' \
  --yes
```

10) Verify vault state and symbol mapping

- Lookup vault id by symbol:

```bash
flow scripts execute /Users/mk/flow-hackathon/flow/cadence/scripts/GetVaultIdBySymbol.cdc \
  --network emulator \
  --args-json '[{"type":"String","value":"EX1"}]'
```

- Fetch the vault:

```bash
flow scripts execute /Users/mk/flow-hackathon/flow/cadence/scripts/GetVault.cdc \
  --network emulator \
  --args-json '[{"type":"String","value":"vault-1"}]'
```

11) Mint fractional shares (admin action)

```bash
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/shares/admin/mint.cdc \
  --network emulator \
  --signer flow-admin \  --args-json '[    {"type":"String","value":"EX1"},
    {"type":"Array","value":[{"type":"Address","value":"0xe03daebed8ca0615"}]},
    {"type":"Array","value":[{"type":"UFix64","value":"100.0"}]}
  ]' \
  --yes
```

12) Verify balances

```bash
flow scripts execute /Users/mk/flow-hackathon/flow/cadence/scripts/GetBalance.cdc \
  --network emulator \
  --args-json '[{"type":"String","value":"EX1"},{"type":"Address","value":"0xe03daebed8ca0615"}]'
```

13) Optional: admin share transfer (if you want to test movement)

```bash
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/shares/admin/transfer.cdc \
  --network emulator \
  --signer flow-admin \
  --args-json '[{"type":"String","value":"EX1"},{"type":"Address","value":"<HOLDER_FLOW_ACCT>"},{"type":"Address","value":"0x045a1763c93006ca"},{"type":"UFix64","value":"10.0"}]' \
  --yes
```

### Buyouts

```bash
# Propose a buyout (admin)
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/governance/admin/buyout-propose.cdc \
  --network emulator \
  --signer flow-admin \
  --args-json '[
    {"type":"String","value":"vault-1"},
    {"type":"String","value":"prop-1"},
    {"type":"String","value":"FLOW"},
    {"type":"UFix64","value":"1000.0"},
    {"type":"UInt64","value":"60"},
    {"type":"UInt64","value":"60"},
    {"type":"UInt64","value":"1735689600"}
  ]' \
  --yes

# Vote on buyout (admin demo; wire real voting later)
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/governance/admin/buyout-vote.cdc \
  --network emulator \
  --signer flow-admin \
  --args-json '[
    {"type":"String","value":"vault-1"},
    {"type":"String","value":"prop-1"},
    {"type":"UFix64","value":"100.0"},
    {"type":"UFix64","value":"0.0"}
  ]' \
  --yes

# Finalize buyout (admin)
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/governance/admin/buyout-finalize.cdc \
  --network emulator \
  --signer flow-admin \
  --args-json '[
    {"type":"String","value":"vault-1"},
    {"type":"String","value":"prop-1"},
    {"type":"String","value":"succeeded"}
  ]' \
  --yes
```

### Distributions & Claims

```bash
# Schedule a distribution (admin)
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/distributions/admin/schedule.cdc \
  --network emulator \
  --signer flow-admin \
  --args-json '[
    {"type":"String","value":"vault-1"},
    {"type":"String","value":"prog-1"},
    {"type":"String","value":"FLOW"},
    {"type":"UFix64","value":"50.0"},
    {"type":"String","value":"{\"type\":\"vest\",\"periodDays\":7}"},
    {"type":"UInt64","value":"1735689600"},
    {"type":"UInt64","value":"1736294400"}
  ]' \
  --yes

# Claim a payout (holder demo)
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/distributions/user/claim.cdc \
  --network emulator \
  --signer holder-1 \
  --args-json '[
    {"type":"String","value":"prog-1"},
    {"type":"UFix64","value":"10.0"}
  ]' \
  --yes
```

### Listings (create/cancel/fill)

Admin wrappers emit listing events. Use these during development to drive the indexer and UI.

```bash
# Create a listing
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/diagnostic/admin/emit-listing-created.cdc \
  --network emulator \
  --signer emulator-account \
  --args-json '[
    {"type":"String","value":"vault-1"},
    {"type":"String","value":"L-001"},
    {"type":"Address","value":"0xf8d6e0586b0a20c7"},
    {"type":"String","value":"FLOW"},
    {"type":"UFix64","value":"1.50"},
    {"type":"UFix64","value":"25.0"}
  ]' \
  --yes

# Fill a listing
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/diagnostic/admin/emit-listing-filled.cdc \
  --network emulator \
  --signer emulator-account \
  --args-json '[
    {"type":"String","value":"vault-1"},
    {"type":"String","value":"L-001"}
  ]' \
  --yes

# Cancel a listing
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/diagnostic/admin/emit-listing-cancelled.cdc \
  --network emulator \
  --signer emulator-account \
  --args-json '[
    {"type":"String","value":"vault-1"},
    {"type":"String","value":"L-002"}
  ]' \
  --yes

# Expire a listing
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/diagnostic/admin/emit-listing-expired.cdc \
  --network emulator \
  --signer emulator-account \
  --args-json '[
    {"type":"String","value":"vault-1"},
    {"type":"String","value":"L-003"}
  ]' \
  --yes
```

Direct admin-resource wrappers (non-diagnostic) via contract account (emulator):

```bash
# Create listing via Admin wrapper
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/listings/admin/create.cdc \
  --network emulator \
  --signer emulator-account \
  --args-json '[
    {"type":"String","value":"vault-1"},
    {"type":"String","value":"L-004"},
    {"type":"String","value":"FLOW"},
    {"type":"UFix64","value":"2.00"},
    {"type":"UFix64","value":"10.0"}
  ]' \
  --yes

# Cancel listing
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/listings/admin/cancel.cdc \
  --network emulator \
  --signer emulator-account \
  --args-json '[
    {"type":"String","value":"vault-1"},
    {"type":"String","value":"L-004"}
  ]' \
  --yes

# Fill listing
flow transactions send /Users/mk/flow-hackathon/flow/cadence/transactions/listings/admin/fill.cdc \
  --network emulator \
  --signer emulator-account \
  --args-json '[
    {"type":"String","value":"vault-1"},
    {"type":"String","value":"L-004"}
  ]' \
  --yes
```

Why this design works

- Custody pattern avoids moving the underlying NFT into admin’s account; user retains custody resource while vault metadata is written and events are emitted. This is simple and auditable.
- Multi-authorizer keeps user in control of the NFT movement (withdraw from their collection) while admin attests/creates the vault and emits events.
- We separated vault creation from share minting so you can layer policy and distribution logic independently.

### API integration

For GraphQL API details (queries, mutations, env variables, and refactored structure), see:

`/Users/mk/flow-hackathon/services/api/README.md`

### Ingestor cursor: fetch and reset

The ingestor stores its checkpoint (cursor) in NATS JetStream KV `FLOW_INDEX_CHKPT` under key `<network>.ingestor` (e.g., `emulator.ingestor`).

1) Get latest sealed height (optional, via Access API):

```bash
curl -s http://host.docker.internal:8888/v1/blocks?height=sealed | jq '.[0].header.height'
```

2) Open a shell with the NATS CLI (utility container on the compose network):

```bash
docker compose -f /Users/mk/flow-hackathon/docker-compose.yml run --rm -T nats-init sh
```

Inside that shell, you can fetch or update the cursor:

```bash
# Read current cursor
nats -s nats://nats:4222 kv get FLOW_INDEX_CHKPT emulator.ingestor

# Set cursor to a specific height (replace H)
nats -s nats://nats:4222 kv put FLOW_INDEX_CHKPT emulator.ingestor H

# Reset cursor to 0 (reingest from genesis)
nats -s nats://nats:4222 kv put FLOW_INDEX_CHKPT emulator.ingestor 0
```

One-liner without an interactive shell:

```bash
docker compose -f /Users/mk/flow-hackathon/docker-compose.yml run --rm -T nats-init \
  sh -lc 'nats -s nats://nats:4222 kv get FLOW_INDEX_CHKPT emulator.ingestor'

docker compose -f /Users/mk/flow-hackathon/docker-compose.yml run --rm -T nats-init \
  sh -lc 'nats -s nats://nats:4222 kv put FLOW_INDEX_CHKPT emulator.ingestor 0'
```

Notes:

- No service restart is required; `flow-ingestor` detects the updated cursor on its next poll.
- Adjust the key prefix if you change `NETWORK` (e.g., `testnet.ingestor`).
