import { gqlFetch, DEFAULT_NETWORK } from "@/lib/graphql";

export type Vault = {
  network: string;
  vaultId: string;
  collection: string | null;
  tokenId: string | null;
  shareSymbol: string | null;
  policy: string | null;
  creator: string | null;
  state: string | null;
  maxSupply: string | null;
};

export async function getVault(vaultId: string): Promise<Vault | null> {
  const query = `
    query Vault($network: String!, $vaultId: String!) {
      vault(network: $network, vaultId: $vaultId) {
        network
        vaultId
        collection
        tokenId
        shareSymbol
        policy
        creator
        state
        maxSupply
      }
    }
  `;
  const res = await gqlFetch<{ vault: Vault | null }>(query, {
    network: DEFAULT_NETWORK,
    vaultId,
  });
  return res.vault;
}

export type NFTDisplay = {
  name?: string | null;
  description?: string | null;
  thumbnail?: string | null;
};

export async function getVaultNftDisplay(
  vaultId: string
): Promise<NFTDisplay | null> {
  const query = `
    query ($network: String!, $vaultId: String!) {
      vaultNftDisplay(network: $network, vaultId: $vaultId) {
        name
        description
        thumbnail
      }
    }
  `;
  try {
    const res = await gqlFetch<{ vaultNftDisplay: NFTDisplay | null }>(query, {
      network: DEFAULT_NETWORK,
      vaultId,
    });

    return res.vaultNftDisplay ?? null;
  } catch (e) {
    return e as NFTDisplay;
  }
}

export async function getPlatformAdmin(): Promise<string | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
  try {
    const res = await fetch(`${apiBase}/flow/addresses`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { platformAdmin?: string };
    return data.platformAdmin ?? null;
  } catch {
    return null;
  }
}

export async function getEscrowBalance(
  vaultId: string,
  account: string
): Promise<string | null> {
  const query = `
    query ShareBalance($network: String!, $vaultId: String!, $account: String!) {
      shareBalance(network: $network, vaultId: $vaultId, account: $account) {
        balance
      }
    }
  `;
  try {
    const res = await gqlFetch<{ shareBalance: { balance: string } }>(query, {
      network: DEFAULT_NETWORK,
      vaultId,
      account,
    });
    return res.shareBalance.balance;
  } catch {
    return null;
  }
}

export async function getVaultMaxSupply(
  vaultId: string
): Promise<string | null> {
  const query = `
    query VaultMaxSupply($network: String!, $vaultId: String!) {
      vaultMaxSupply(network: $network, vaultId: $vaultId)
    }
  `;
  try {
    const res = await gqlFetch<{ vaultMaxSupply: string | null }>(query, {
      network: DEFAULT_NETWORK,
      vaultId,
    });
    return res.vaultMaxSupply;
  } catch {
    return null;
  }
}

export async function getVaultTotalSupply(
  vaultId: string
): Promise<string | null> {
  const query = `
    query VaultTotalSupply($network: String!, $vaultId: String!) {
      vaultTotalSupply(network: $network, vaultId: $vaultId)
    }
  `;
  try {
    const res = await gqlFetch<{ vaultTotalSupply: string | null }>(query, {
      network: DEFAULT_NETWORK,
      vaultId,
    });
    return res.vaultTotalSupply;
  } catch {
    return null;
  }
}

export async function getVaultLockedSeedShares(
  vaultId: string
): Promise<string> {
  const query = `
    query LockedSeed($network: String!, $vaultId: String!) {
      vaultLockedSeedShares(network: $network, vaultId: $vaultId)
    }
  `;
  const res = await gqlFetch<{ vaultLockedSeedShares: string }>(query, {
    network: DEFAULT_NETWORK,
    vaultId,
  });
  return res.vaultLockedSeedShares ?? "0";
}

