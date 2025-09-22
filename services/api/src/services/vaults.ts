import type {
  Client as Cassandra,
  types as CassandraTypes,
} from "cassandra-driver";

export type Vault = {
  network: string;
  vaultId: string;
  collection: string;
  tokenId: string;
  shareSymbol: string;
  policy: string;
  creator: string;
  createdAt?: string;
  state: string;
  maxSupply?: string;
};

export async function getVault(
  cassandra: Cassandra,
  params: { network: string; vaultId: string }
): Promise<Vault | null> {
  const q =
    "SELECT network, vault_id, collection, token_id, share_symbol, policy, creator, created_at, state, metadata FROM fractional.vaults WHERE network=? AND vault_id=?";
  const r = await cassandra.execute(q, [params.network, params.vaultId], {
    prepare: true,
  });
  const row = r.first();
  if (!row) return null;
  const metadata = row.get("metadata") as
    | Map<string, CassandraTypes.Tuple>
    | undefined;
  const maxSupply = (metadata?.get?.("max_supply") || undefined) as
    | string
    | undefined;
  return {
    network: row.get("network"),
    vaultId: row.get("vault_id"),
    collection: row.get("collection"),
    tokenId: row.get("token_id"),
    shareSymbol: row.get("share_symbol"),
    policy: row.get("policy"),
    creator: row.get("creator"),
    createdAt: row.get("created_at")?.toISOString?.(),
    state: row.get("state"),
    maxSupply,
  };
}

export async function listVaults(
  cassandra: Cassandra,
  params: { network: string; limit: number }
): Promise<Vault[]> {
  const q =
    "SELECT network, vault_id, collection, token_id, share_symbol, policy, creator, created_at, state, metadata FROM fractional.vaults WHERE network=? LIMIT ? ALLOW FILTERING";
  const r = await cassandra.execute(q, [params.network, params.limit], {
    prepare: true,
  });
  return r.rows.map((row) => {
    const metadata = row.get("metadata") as
      | Map<string, CassandraTypes.Tuple>
      | undefined;
    const maxSupply = (metadata?.get?.("max_supply") || undefined) as
      | string
      | undefined;
    return {
      network: row.get("network"),
      vaultId: row.get("vault_id"),
      collection: row.get("collection"),
      tokenId: row.get("token_id"),
      shareSymbol: row.get("share_symbol"),
      policy: row.get("policy"),
      creator: row.get("creator"),
      createdAt: row.get("created_at")?.toISOString?.(),
      state: row.get("state"),
      maxSupply,
    };
  });
}

export async function listVaultsByCreator(
  cassandra: Cassandra,
  params: { network: string; creator: string; limit: number }
): Promise<Vault[]> {
  const q =
    "SELECT network, vault_id, collection, token_id, share_symbol, policy, creator, created_at, state, metadata FROM fractional.vaults WHERE network=? AND creator=? LIMIT ? ALLOW FILTERING";
  const r = await cassandra.execute(
    q,
    [params.network, params.creator, params.limit],
    { prepare: true }
  );
  return r.rows.map((row) => {
    return {
      network: row.get("network"),
      vaultId: row.get("vault_id"),
      collection: row.get("collection"),
      tokenId: row.get("token_id"),
      shareSymbol: row.get("share_symbol"),
      policy: row.get("policy"),
      creator: row.get("creator"),
      createdAt: row.get("created_at")?.toISOString?.(),
      state: row.get("state"),
      maxSupply: undefined,
    } as Vault;
  });
}

export async function getVaultBySymbol(
  cassandra: Cassandra,
  params: { network: string; symbol: string }
): Promise<Vault | null> {
  const metaQ =
    "SELECT vault_id FROM fractional.share_tokens WHERE network=? AND symbol=?";
  const metaR = await cassandra.execute(
    metaQ,
    [params.network, params.symbol],
    {
      prepare: true,
    }
  );
  const vid = metaR.first()?.get("vault_id") as string | undefined;
  if (!vid) return null;
  const q =
    "SELECT network, vault_id, collection, token_id, share_symbol, policy, creator, created_at, state FROM fractional.vaults WHERE network=? AND vault_id=?";
  const r = await cassandra.execute(q, [params.network, vid], {
    prepare: true,
  });
  const row = r.first();
  if (!row) return null;
  return {
    network: row.get("network"),
    vaultId: row.get("vault_id"),
    collection: row.get("collection"),
    tokenId: row.get("token_id"),
    shareSymbol: row.get("share_symbol"),
    policy: row.get("policy"),
    creator: row.get("creator"),
    createdAt: row.get("created_at")?.toISOString?.(),
    state: row.get("state"),
  };
}
