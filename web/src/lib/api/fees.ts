import { gqlFetch, DEFAULT_NETWORK } from "@/lib/graphql";

export type FeeSchedule = {
  current: {
    feeBps: number;
    vaultSplitBps: number;
    protocolSplitBps: number;
  } | null;
  pending: {
    feeBps: number;
    vaultSplitBps: number;
    protocolSplitBps: number;
    effectiveAt: string;
  } | null;
};

export async function getFeeSchedule(vaultId: string): Promise<FeeSchedule> {
  const q = `
    query($network:String!, $vaultId:String!){
      feeSchedule(network:$network, vaultId:$vaultId){
        current{ feeBps vaultSplitBps protocolSplitBps }
        pending{ feeBps vaultSplitBps protocolSplitBps effectiveAt }
      }
    }
  `;
  const resp = await gqlFetch<{ feeSchedule: FeeSchedule }>(q, {
    network: DEFAULT_NETWORK,
    vaultId,
  });
  return resp.feeSchedule;
}

export type FeeEvent = {
  kind: string;
  token: string;
  amount: string;
  vaultShare: string;
  protocolShare: string;
  payer: string;
  txId: string;
  createdAt: string;
};

export async function getFeeEvents(
  vaultId: string,
  limit = 25
): Promise<FeeEvent[]> {
  const q = `
    query($network:String!, $vaultId:String!, $limit:Int!){
      fees(network:$network, vaultId:$vaultId, limit:$limit){
        kind token amount vaultShare protocolShare payer txId createdAt
      }
    }
  `;
  const resp = await gqlFetch<{ fees: FeeEvent[] }>(q, {
    network: DEFAULT_NETWORK,
    vaultId,
    limit,
  });
  return resp.fees || [];
}

export type AmmFeeParams = {
  feeBps: number;
  vaultSplitBps: number;
  protocolSplitBps: number;
} | null;

export async function getAmmFeeParams(vaultId: string): Promise<AmmFeeParams> {
  const q = `
    query($network:String!, $vaultId:String!){
      ammFeeParams(network:$network, vaultId:$vaultId){
        feeBps vaultSplitBps protocolSplitBps
      }
    }
  `;
  const res = await gqlFetch<{ ammFeeParams: AmmFeeParams }>(q, {
    network: DEFAULT_NETWORK,
    vaultId,
  });
  return res.ammFeeParams ?? null;
}
