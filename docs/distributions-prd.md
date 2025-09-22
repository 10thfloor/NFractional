## Distributions PRD (Schedule & Claim)

### Context

Distributions allow scheduling payouts (dividends/streams) to holders and claiming accrued payouts. We expose scheduling and claiming flows with indexed visibility.

### Goals

- Allow admins to schedule distributions with asset, total amount, schedule meta, and time window
- Allow holders to claim accrued payouts
- Expose per-vault distribution programs and per-program claims

### Personas & Use Cases

- Admin: schedule distributions
- Holder: claim payouts
- Analyst: view scheduled programs and claim activity

### In Scope (MVP)

1) Schedule Distribution: asset, totalAmount, schedule JSON, startsAt, endsAt
2) Claim Payout: claim amount from a program
3) List distributions by vault, list claims by program

### Out of Scope (Future)

- Automatic accrual calculations per holder (beyond current contract semantics)
- Vesting/streaming engine variants and proration policies

### On-chain Contracts (reference)

- Events: `DistributionScheduled`, `PayoutClaimed`
- Admin: schedule helper; user: claim helper

### Data Model (ScyllaDB)

- `fractional.distributions((network, vault_id), program_id)` → { asset, total_amount, schedule, starts_at, ends_at, created_at }
- `fractional.claims((network, program_id), account)` (append-only with timestamps)

### Indexer

- Insert on schedule; append on claims

### API (GraphQL)

- Queries:
  - `distributions(network, vaultId, limit)`
  - `claims(network, programId, limit)`
- Mutations:
  - `scheduleDistribution(network, vaultId, programId, asset, totalAmount, schedule, startsAt, endsAt)`
  - `claimPayout(network, programId, amount)`

### Web (Next.js)

- Distribution and claims can be visualized on the vault page (future panel)

### Observability

- Persist events; future: `app_distributions_*` metrics

### Acceptance Criteria

- Schedule and claim flows work end-to-end and are visible via queries
- No lints/build issues; emulator smoke passes

### Rollout

1) Validate scheduling and claiming via API
2) Confirm indexer persistence

### Risks & Mitigations

- Time window misconfigurations → input validation; display timestamps
