-- ScyllaDB core schema for Fractional NFT SDK
-- Apply with: cqlsh -f infra/scylla/001_core.cql

CREATE KEYSPACE IF NOT EXISTS fractional
WITH replication = {'class': 'NetworkTopologyStrategy', 'datacenter1': '3'}
AND durable_writes = true;

CREATE TABLE IF NOT EXISTS fractional.vaults (
  network text,
  vault_id text,
  collection text,
  token_id text,
  share_symbol text,
  policy text,
  creator text,
  created_at timestamp,
  state text,
  metadata map<text, text>,
  PRIMARY KEY ((network, vault_id))
);

CREATE TABLE IF NOT EXISTS fractional.events (
  network text,
  vault_id text,
  block_height bigint,
  tx_index int,
  ev_index int,
  tx_id text,
  type text,
  payload text,
  ts timestamp,
  PRIMARY KEY ((network, vault_id), block_height, tx_index, ev_index)
) WITH CLUSTERING ORDER BY (block_height ASC, tx_index ASC, ev_index ASC);

CREATE TABLE IF NOT EXISTS fractional.buyouts (
  network text,
  vault_id text,
  proposal_id text,
  proposer text,
  asset text,
  amount text,
  quorum_percent int,
  support_percent int,
  expires_at timestamp,
  state text,
  for_votes text,
  against_votes text,
  finalized_at timestamp,
  PRIMARY KEY ((network, vault_id), proposal_id)
);

CREATE TABLE IF NOT EXISTS fractional.balances (
  network text,
  asset_symbol text,
  account text,
  amount text,
  updated_at timestamp,
  PRIMARY KEY ((network, asset_symbol), account)
);

-- Materialized views
CREATE MATERIALIZED VIEW IF NOT EXISTS fractional.buyouts_by_state AS
  SELECT network, state, vault_id, proposal_id, expires_at
  FROM fractional.buyouts
  WHERE network IS NOT NULL AND state IS NOT NULL AND vault_id IS NOT NULL AND proposal_id IS NOT NULL
  PRIMARY KEY ((network, state), vault_id, proposal_id)
  WITH CLUSTERING ORDER BY (vault_id ASC, proposal_id ASC);

CREATE MATERIALIZED VIEW IF NOT EXISTS fractional.balances_by_account AS
  SELECT network, account, asset_symbol, amount, updated_at
  FROM fractional.balances
  WHERE network IS NOT NULL AND account IS NOT NULL AND asset_symbol IS NOT NULL
  PRIMARY KEY ((network, account), asset_symbol)
  WITH CLUSTERING ORDER BY (asset_symbol ASC);

-- Idempotency ledger
CREATE TABLE IF NOT EXISTS fractional.processed_events (
  network text,
  tx_id text,
  ev_index int,
  processed_at timestamp,
  PRIMARY KEY ((network), tx_id, ev_index)
);



-- Extended domain tables

-- Per-vault share token metadata (symbol is unique per network)
CREATE TABLE IF NOT EXISTS fractional.share_tokens (
  network text,
  symbol text,
  vault_id text,
  decimals int,
  total_supply text,
  mode text,              -- transfer mode: open | allowlist | paused
  treasury text,
  created_at timestamp,
  PRIMARY KEY ((network, symbol))
);

-- Listings on marketplaces for share tokens (per-vault)
CREATE TABLE IF NOT EXISTS fractional.listings (
  network text,
  vault_id text,
  listing_id text,
  seller text,
  price_asset text,
  price_amount text,
  amount text,
  status text,            -- open | filled | cancelled | expired
  created_at timestamp,
  PRIMARY KEY ((network, vault_id), listing_id)
);

-- Denormalized view for querying listings by seller
CREATE TABLE IF NOT EXISTS fractional.listings_by_seller (
  network text,
  seller text,
  listing_id text,
  vault_id text,
  price_asset text,
  price_amount text,
  amount text,
  status text,
  created_at timestamp,
  PRIMARY KEY ((network, seller), listing_id)
);

-- AMM pools involving share tokens
CREATE TABLE IF NOT EXISTS fractional.pools (
  network text,
  vault_id text,
  pool_id text,
  owner text,
  asset_a text,
  asset_b text,
  reserve_a text,
  reserve_b text,
  fee_bps int,
  created_at timestamp,
  PRIMARY KEY ((network, vault_id), pool_id)
);

-- Denormalized view to find pools by a given asset
CREATE TABLE IF NOT EXISTS fractional.pools_by_asset (
  network text,
  asset_symbol text,
  pool_id text,
  vault_id text,
  owner text,
  other_asset text,
  reserve_self text,
  reserve_other text,
  fee_bps int,
  created_at timestamp,
  PRIMARY KEY ((network, asset_symbol), pool_id)
);

-- Distribution programs (dividends/streams) per vault
CREATE TABLE IF NOT EXISTS fractional.distributions (
  network text,
  vault_id text,
  program_id text,
  asset text,
  total_amount text,
  schedule text,          -- JSON: {type:"vest|stream",...}
  starts_at timestamp,
  ends_at timestamp,
  created_at timestamp,
  PRIMARY KEY ((network, vault_id), program_id)
);

-- Claims for a distribution program
CREATE TABLE IF NOT EXISTS fractional.claims (
  network text,
  program_id text,
  account text,
  amount text,
  claimed_at timestamp,
  PRIMARY KEY ((network, program_id), account)
);

-- Recipients for distribution programs
CREATE TABLE IF NOT EXISTS fractional.distribution_recipients (
  network text,
  program_id text,
  account text,
  amount text,
  created_at timestamp,
  PRIMARY KEY ((network, program_id), account)
);


-- Fees accrued on actions (e.g., taker fees on fills)
CREATE TABLE IF NOT EXISTS fractional.fees (
  network text,
  vault_id text,
  kind text,
  "token" text,
  amount text,
  vault_share text,
  protocol_share text,
  payer text,
  tx_id text,
  created_at timestamp,
  PRIMARY KEY ((network, vault_id), created_at, tx_id)
);

-- Aggregated platform fee totals (by network+token)
CREATE TABLE IF NOT EXISTS fractional.fee_totals (
  network text,
  "token" text,
  amount_total text,
  vault_total text,
  protocol_total text,
  updated_at timestamp,
  PRIMARY KEY ((network), "token")
);

-- Vault fee schedule state (current and pending)
CREATE TABLE IF NOT EXISTS fractional.vault_fee_state (
  network text,
  vault_id text,
  current_fee_bps text,
  current_vault_split_bps text,
  current_protocol_split_bps text,
  pending_fee_bps text,
  pending_vault_split_bps text,
  pending_protocol_split_bps text,
  pending_effective_at text,
  updated_at timestamp,
  PRIMARY KEY ((network), vault_id)
);

