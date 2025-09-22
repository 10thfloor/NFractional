import { imp, type CadenceAddrsStd } from "@/lib/flow";

export type PoolInfo = {
  vaultId: string;
  poolId: string;
  symbol: string;
  feeBps: number;
  reserves: { share: string; flow: string };
  shareTypeId: string;
};

export function poolInfoScript(addrs: CadenceAddrsStd): string {
  const lines = [
    imp("FungibleToken", addrs.ft as string),
    imp("FlowToken", addrs.flow as string),
    imp("ConstantProductAMM", addrs.amm as string),
  ].join("\n");
  return `
${lines}

access(all) view fun main(owner: Address, poolId: String): {String: String}? {
  let publicPath: PublicPath = ConstantProductAMM.getPoolPublicPath(poolId: poolId)
  let cap: Capability<&ConstantProductAMM.Pool> = getAccount(owner).capabilities.get<&ConstantProductAMM.Pool>(publicPath)
  if !cap.check() { return nil }
  let p = cap.borrow() ?? panic("invalid pool cap")
  let out: {String: String} = {}
  out["vaultId"] = p.vaultId
  out["poolId"] = p.poolId
  out["symbol"] = p.symbol
  out["feeBps"] = p.feeBps.toString()
  let r = p.reserves()
  out["share"] = (r["share"] ?? 0.0).toString()
  out["flow"] = (r["flow"] ?? 0.0).toString()
  out["shareTypeId"] = p.getShareVaultType().identifier
  return out
}
`;
}

import { gqlFetch, DEFAULT_NETWORK } from "@/lib/graphql";

export type Pool = {
  network: string;
  vaultId: string;
  poolId: string;
  owner?: string | null;
  assetA?: string | null;
  assetB?: string | null;
  reserveA?: string | null;
  reserveB?: string | null;
  feeBps?: number | null;
  createdAt?: string | null;
};

export async function getPoolsByVault(
  vaultId: string,
  limit = 25
): Promise<Pool[]> {
  const query = `
    query Pools($network: String!, $vaultId: String!, $limit: Int!) {
      pools(network: $network, vaultId: $vaultId, limit: $limit) {
        network
        vaultId
        poolId
        owner
        assetA
        assetB
        reserveA
        reserveB
        feeBps
        createdAt
      }
    }
  `;
  const res = await gqlFetch<{ pools: Pool[] }>(query, {
    network: DEFAULT_NETWORK,
    vaultId,
    limit,
  });
  return res.pools || [];
}

export type PriceTVL = {
  symbol: string;
  quoteSymbol: string;
  price: string | null;
  tvl: string | null;
  poolId?: string | null;
  vaultId?: string | null;
  feeBps?: number | null;
};

export async function getPriceTvl(
  symbol: string,
  quoteSymbol?: string
): Promise<PriceTVL | null> {
  const query = `
    query PriceTVL($network: String!, $symbol: String!, $quoteSymbol: String) {
      priceTvl(network: $network, symbol: $symbol, quoteSymbol: $quoteSymbol) {
        symbol
        quoteSymbol
        price
        tvl
        poolId
        vaultId
        feeBps
      }
    }
  `;
  const res = await gqlFetch<{ priceTvl: PriceTVL | null }>(query, {
    network: DEFAULT_NETWORK,
    symbol,
    quoteSymbol,
  });
  return res.priceTvl ?? null;
}

export async function getAmmQuote(params: {
  poolOwner: string;
  poolId: string;
  direction: "share_to_flow" | "flow_to_share";
  amountIn: string;
}): Promise<{ in: string; out: string }> {
  const query = `
    query AmmQuote($network: String!, $poolOwner: String!, $poolId: String!, $direction: String!, $amountIn: String!) {
      ammQuote(network: $network, poolOwner: $poolOwner, poolId: $poolId, direction: $direction, amountIn: $amountIn) {
        in
        out
      }
    }
  `;
  const res = await gqlFetch<{ ammQuote: { in: string; out: string } }>(query, {
    network: DEFAULT_NETWORK,
    ...params,
  });
  return res.ammQuote;
}

export async function getAmmQuoteWithFees(params: {
  poolOwner: string;
  poolId: string;
  direction: "share_to_flow" | "flow_to_share";
  amountIn: string;
  vaultId: string;
}): Promise<{
  in: string;
  out: string;
  feeAmount: string;
  feeBps: number;
  vaultShare: string;
  protocolShare: string;
}> {
  const query = `
    query AmmQuoteWithFees($network:String!,$poolOwner:String!,$poolId:String!,$direction:String!,$amountIn:String!,$vaultId:String!){
      ammQuoteWithFees(network:$network, poolOwner:$poolOwner, poolId:$poolId, direction:$direction, amountIn:$amountIn, vaultId:$vaultId){
        in out feeAmount feeBps vaultShare protocolShare
      }
    }
  `;
  const res = await gqlFetch<{
    ammQuoteWithFees: {
      in: string;
      out: string;
      feeAmount: string;
      feeBps: number;
      vaultShare: string;
      protocolShare: string;
    };
  }>(query, { network: DEFAULT_NETWORK, ...params });
  return res.ammQuoteWithFees;
}

export type AllPoolsItem = {
  network: string;
  vaultId: string;
  poolId: string;
  owner?: string | null;
  assetA?: string | null;
  assetB?: string | null;
  reserveA?: string | null;
  reserveB?: string | null;
  feeBps?: number | null;
  createdAt?: string | null;
};

export async function listAllPools(params: {
  limit?: number;
  offset?: number;
  filterActive?: boolean;
  filterByAsset?: string;
  sortBy?: string;
}): Promise<AllPoolsItem[]> {
  const query = `
    query AllPools($network: String!, $limit: Int, $offset: Int, $filterActive: Boolean, $filterByAsset: String, $sortBy: String) {
      allPools(network: $network, limit: $limit, offset: $offset, filterActive: $filterActive, filterByAsset: $filterByAsset, sortBy: $sortBy) {
        network
        vaultId
        poolId
        owner
        assetA
        assetB
        reserveA
        reserveB
        feeBps
        createdAt
      }
    }
  `;
  const res = await gqlFetch<{ allPools: AllPoolsItem[] }>(query, {
    network: DEFAULT_NETWORK,
    ...params,
  });
  return res.allPools || [];
}

export type PoolEvent = {
  network: string;
  vaultId: string;
  blockHeight: string;
  txIndex: number;
  evIndex: number;
  txId: string;
  type: string;
  payload?: string | null;
  ts?: string | null;
};

export async function getPoolEvents(
  vaultId: string,
  limit = 50
): Promise<PoolEvent[]> {
  const query = `
    query PoolEvents($network: String!, $vaultId: String!, $limit: Int!) {
      events(network: $network, vaultId: $vaultId, limit: $limit) {
        network
        vaultId
        blockHeight
        txIndex
        evIndex
        txId
        type
        payload
        ts
      }
    }
  `;
  const res = await gqlFetch<{ events: PoolEvent[] }>(query, {
    network: DEFAULT_NETWORK,
    vaultId,
    limit,
  });
  return res.events || [];
}

export async function ensureVaultTreasury(
  vaultId: string
): Promise<{ txId: string }> {
  const res = await fetch("/api/admin/ensure-vault-treasury", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ vaultId }),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(error.error || `HTTP error ${res.status}`);
  }

  const data = await res.json();
  return { txId: data.txId };
}
