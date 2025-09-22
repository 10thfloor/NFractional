import { Client as Cassandra } from "cassandra-driver";

export async function listFees(
  cassandra: Cassandra,
  params: { network: string; vaultId: string; limit: number }
) {
  const q =
    'SELECT network, vault_id, kind, "token", amount, vault_share, protocol_share, payer, tx_id, created_at FROM fractional.fees WHERE network=? AND vault_id=? LIMIT ?';
  const r = await cassandra.execute(
    q,
    [params.network, params.vaultId, params.limit],
    { prepare: true }
  );
  return r.rows.map((row) => ({
    network: row.get("network"),
    vaultId: row.get("vault_id"),
    kind: row.get("kind"),
    token: row.get("token"),
    amount: row.get("amount"),
    vaultShare: row.get("vault_share"),
    protocolShare: row.get("protocol_share"),
    payer: row.get("payer"),
    txId: row.get("tx_id"),
    createdAt: row.get("created_at")?.toISOString?.(),
  }));
}
