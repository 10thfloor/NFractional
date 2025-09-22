import { Client as Cassandra } from "cassandra-driver";

export async function listBalancesByAsset(
  cassandra: Cassandra,
  params: { network: string; assetSymbol: string; limit: number }
) {
  const q =
    "SELECT network, asset_symbol, account, amount, updated_at FROM fractional.balances WHERE network=? AND asset_symbol=? LIMIT ?";
  const r = await cassandra.execute(
    q,
    [params.network, params.assetSymbol, params.limit],
    {
      prepare: true,
    }
  );
  return r.rows.map((row) => ({
    network: row.get("network"),
    assetSymbol: row.get("asset_symbol"),
    account: row.get("account"),
    amount: row.get("amount"),
    updatedAt: row.get("updated_at")?.toISOString?.(),
  }));
}

export async function listHoldersByAsset(
  cassandra: Cassandra,
  params: { network: string; assetSymbol: string; limit: number }
) {
  // Uses same table as balances for now; could be optimized later
  const q =
    "SELECT network, asset_symbol, account, amount, updated_at FROM fractional.balances WHERE network=? AND asset_symbol=? LIMIT ?";
  const r = await cassandra.execute(
    q,
    [params.network, params.assetSymbol, params.limit],
    {
      prepare: true,
    }
  );
  return r.rows.map((row) => ({
    network: row.get("network"),
    assetSymbol: row.get("asset_symbol"),
    account: row.get("account"),
    amount: row.get("amount"),
    updatedAt: row.get("updated_at")?.toISOString?.(),
  }));
}

export async function listBalancesByAccount(
  cassandra: Cassandra,
  params: { network: string; account: string; limit: number }
) {
  const q =
    "SELECT network, account, asset_symbol, amount, updated_at FROM fractional.balances_by_account WHERE network=? AND account=? LIMIT ?";
  const r = await cassandra.execute(
    q,
    [params.network, params.account, params.limit],
    {
      prepare: true,
    }
  );
  return r.rows.map((row) => ({
    network: row.get("network"),
    assetSymbol: row.get("asset_symbol"),
    account: row.get("account"),
    amount: row.get("amount"),
    updatedAt: row.get("updated_at")?.toISOString?.(),
  }));
}
