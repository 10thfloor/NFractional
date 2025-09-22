import { Client as Cassandra } from "cassandra-driver";

export async function listEvents(
  cassandra: Cassandra,
  params: { network: string; vaultId: string; limit: number }
) {
  const q =
    "SELECT network, vault_id, block_height, tx_index, ev_index, tx_id, type, payload, ts FROM fractional.events WHERE network=? AND vault_id=? LIMIT ?";
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
    blockHeight: String(row.get("block_height")),
    txIndex: row.get("tx_index"),
    evIndex: row.get("ev_index"),
    txId: row.get("tx_id"),
    type: row.get("type"),
    payload: row.get("payload"),
    ts: row.get("ts")?.toISOString?.(),
  }));
}
