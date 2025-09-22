## Share Tokens PRD (Controls & Metadata)

### Context

Share tokens represent fractional ownership of a vault’s underlying. We need to surface token-level metadata and control transfer modes for operational safety.

### Goals

- Expose share token metadata (symbol, decimals, total supply, mode, treasury)
- Allow changing transfer mode (open/allowlist/paused)
- Reflect supply changes as they occur on-chain

### Personas & Use Cases

- Creator/Admin: control transfer mode
- Holder/Investor: view token stats and mode
- Integrator: query token metadata for analytics

### In Scope (MVP)

1) Get Share Token by symbol with metadata fields
2) Set Transfer Mode via mutation
3) Reflect supply updates from indexer

### Out of Scope (Future)

- Per-account allowlist management via API
- On-chain royalties/fee configuration

### On-chain Contracts (reference)

- Events: `SharesMinted`, `TransferModeChanged`, `Transfer`
- Admin helpers for setTransferMode

### Data Model (ScyllaDB)

- `fractional.share_tokens((network, symbol))` → { vault_id, decimals, total_supply, mode, treasury, created_at }

### Indexer

- Upsert token metadata and supply; update on mint/transfer events as available

### API (GraphQL)

- Query: `shareToken(network, symbol)` → ShareToken
- Mutation: `setTransferMode(network, symbol, mode)`

### Web (Next.js)

- Token info surfaced on vault page; mode controls can be admin-only UI in future

### Observability

- Future: `app_tokens_*` metrics

### Acceptance Criteria

- Token metadata fetch works; mode changes reflected in DB and queries
- No lints/build issues; emulator smoke passes
