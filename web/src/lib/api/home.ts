import { gqlFetch, DEFAULT_NETWORK } from "@/lib/graphql";

export type Vault = {
  network: string;
  vaultId: string;
  collection: string | null;
  tokenId: string | null;
  shareSymbol: string | null;
  state: string | null;
};

export async function getVaults(limit = 50): Promise<Vault[]> {
  const query = `
    query Vaults($network: String!, $limit: Int) {
      vaults(network: $network, limit: $limit) { network vaultId collection tokenId shareSymbol state }
    }
  `;
  const { vaults } = await gqlFetch<{ vaults: Vault[] }>(query, {
    network: DEFAULT_NETWORK,
    limit,
  });
  return vaults || [];
}

export async function getFeeSchedule(vaultId: string): Promise<{
  feeBps?: number;
  vaultSplitBps?: number;
  protocolSplitBps?: number;
} | null> {
  const query = `
    query FeeSchedule($network: String!, $vaultId: String!) {
      feeSchedule(network: $network, vaultId: $vaultId) {
        current { feeBps vaultSplitBps protocolSplitBps }
      }
    }
  `;
  const { feeSchedule } = await gqlFetch<{
    feeSchedule: {
      current: {
        feeBps: number;
        vaultSplitBps: number;
        protocolSplitBps: number;
      } | null;
    };
  }>(query, { network: DEFAULT_NETWORK, vaultId });
  return feeSchedule?.current ?? null;
}

export async function getVaultEscrowBalance(vaultId: string): Promise<string> {
  const query = `
    query VaultEscrowBalance($network: String!, $vaultId: String!) {
      vaultEscrowBalance(network: $network, vaultId: $vaultId)
    }
  `;
  const r = await gqlFetch<{ vaultEscrowBalance: string }>(query, {
    network: DEFAULT_NETWORK,
    vaultId,
  });
  return r.vaultEscrowBalance ?? "0";
}

type PriceTvl = {
  symbol: string;
  quoteSymbol: string | null;
  price: string | null;
  tvl: string | null;
  poolId: string | null;
  vaultId: string | null;
  feeBps: number | null;
};

export async function getPriceTvl(
  symbol: string,
  quoteSymbol?: string
): Promise<PriceTvl | null> {
  const query = `
    query PriceTVL($network: String!, $symbol: String!, $quote: String) {
      priceTvl(network: $network, symbol: $symbol, quoteSymbol: $quote) {
        symbol quoteSymbol price tvl poolId vaultId feeBps
      }
    }
  `;
  const r = await gqlFetch<{ priceTvl: PriceTvl | null }>(query, {
    network: DEFAULT_NETWORK,
    symbol,
    quote: quoteSymbol ?? null,
  });
  return r.priceTvl ?? null;
}

export async function getVaultTreasuryBalance(
  vaultId: string
): Promise<string> {
  const query = `
    query($network:String!, $vaultId:String!) { vaultTreasuryBalance(network:$network, vaultId:$vaultId) }
  `;
  try {
    const r = await gqlFetch<{ vaultTreasuryBalance: string }>(query, {
      network: DEFAULT_NETWORK,
      vaultId,
    });
    return r.vaultTreasuryBalance ?? "0";
  } catch {
    return "0";
  }
}

export async function getVaultTreasuryShareBalance(
  vaultId: string
): Promise<string> {
  const query = `
    query($network:String!, $vaultId:String!) { vaultTreasuryShareBalance(network:$network, vaultId:$vaultId) }
  `;
  try {
    const r = await gqlFetch<{ vaultTreasuryShareBalance: string }>(query, {
      network: DEFAULT_NETWORK,
      vaultId,
    });
    return r.vaultTreasuryShareBalance ?? "0";
  } catch {
    return "0";
  }
}

type FeeTotals = {
  amountTotal: string;
  vaultTotal: string;
  protocolTotal: string;
  updatedAt: string;
};

export async function getFeeTotals(token = "FLOW"): Promise<FeeTotals | null> {
  const query = `
    query FeeTotals($network: String!, $token: String!) {
      feeTotals(network: $network, token: $token) {
        amountTotal vaultTotal protocolTotal updatedAt
      }
    }
  `;
  const r = await gqlFetch<{ feeTotals: FeeTotals | null }>(query, {
    network: DEFAULT_NETWORK,
    token,
  });
  return r.feeTotals ?? null;
}

export async function getPoolsByAssetCount(
  assetSymbol: string
): Promise<number> {
  const query = `
    query PoolsByAsset($network: String!, $assetSymbol: String!, $limit: Int!) {
      poolsByAsset(network: $network, assetSymbol: $assetSymbol, limit: $limit) { poolId }
    }
  `;
  const r = await gqlFetch<{ poolsByAsset: Array<{ poolId: string }> }>(query, {
    network: DEFAULT_NETWORK,
    assetSymbol,
    limit: 100,
  });
  return (r.poolsByAsset || []).length;
}
