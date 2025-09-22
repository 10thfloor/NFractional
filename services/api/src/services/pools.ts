import type { Client as Cassandra } from "cassandra-driver";

export async function listPools(
  cassandra: Cassandra,
  params: { network: string; vaultId: string; limit: number }
) {
  const q =
    "SELECT network, vault_id, pool_id, owner, asset_a, asset_b, reserve_a, reserve_b, fee_bps, created_at FROM fractional.pools WHERE network=? AND vault_id=? LIMIT ?";
  const r = await cassandra.execute(
    q,
    [params.network, params.vaultId, params.limit],
    {
      prepare: true,
    }
  );
  return r.rows.map((row) => ({
    network: row.get("network"),
    vaultId: row.get("vault_id"),
    poolId: row.get("pool_id"),
    owner: row.get("owner"),
    assetA: row.get("asset_a"),
    assetB: row.get("asset_b"),
    reserveA: row.get("reserve_a"),
    reserveB: row.get("reserve_b"),
    feeBps: row.get("fee_bps"),
    createdAt: row.get("created_at")?.toISOString?.(),
  }));
}

export async function getPool(
  cassandra: Cassandra,
  params: { network: string; vaultId: string; poolId: string }
) {
  const q =
    "SELECT network, vault_id, pool_id, owner, asset_a, asset_b, reserve_a, reserve_b, fee_bps, created_at FROM fractional.pools WHERE network=? AND vault_id=? AND pool_id=?";
  const r = await cassandra.execute(
    q,
    [params.network, params.vaultId, params.poolId],
    {
      prepare: true,
    }
  );
  const row = r.first();
  if (!row) return null;
  return {
    network: row.get("network"),
    vaultId: row.get("vault_id"),
    poolId: row.get("pool_id"),
    owner: row.get("owner"),
    assetA: row.get("asset_a"),
    assetB: row.get("asset_b"),
    reserveA: row.get("reserve_a"),
    reserveB: row.get("reserve_b"),
    feeBps: row.get("fee_bps"),
    createdAt: row.get("created_at")?.toISOString?.(),
  };
}

export async function listAllPools(
  cassandra: Cassandra,
  params: { network: string; limit: number }
) {
  const q =
    "SELECT network, vault_id, pool_id, owner, asset_a, asset_b, reserve_a, reserve_b, fee_bps, created_at FROM fractional.pools WHERE network=? LIMIT ? ALLOW FILTERING";
  const r = await cassandra.execute(q, [params.network, params.limit], {
    prepare: true,
  });
  return r.rows.map((row) => ({
    network: row.get("network"),
    vaultId: row.get("vault_id"),
    poolId: row.get("pool_id"),
    owner: row.get("owner"),
    assetA: row.get("asset_a"),
    assetB: row.get("asset_b"),
    reserveA: row.get("reserve_a"),
    reserveB: row.get("reserve_b"),
    feeBps: row.get("fee_bps"),
    createdAt: row.get("created_at")?.toISOString?.(),
  }));
}

export async function listPoolsByAsset(
  cassandra: Cassandra,
  params: { network: string; assetSymbol: string; limit: number }
) {
  const q =
    "SELECT network, asset_symbol, pool_id, vault_id, owner, other_asset, reserve_self, reserve_other, fee_bps, created_at FROM fractional.pools_by_asset WHERE network=? AND asset_symbol=? LIMIT ?";
  const r = await cassandra.execute(
    q,
    [params.network, params.assetSymbol, params.limit],
    { prepare: true }
  );
  return r.rows.map((row) => ({
    network: row.get("network"),
    assetSymbol: row.get("asset_symbol"),
    poolId: row.get("pool_id"),
    vaultId: row.get("vault_id"),
    owner: row.get("owner"),
    otherAsset: row.get("other_asset"),
    reserveSelf: row.get("reserve_self"),
    reserveOther: row.get("reserve_other"),
    feeBps: row.get("fee_bps"),
    createdAt: row.get("created_at")?.toISOString?.(),
  }));
}

export async function getPriceTvl(
  cassandra: Cassandra,
  params: { network: string; symbol: string; quoteSymbol?: string }
) {
  const q =
    "SELECT pool_id, vault_id, other_asset, reserve_self, reserve_other, fee_bps FROM fractional.pools_by_asset WHERE network=? AND asset_symbol=? LIMIT 25";
  const r = await cassandra.execute(q, [params.network, params.symbol], {
    prepare: true,
  });
  if (r.rows.length === 0) return null;
  let row = r.rows[0];
  if (params.quoteSymbol) {
    const match = r.rows.find(
      (rw) => String(rw.get("other_asset")) === params.quoteSymbol
    );
    if (match) row = match;
  }
  const other = String(row.get("other_asset"));
  const reserveSelfStr = String(row.get("reserve_self"));
  const reserveOtherStr = String(row.get("reserve_other"));
  const reserveSelf = Number.parseFloat(reserveSelfStr || "0");
  const reserveOther = Number.parseFloat(reserveOtherStr || "0");
  if (!(reserveSelf > 0) || !(reserveOther >= 0)) {
    return {
      symbol: params.symbol,
      quoteSymbol: params.quoteSymbol || other,
      price: null as string | null,
      tvl: null as string | null,
      poolId: row.get("pool_id"),
      vaultId: row.get("vault_id"),
      feeBps: row.get("fee_bps"),
    };
  }
  const priceNum = reserveOther / reserveSelf;
  const tvlNum = reserveSelf * priceNum + reserveOther;
  return {
    symbol: params.symbol,
    quoteSymbol: params.quoteSymbol || other,
    price: String(priceNum),
    tvl: String(tvlNum),
    poolId: row.get("pool_id"),
    vaultId: row.get("vault_id"),
    feeBps: row.get("fee_bps"),
  };
}
