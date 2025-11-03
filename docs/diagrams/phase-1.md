## Phase 1 Mermaid Diagrams (Flows, Architecture, ER)

Contents

- Custody setup (LockBox)
- Vault registration from deposited NFT
- Listing fill and settlement
- AMM swap (SHARE/FLOW)
- Distribution schedule and claim
- Event pipeline (indexing)
- Component architecture
- ER data model

### Custody setup (LockBox) — sequence

```mermaid
sequenceDiagram
  autonumber
  actor U as User Wallet
  participant ENFT as ExampleNFT.Collection
  participant LB as Fractional.LockBox
  participant FRAC as Fractional

  U->>U: Setup LockBox storage and public cap
  note right of U: transactions/custody/user/setup-lockbox.cdc

  U->>ENFT: withdraw NFT(id)
  U->>LB: deposit(vaultId, <-NFT)
  LB-->>FRAC: emit UnderlyingDeposited(vaultId, tokenId)

  U->>FRAC: scripts/VaultCustodyStatus.cdc
  FRAC-->>U: custodyAlive == true (LockBoxPublic present)
```

Sources: `docs/custody-process.md`, `flow/cadence/transactions/custody/user/setup-lockbox.cdc`, `flow/cadence/scripts/VaultCustodyStatus.cdc`

### Vault registration from deposited NFT — sequence

```mermaid
sequenceDiagram
  autonumber
  actor U as Web UI
  participant API as API (GraphQL)
  participant TX as txRegisterVaultFromNFT
  participant FRAC as Fractional
  participant NATS as NATS (RAW/NORM)
  participant IDX as Indexer
  participant DB as ScyllaDB

  U->>API: Mutation registerVaultFromNFT(vaultId, paths, tokenId, shareSymbol, policy, creator)
  API->>TX: build + submit Cadence transaction
  TX->>FRAC: register vault from custody deposit
  FRAC-->>NATS: events (VaultRegistered, UnderlyingDeposited, ...)
  NATS->>IDX: normalized subjects flow.events.norm.<net>.fractional.*
  IDX->>DB: upsert fractional.vaults, share_tokens, events
  API-->>U: { txId }
```

Sources: `services/api/src/graphql/schema/index.ts`, `services/api/src/tx/vaults.ts`, `flow/cadence/transactions/*`

### Listing fill and settlement — sequence

```mermaid
sequenceDiagram
  autonumber
  actor B as Buyer Wallet
  participant FT as FlowToken
  participant PT as PlatformTreasury_FLOW
  actor A as Admin
  participant VST as VaultShareToken
  participant FEE as FeeRouter
  actor S as Seller Wallet
  participant FRAC as Fractional

  rect rgba(240,240,240,0.5)
    note over B,PT: Phase 1 — Buyer payment leg
    B->>FT: ensure /storage/flowTokenVault receiver published
    B->>PT: deposit FLOW priceAmount
    PT-->>B: ack escrowed funds (buyer leg complete)
  end

  rect rgba(240,240,240,0.5)
    note over A,FRAC: Phase 2 — Admin settlement
    A->>VST: withdraw shareAmount from admin escrow
    VST->>B: deposit shares to buyer receiver
    A->>PT: withdraw FLOW priceAmount
    A->>FEE: computeFeeSplits(vaultId, priceAmount)
    FEE-->>A: { feeAmount, sellerAmount, vaultShare, protocolShare }
    A->>S: pay sellerAmount FLOW
    A->>FEE: routeFee(vaultId, tokenIdent="FLOW", amount=feeAmount)
    A->>FRAC: fillListing(vaultId, listingId, buyer)
  end
```

Sources: `flow/cadence/transactions/listings/user/pay.cdc`, `flow/cadence/transactions/listings/admin/settle-fill.cdc`, `flow/cadence/contracts/FeeRouter.cdc`

### AMM swap (SHARE/FLOW) — sequence

