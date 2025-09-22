## Governance PRD (Buyouts & Redemption)

### Context

Governance allows holders to propose and vote on buyouts, and to redeem underlying when conditions are met. We expose txs and queries to run the lifecycle and show progress.

### Goals

- Allow proposing a buyout with asset, amount, quorum/support, and expiry
- Allow holders to vote and finalize proposals
- Allow redemption flow (post-conditions) via API

### Personas & Use Cases

- Proposer: creates buyout proposal
- Holder: votes for/against, redeems when allowed
- Admin: may set transfer mode, finalize if rules require

### In Scope (MVP)

1) Propose Buyout: asset, amount, quorum%, support%, expiresAt
2) Vote Buyout: record for/against tallies
3) Finalize Buyout: set result and finalize timestamp
4) Redeem: trigger redemption flow where supported by policy
5) Transfer mode controls for share token

### Out of Scope (Future)

- Advanced quorum models and delegated voting
- Off-chain proposal descriptions and metadata storage
- Multi-asset buyouts with escrow

### On-chain Contracts (reference)

- Events: `BuyoutProposed`, `BuyoutVoted`, `BuyoutFinalized`, `Redeemed`, `TransferModeChanged`
- Admin: propose, vote, finalize, redeem helpers, setTransferMode

### Data Model (ScyllaDB)

- `fractional.buyouts((network, vault_id), proposal_id)` → { proposer, asset, amount, quorum_percent, support_percent, expires_at, state, for_votes, against_votes, finalized_at }
- `fractional.events` captures lifecycle

### Indexer

- Insert on propose, update tallies on votes, finalize state on finalize

### API (GraphQL)

- Queries:
  - `buyouts(network, vaultId, limit)`
- Mutations:
  - `proposeBuyout`, `voteBuyout`, `finalizeBuyout`, `redeem`, `setTransferMode`
- Validation: numeric UFix64 strings for amounts, ints for quorum/support, epoch strings for expiresAt

### Web (Next.js)

- Vault detail can include a governance panel (future), for now minimal flows are exposed via API

### Observability

- Events persisted; future: `app_governance_*` metrics

### Acceptance Criteria

- Propose → Vote → Finalize updates reflected in queries
- Redeem mutation executes and state reflects in vaults/events
- No lints/build issues; emulator smoke passes

### Rollout

1) Verify emulator lifecycle end-to-end via API mutations
2) Check indexer writes to `fractional.buyouts`

### Risks & Mitigations

- Parameter validation errors → strict zod schemas and helpful messages
- Policy edge cases → document supported policies in UI/docs

### Open Questions

- Additional governance actions needed in v2?
