import { Client as Cassandra } from "cassandra-driver";

export async function getShareToken(
  cassandra: Cassandra,
  params: { network: string; symbol: string }
) {
  const q =
    "SELECT network, symbol, vault_id, decimals, total_supply, mode, treasury, created_at FROM fractional.share_tokens WHERE network=? AND symbol=?";
  const r = await cassandra.execute(q, [params.network, params.symbol], {
    prepare: true,
  });
  const row = r.first();
  if (!row) return null;
  return {
    network: row.get("network"),
    symbol: row.get("symbol"),
    vaultId: row.get("vault_id"),
    decimals: row.get("decimals"),
    totalSupply: row.get("total_supply"),
    mode: row.get("mode"),
    treasury: row.get("treasury"),
    createdAt: row.get("created_at")?.toISOString?.(),
  };
}
