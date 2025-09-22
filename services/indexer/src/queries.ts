// Centralized CQL statements for the indexer
// Grouped by domain to keep indexer logic readable

export const insertEventQuery =
  "INSERT INTO fractional.events (network, vault_id, block_height, tx_index, ev_index, tx_id, type, payload, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, toTimestamp(now()))";

export const upsertBuyoutQuery =
  "INSERT INTO fractional.buyouts (network, vault_id, proposal_id, proposer, asset, amount, quorum_percent, support_percent, expires_at, state, for_votes, against_votes, finalized_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

export const upsertVaultQuery =
  "INSERT INTO fractional.vaults (network, vault_id, collection, token_id, share_symbol, policy, creator, created_at, state) VALUES (?, ?, ?, ?, ?, ?, ?, toTimestamp(now()), ?)";

export const setVaultStateQuery =
  "UPDATE fractional.vaults SET state = ? WHERE network = ? AND vault_id = ?";

export const setVaultMaxSupplyQuery =
  "UPDATE fractional.vaults SET metadata['max_supply'] = ? WHERE network = ? AND vault_id = ?";

export const setBuyoutTalliesQuery =
  "UPDATE fractional.buyouts SET for_votes = ?, against_votes = ? WHERE network = ? AND vault_id = ? AND proposal_id = ?";

export const finalizeBuyoutQuery =
  "UPDATE fractional.buyouts SET state = ?, finalized_at = toTimestamp(now()) WHERE network = ? AND vault_id = ? AND proposal_id = ?";

// Extended domain
export const upsertShareTokenQuery =
  "INSERT INTO fractional.share_tokens (network, symbol, vault_id, decimals, total_supply, mode, treasury, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, toTimestamp(now()))";

export const updateShareTokenModeQuery =
  "UPDATE fractional.share_tokens SET mode = ? WHERE network = ? AND symbol = ?";

export const getShareTokenSupplyQuery =
  "SELECT total_supply, decimals FROM fractional.share_tokens WHERE network = ? AND symbol = ?";

export const updateShareTokenSupplyQuery =
  "UPDATE fractional.share_tokens SET total_supply = ? WHERE network = ? AND symbol = ?";

export const getShareTokenVaultQuery =
  "SELECT vault_id FROM fractional.share_tokens WHERE network = ? AND symbol = ?";

export const upsertListingQuery =
  "INSERT INTO fractional.listings (network, vault_id, listing_id, seller, price_asset, price_amount, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, toTimestamp(now()))";

export const upsertListingBySellerQuery =
  "INSERT INTO fractional.listings_by_seller (network, seller, listing_id, vault_id, price_asset, price_amount, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, toTimestamp(now()))";

export const updateListingStatusQuery =
  "UPDATE fractional.listings SET status = ? WHERE network = ? AND vault_id = ? AND listing_id = ?";

// Additional helpers to keep listings_by_seller view in sync on status changes
export const getListingSellerQuery =
  "SELECT seller FROM fractional.listings WHERE network = ? AND vault_id = ? AND listing_id = ?";

export const updateListingBySellerStatusQuery =
  "UPDATE fractional.listings_by_seller SET status = ? WHERE network = ? AND seller = ? AND listing_id = ?";

export const upsertPoolQuery =
  "INSERT INTO fractional.pools (network, vault_id, pool_id, owner, asset_a, asset_b, reserve_a, reserve_b, fee_bps, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, toTimestamp(now()))";

export const upsertPoolByAssetQuery =
  "INSERT INTO fractional.pools_by_asset (network, asset_symbol, pool_id, vault_id, owner, other_asset, reserve_self, reserve_other, fee_bps, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, toTimestamp(now()))";

export const updatePoolReservesQuery =
  "UPDATE fractional.pools SET reserve_a = ?, reserve_b = ? WHERE network = ? AND vault_id = ? AND pool_id = ?";

export const upsertDistributionQuery =
  "INSERT INTO fractional.distributions (network, vault_id, program_id, asset, total_amount, schedule, starts_at, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, toTimestamp(now()))";

export const upsertClaimQuery =
  "INSERT INTO fractional.claims (network, program_id, account, amount, claimed_at) VALUES (?, ?, ?, ?, toTimestamp(now()))";

export const getBalanceQuery =
  "SELECT amount FROM fractional.balances WHERE network = ? AND asset_symbol = ? AND account = ?";

export const upsertBalanceQuery =
  "INSERT INTO fractional.balances (network, asset_symbol, account, amount, updated_at) VALUES (?, ?, ?, ?, toTimestamp(now()))";

export const insertFeeQuery =
  'INSERT INTO fractional.fees (network, vault_id, kind, "token", amount, vault_share, protocol_share, payer, tx_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, toTimestamp(now()))';

export const upsertFeeTotalsQuery =
  "UPDATE fractional.fee_totals SET amount_total = ?, vault_total = ?, protocol_total = ?, updated_at = toTimestamp(now()) WHERE network = ? AND token = ?";

// Idempotency ledger: mark event as processed; only proceed if applied
export const markProcessedEventQuery =
  "INSERT INTO fractional.processed_events (network, tx_id, ev_index, processed_at) VALUES (?, ?, ?, toTimestamp(now())) IF NOT EXISTS";

// Fee schedule state upserts
export const upsertPendingFeeScheduleQuery =
  "UPDATE fractional.vault_fee_state SET pending_fee_bps = ?, pending_vault_split_bps = ?, pending_protocol_split_bps = ?, pending_effective_at = ?, updated_at = toTimestamp(now()) WHERE network = ? AND vault_id = ?";

export const upsertCurrentFeeScheduleQuery =
  "UPDATE fractional.vault_fee_state SET current_fee_bps = ?, current_vault_split_bps = ?, current_protocol_split_bps = ?, pending_fee_bps = null, pending_vault_split_bps = null, pending_protocol_split_bps = null, pending_effective_at = null, updated_at = toTimestamp(now()) WHERE network = ? AND vault_id = ?";
