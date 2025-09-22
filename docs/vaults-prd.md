## Vaults PRD (Fractionalization & Custody)

### Context

Vaults encapsulate the underlying NFT and its fractional share token lifecycle. We support creating a vault directly or from a user-owned NFT (custody), setting max supply metadata, and exposing vault discovery and details.

### Goals

- Enable creators to initialize vaults and fractionalize an NFT with a clear, auditable flow
- Support submission of a holder’s NFT via custody to be fractionalized
- Expose vault metadata, state, and creator for discovery and detail views

### Personas & Use Cases

- Creator/Owner: Create vaults, set share symbol and policy, optionally set max supply
- Investor/Buyer: Discover vaults, view metadata and policies
- Admin: Initialize platform resources and emit diagnostics

### In Scope (MVP)

1) Create Vault (admin): collection, tokenId, shareSymbol, policy
2) Create Vault From NFT (user + admin): withdraw NFT from user collection, deposit to custody, admin creates vault
3) Set Max Supply metadata for vault
4) Vault discovery: by id, by symbol, by creator, list all
5) Track vault state (e.g., open, redeemed) and created timestamp

### Out of Scope (Future)

- Multi-NFT vaults and basket strategies
- Complex vault policy variants (beyond current policy strings)
- Metadata mutation beyond max supply

### On-chain Contracts (reference)

- Admin: `createVault`, `createVaultFromNFT`
- Custody: user `setup`, deposit via `Custody.deposit`
- Events: `VaultCreated`, `UnderlyingDeposited`, `UnderlyingWithdrawn`, `UnderlyingBurned`

### Data Model (ScyllaDB)

- `fractional.vaults((network), vault_id)` → { collection, token_id, share_symbol, policy, creator, created_at, state, metadata[max_supply] }
- `fractional.events` for vault event history

### Indexer

- Insert vault row on `VaultCreated`
- Update `state` on redeem-related events
- Update `metadata['max_supply']` when set via API

### API (GraphQL)

- Queries:
  - `vault(network, vaultId)`
  - `vaultBySymbol(network, symbol)`
  - `vaults(network, limit)`
  - `vaultsByCreator(network, creator, limit)`
- Mutations:
  - `createVault(network, vaultId, collection, tokenId, shareSymbol, policy)`
  - `createVaultFromNFT(network, vaultId, collectionStoragePath, collectionPublicPath, tokenId, shareSymbol, policy)`
  - `setVaultMaxSupply(network, vaultId, maxSupply)`
- Validation:
  - Enforce numeric tokenId, UFix64 strings for supply
  - Network guard vs `ENV.FLOW_NETWORK`

### Web (Next.js)

- New Vault pages: `/vaults/new` and `/vaults/new/wizard` for custody-assisted flow
- Vault detail page shows core fields and panels for related features (listings, etc.)

### Observability

- Events persisted to `fractional.events`
- Service metrics (existing) for request timings; future: add `app_vaults_*` metrics

### Acceptance Criteria

- Create vault via direct admin flow and via custody-assisted user flow
- Vaults list and detail queries return accurate metadata and state
- Max supply can be set and is reflected in API responses
- No lints/build issues; local smoke tests pass

### Rollout

1) Verify emulator end-to-end for both create flows
2) Validate indexer writes into `fractional.vaults`
3) Document custody setup and usage for creators/holders

### Risks & Mitigations

- Collection path mismatches → surface helpful errors and docs
- Max supply metadata divergence → use single writer path via API mutation

### Open Questions

- Additional policy types needed for v2?
- Should vaults support multiple underlying assets?
