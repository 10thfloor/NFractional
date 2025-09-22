import { gqlFetch, DEFAULT_NETWORK } from "@/lib/graphql";

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
