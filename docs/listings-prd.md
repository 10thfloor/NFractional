## Listings PRD (Fractionalization Platform)

### Context

We support fractionalizing an NFT into share tokens and can create, cancel, and fill listings on-chain via `Fractional.Admin`. This PRD defines the minimal, complete Listings feature set for MVP marketplace interactions and the supporting API/UI.

### Goals

- Enable creators and holders to list shares for sale with clear status and history
- Allow buyers to browse and act on listings for a given vault
- Provide sellers a simple view of their listings
- Support manual expiry for stale/invalid listings
- Persist and expose listing events and current states through API/UI

### Personas & Primary Use Cases

- Creator/Owner: List initial shares to bootstrap liquidity or distribution
- Investor/Buyer: Browse vault listings and purchase via fills
- Trader: Manage own listings; cancel or let expire when appropriate
- Admin: Operationally expire listings as needed

### In Scope (MVP)

1) Create Listing: seller, price asset, price amount, amount
2) Cancel Listing: move status → `cancelled`
3) Fill Listing: move status → `filled`
4) Expire Listing (manual): move status → `expired`
5) Browse Listings by Vault: list, sort newest-first (implicit by created_at)
6) Browse Listings by Seller: list a seller’s open and historical listings
7) Status & UI Guards: actions disabled unless status is `open`
8) Event History: index and expose listing-related contract events

### Out of Scope (Future)

- Partial fills and residuals
- Edit listing price/amount
- Listing TTL/auto-expire policy
- Fees/royalties and settlement accounting
- AMM/Pool-based routing and quotes

### On-chain Contracts (reference)

- Events: `ListingCreated`, `ListingFilled`, `ListingCancelled`, `ListingExpired`
- Admin: `createListing`, `cancelListing`, `fillListing`, `expireListing`

### Data Model (ScyllaDB)

- `fractional.listings((network, vault_id), listing_id)` → { seller, price_asset, price_amount, amount, status, created_at }
- `fractional.listings_by_seller((network, seller), listing_id)` → { vault_id, price_asset, price_amount, amount, status, created_at }
- `fractional.events` retains event feed for vaults
- Status enum: `open | filled | cancelled | expired`

### Indexer

- Upsert on `ListingCreated` into both tables with status `open`
- Update status on `ListingFilled`, `ListingCancelled`, `ListingExpired`

### API (GraphQL)

- Queries:
  - `listings(network, vaultId, limit)` → Listing[]
  - `listingsBySeller(network, seller, limit)` → Listing[]
- Mutations:
  - `createListing(network, vaultId, listingId, priceAsset, priceAmount, amount)`
  - `cancelListing(network, vaultId, listingId)`
  - `fillListing(network, vaultId, listingId)`
  - `expireListing(network, vaultId, listingId)`
- Validation:
  - Numeric fields as UFix64 strings for price/amount; non-empty IDs
  - Network guard vs `ENV.FLOW_NETWORK`

### Web (Next.js)

- Vault page `ListingsPanel`:
  - Create form (listing id, price asset, price amount, amount)
  - List of listings (amount, price, seller, status)
  - Actions: Fill, Cancel, Expire (enabled only when status = `open`)
- My Listings page `/listings/mine`:
  - Fetch by `listingsBySeller` using stored default account
  - Show vault id, price/amount, status

### Observability

- Persist events in `fractional.events`
- Expose counts/timings via existing service metrics (future: add `app_listings_*` metrics)

### Acceptance Criteria

- Can create, cancel, fill, and expire a listing for a vault via UI → API → on-chain → indexer → DB → UI reflects status
- `listings` shows per-vault listings with accurate statuses
- `listingsBySeller` returns seller’s listings; My Listings displays them
- UI disables actions for non-`open` listings
- No lints/build errors; smoke tests for API and UI pass locally

### Rollout

1) Land API and Web changes
2) Run docker stack; ingest events; verify listings lifecycle end-to-end
3) Document manual expiry usage for admins/operators

### Risks & Mitigations

- Admin-mediated fills may differ from user expectations → clarify in UI copy for MVP
- No TTL auto-expire → provide manual `expireListing` and status guards; plan TTL in v2

### Open Questions

- Should buyers authorize fills directly vs admin-mediated? (v2)
- Should listings support partial fills and edit flow? (v2)