export async function getVaultTeamShareBalances(
  vaultId: string
): Promise<string> {
  const query = `
    query TeamShares($network: String!, $vaultId: String!) {
      vaultTeamShareBalances(network: $network, vaultId: $vaultId)
    }
  `;
  const res = await gqlFetch<{ vaultTeamShareBalances: string }>(query, {
    network: DEFAULT_NETWORK,
    vaultId,
  });
  return res.vaultTeamShareBalances ?? "0";
}

export async function getVaultTeamLPShareEquivalent(
  vaultId: string
): Promise<string> {
  const query = `
    query TeamLPEq($network: String!, $vaultId: String!) {
      vaultTeamLPShareEquivalent(network: $network, vaultId: $vaultId)
    }
  `;
  const res = await gqlFetch<{ vaultTeamLPShareEquivalent: string }>(query, {
    network: DEFAULT_NETWORK,
    vaultId,
  });
  return res.vaultTeamLPShareEquivalent ?? "0";
}

export async function getVaultCirculating(vaultId: string): Promise<string> {
  const query = `
    query VaultCirculating($network: String!, $vaultId: String!) {
      vaultCirculating(network: $network, vaultId: $vaultId)
    }
  `;
  const res = await gqlFetch<{ vaultCirculating: string }>(query, {
    network: DEFAULT_NETWORK,
    vaultId,
  });
  return res.vaultCirculating ?? "0";
}

// TODO: These functions require backend GraphQL schema support
// export async function getVaultTreasuryFlowBalance(
//   vaultId: string
// ): Promise<string | null> {
//   const query = `
//     query VaultTreasuryFlowBalance($network: String!, $vaultId: String!) {
//       vaultTreasuryFlowBalance(network: $network, vaultId: $vaultId)
//     }
//   `;
//   try {
//     const res = await gqlFetch<{ vaultTreasuryFlowBalance: string | null }>(
//       query,
//       {
//         network: DEFAULT_NETWORK,
//         vaultId,
//       }
//     );
//     return res.vaultTreasuryFlowBalance;
//   } catch {
//     return null;
//   }
// }

// export async function getVaultTreasuryShareBalance(
//   vaultId: string
// ): Promise<string | null> {
//   const query = `
//     query VaultTreasuryShareBalance($network: String!, $vaultId: String!) {
//       vaultTreasuryShareBalance(network: $network, vaultId: $vaultId)
//     }
//   `;
//   try {
//     const res = await gqlFetch<{ vaultTreasuryShareBalance: string | null }>(
//       query,
//       {
//         network: DEFAULT_NETWORK,
//         vaultId,
//       }
//     );
//     return res.vaultTreasuryShareBalance;
//   } catch {
//     return null;
//   }
// }

export async function registerVaultFromNFT(input: {
  vaultId: string;
  collectionStoragePath: string;
  collectionPublicPath: string;
  tokenId: string;
  shareSymbol: string;
  policy: string;
  creator: string;
}): Promise<string> {
  const mutation = `
    mutation RegisterVaultFromNFT(
      $network: String!,
      $vaultId: String!,
      $collectionStoragePath: String!,
      $collectionPublicPath: String!,
      $tokenId: String!,
      $shareSymbol: String!,
      $policy: String!,
      $creator: String!
    ) {
      registerVaultFromNFT(
        network: $network,
        vaultId: $vaultId,
        collectionStoragePath: $collectionStoragePath,
        collectionPublicPath: $collectionPublicPath,
        tokenId: $tokenId,
        shareSymbol: $shareSymbol,
        policy: $policy,
        creator: $creator
      ) { txId }
    }
  `;
  const res = await gqlFetch<{ registerVaultFromNFT: { txId: string } }>(
    mutation,
    {
      network: DEFAULT_NETWORK,
      vaultId: input.vaultId,
      collectionStoragePath: input.collectionStoragePath,
      collectionPublicPath: input.collectionPublicPath,
      tokenId: input.tokenId,
      shareSymbol: input.shareSymbol,
      policy: input.policy,
      creator: input.creator,
    }
  );
  return res.registerVaultFromNFT.txId;
}
