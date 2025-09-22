## Pools PRD (Read-only MVP)

### Context

Pools (AMM) provide price signals and TVL for share tokens. For MVP, we expose read-only pool discovery and price/TVL query.

### Goals

- Show per-vault pools and a token’s price/TVL derived from pools
- Provide a basic analytics surface for investors and integrators

### Personas & Use Cases

- Investor/Trader: assess liquidity and price
- Integrator/Analyst: build dashboards with pool data

### In Scope (MVP)

1) List Pools by vault: assetA/B, reserves, feeBps
2) Get price/TVL for a symbol (optionally vs quote symbol)

### Out of Scope (Future)

- Add/Remove liquidity and swaps through UI/API (write paths)
- Multi-hop pricing and routing

### On-chain Contracts (reference)

- Events: `PoolCreated`, `LiquidityAdded`, `LiquidityRemoved`, `Swap`

### Data Model (ScyllaDB)

- `fractional.pools((network, vault_id), pool_id)` → { asset_a, asset_b, reserve_a, reserve_b, fee_bps, created_at }
- `fractional.pools_by_asset((network, asset_symbol), pool_id)` for lookup by asset

### Indexer

- Upsert pools and update reserves on events; upsert pools_by_asset

### API (GraphQL)

- Queries:
  - `pools(network, vaultId, limit)`
  - `priceTvl(network, symbol, quoteSymbol?)`

### Web (Next.js)

- Display pools and derived price/TVL on vault page (future panel)

### Observability

- Future: `app_pools_*` metrics

### Acceptance Criteria

- Pools list and price/TVL query return expected values from DB
- No lints/build issues; emulator smoke passes
