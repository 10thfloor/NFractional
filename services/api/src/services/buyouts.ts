import { Client as Cassandra } from "cassandra-driver";

export async function listBuyouts(
  cassandra: Cassandra,
  params: { network: string; vaultId: string; limit: number }
) {
  const q =
    "SELECT network, vault_id, proposal_id, proposer, asset, amount, quorum_percent, support_percent, expires_at, state, for_votes, against_votes, finalized_at FROM fractional.buyouts WHERE network=? AND vault_id=? LIMIT ?";
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
    proposalId: row.get("proposal_id"),
    proposer: row.get("proposer"),
    asset: row.get("asset"),
    amount: row.get("amount"),
    quorumPercent: row.get("quorum_percent"),
    supportPercent: row.get("support_percent"),
    expiresAt: row.get("expires_at")?.toISOString?.(),
    state: row.get("state"),
    forVotes: row.get("for_votes"),
    againstVotes: row.get("against_votes"),
    finalizedAt: row.get("finalized_at")?.toISOString?.(),
  }));
}
