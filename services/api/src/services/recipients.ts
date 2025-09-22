import { Client as Cassandra } from "cassandra-driver";

export type DistributionRecipient = {
  account: string;
  amount: string;
  createdAt?: string;
};

export async function upsertRecipients(
  cassandra: Cassandra,
  params: {
    network: string;
    programId: string;
    recipients: DistributionRecipient[];
  }
): Promise<void> {
  const queries = params.recipients.map((recipient) => {
    const q =
      "INSERT INTO fractional.distribution_recipients (network, program_id, account, amount, created_at) VALUES (?, ?, ?, ?, ?)";
    return cassandra.execute(q, [
      params.network,
      params.programId,
      recipient.account,
      recipient.amount,
      recipient.createdAt ? new Date(recipient.createdAt) : new Date(),
    ], { prepare: true });
  });
  await Promise.all(queries);
}

export async function listRecipients(
  cassandra: Cassandra,
  params: { network: string; programId: string }
): Promise<DistributionRecipient[]> {
  const q =
    "SELECT account, amount, created_at FROM fractional.distribution_recipients WHERE network=? AND program_id=?";
  const r = await cassandra.execute(
    q,
    [params.network, params.programId],
    {
      prepare: true,
    }
  );
  return r.rows.map((row) => ({
    account: row.get("account"),
    amount: row.get("amount"),
    createdAt: row.get("created_at")?.toISOString?.(),
  }));
}

export async function getRecipient(
  cassandra: Cassandra,
  params: {
    network: string;
    programId: string;
    account: string;
  }
): Promise<DistributionRecipient | null> {
  const q =
    "SELECT account, amount, created_at FROM fractional.distribution_recipients WHERE network=? AND program_id=? AND account=?";
  const r = await cassandra.execute(
    q,
    [params.network, params.programId, params.account],
    {
      prepare: true,
    }
  );
  const row = r.first();
  if (!row) return null;
  return {
    account: row.get("account"),
    amount: row.get("amount"),
    createdAt: row.get("created_at")?.toISOString?.(),
  };
}