```mermaid
sequenceDiagram
  autonumber
  actor T as Trader Wallet
  participant CONN as FungibleTokenConnectors
  participant POOL as AMM Pool
  participant FEE as FeeRouter

  T->>CONN: issue withdraw cap (in asset)
  T->>POOL: swap(direction, amountIn)
  POOL->>POOL: compute out amount
  POOL->>FEE: quote fee on taker leg (if configured)
  FEE-->>POOL: feeAmount, splits
  POOL->>T: deposit out asset (minus fee if taken)
  POOL-->>FEE: remit fee (route to vault and protocol treasuries)
```

Sources: `flow/cadence/contracts/amm/*`, `flow/cadence/contracts/FeeRouter.cdc`, `flow/cadence/{transactions,scripts}/pools/*`

### Distribution schedule and claim — sequence

```mermaid
sequenceDiagram
  autonumber
  actor A as Admin
  participant VST as VaultShareToken (Admin)
  participant SCH as FlowTransactionScheduler (V2)
  participant DH as DistributionHandler
  participant ESC as Distribution Escrow (VaultShareToken)
  actor H as Holder Wallet
  participant FRAC as Fractional

  A->>VST: mint totalAmount into ESC (per programId)
  A->>FRAC: scheduleDistribution(vaultId, programId, asset, totalAmount, schedule, startsAt, endsAt)
  A->>SCH: schedule(handler=/public/DistributionHandler, data:{programId,vaultId}, timestamp=startsAt)
  SCH->>DH: invoke at scheduled time
  DH->>FRAC: record program state (events)
  H->>ESC: claim(amount) to holder receiver
  ESC-->>H: deposit claimed shares
```

Sources: `flow/cadence/transactions/distributions/admin/schedule.cdc`, `flow/cadence/contracts/scheduler/*`, `flow/cadence/transactions/distributions/user/*`

### Event pipeline (indexing) — sequence

```mermaid
sequenceDiagram
  autonumber
  participant FLOW as Flow Access Node
  participant ING as Ingestor
  participant RAW as NATS Stream FLOW_EVENTS_RAW
  participant NORM as NATS Stream FLOW_EVENTS_NORM
  participant NOR as Normalizer
  participant IDX as Indexer
  participant DB as ScyllaDB
  participant API as API (GraphQL)
  actor WEB as Web (Next.js)

  FLOW-->>ING: block events
  ING->>RAW: publish flow.events.raw.<network>.<contract>.<event>
  NOR->>RAW: durable consume
  NOR->>NORM: publish flow.events.norm.<network>.fractional.* and amm.*
  IDX->>NORM: durable consume (filter_subject fractional.*)
  IDX->>DB: upsert domain tables (vaults, listings, pools, balances, ...)
  WEB->>API: queries (vaults, listings, pools, balances, events, fees)
  API->>DB: read materialized rows
  API-->>WEB: JSON response
```

Sources: `services/ingestor/src/index.ts`, `services/normalizer/src/index.ts`, `services/indexer/src/index.ts`, `infra/nats/js/*`

### Component architecture — component diagram

```mermaid
flowchart LR
  subgraph Client[Client]
    WEB[Web - Next.js + Flow React SDK]
  end

  subgraph Backend
    API[API - Fastify + GraphQL]
    ING[Ingestor]
    NOR[Normalizer]
    IDX[Indexer]
    DST[Distributor]
  end

  subgraph Infra
    NATS[(NATS JetStream\nFLOW_EVENTS_RAW and FLOW_EVENTS_NORM\nKV: FLOW_INDEX_CHKPT)]
    SCY[(ScyllaDB)]
    PROM[(Prometheus and Grafana)]
  end

  FLOW[(Flow Network)]

  WEB -- GraphQL --> API
  API -- reads and writes --> SCY
  FLOW -- Events --> ING
  ING -- RAW publish --> NATS
  NOR -- consume RAW and publish NORM --> NATS
  IDX -- consume NORM --> NATS
  IDX -- writes --> SCY
  DST -- reads programs and recipients --> SCY
  API -- metrics --> PROM
  ING -- metrics --> PROM
  NOR -- metrics --> PROM
  IDX -- metrics --> PROM
  DST -- metrics --> PROM
```

