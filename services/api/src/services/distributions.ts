import { Client as Cassandra } from "cassandra-driver";

export async function listDistributions(
  cassandra: Cassandra,
  params: { network: string; vaultId: string; limit: number }
) {
  const q =
    "SELECT network, vault_id, program_id, asset, total_amount, schedule, starts_at, ends_at, created_at FROM fractional.distributions WHERE network=? AND vault_id=? LIMIT ?";
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
    programId: row.get("program_id"),
    asset: row.get("asset"),
    totalAmount: row.get("total_amount"),
    schedule: row.get("schedule"),
    startsAt: row.get("starts_at")?.toISOString?.(),
    endsAt: row.get("ends_at")?.toISOString?.(),
    createdAt: row.get("created_at")?.toISOString?.(),
  }));
}

export async function listClaims(
  cassandra: Cassandra,
  params: { network: string; programId: string; limit: number }
) {
  const q =
    "SELECT network, program_id, account, amount, claimed_at FROM fractional.claims WHERE network=? AND program_id=? LIMIT ?";
  const r = await cassandra.execute(
    q,
    [params.network, params.programId, params.limit],
    {
      prepare: true,
    }
  );
  return r.rows.map((row) => ({
    network: row.get("network"),
    programId: row.get("program_id"),
    account: row.get("account"),
    amount: row.get("amount"),
    claimedAt: row.get("claimed_at")?.toISOString?.(),
  }));
}