Sources: `docker-compose.yml`, `services/*/src/index.ts`, `infra/nats/*`, `infra/scylla/*`

### ER data model — Mermaid erDiagram

```mermaid
erDiagram
  VAULTS {
    text network
    text vault_id
    text collection
    text token_id
    text share_symbol
    text policy
    text creator
    timestamp created_at
    text state
    map metadata
  }

  SHARE_TOKENS {
    text network
    text symbol
    text vault_id
    int decimals
    text total_supply
    text mode
    text treasury
    timestamp created_at
  }

  LISTINGS {
    text network
    text vault_id
    text listing_id
    text seller
    text price_asset
    text price_amount
    text amount
    text status
    timestamp created_at
  }

  LISTINGS_BY_SELLER {
    text network
    text seller
    text listing_id
    text vault_id
    text price_asset
    text price_amount
    text amount
    text status
    timestamp created_at
  }

  POOLS {
    text network
    text vault_id
    text pool_id
    text owner
    text asset_a
    text asset_b
    text reserve_a
    text reserve_b
    int fee_bps
    timestamp created_at
  }

  POOLS_BY_ASSET {
    text network
    text asset_symbol
    text pool_id
    text vault_id
    text owner
    text other_asset
    text reserve_self
    text reserve_other
    int fee_bps
    timestamp created_at
  }

  BALANCES {
    text network
    text asset_symbol
    text account
    text amount
    timestamp updated_at
  }

  BALANCES_BY_ACCOUNT {
    text network
    text account
    text asset_symbol
    text amount
    timestamp updated_at
  }

  DISTRIBUTIONS {
    text network
    text vault_id
    text program_id
    text asset
    text total_amount
    text schedule
    timestamp starts_at
    timestamp ends_at
    timestamp created_at
  }

  CLAIMS {
    text network
    text program_id
    text account
    text amount
    timestamp claimed_at
  }

  DISTRIBUTION_RECIPIENTS {
    text network
    text program_id
    text account
    text amount
    timestamp created_at
  }

  EVENTS {
    text network
    text vault_id
    bigint block_height
    int tx_index
    int ev_index
    text tx_id
    text type
    text payload
    timestamp ts
  }

  FEES {
    text network
    text vault_id
    text kind
    text token
    text amount
    text vault_share
    text protocol_share
    text payer
    text tx_id
    timestamp created_at
  }

  FEE_TOTALS {
    text network
    text token
    text amount_total
    text vault_total
    text protocol_total
    timestamp updated_at
  }

  VAULT_FEE_STATE {
    text network
    text vault_id
    text current_fee_bps
    text current_vault_split_bps
    text current_protocol_split_bps
    text pending_fee_bps
    text pending_vault_split_bps
    text pending_protocol_split_bps
    text pending_effective_at
    timestamp updated_at
  }

  PROCESSED_EVENTS {
    text network
    text tx_id
    int ev_index
    timestamp processed_at
  }

  %% Conceptual relationships
  VAULTS ||--o{ SHARE_TOKENS : "has"
  VAULTS ||--o{ LISTINGS : "has"
  VAULTS ||--o{ POOLS : "has"
  VAULTS ||--o{ DISTRIBUTIONS : "has"
  DISTRIBUTIONS ||--o{ CLAIMS : "yields"
  DISTRIBUTIONS ||--o{ DISTRIBUTION_RECIPIENTS : "targets"
  VAULTS ||--o{ EVENTS : "emits"
  VAULTS ||--o{ FEES : "accrues"
```

Sources: `infra/scylla/001_core.cql`
