import { files as cadenceFiles } from "@flow-hackathon/cadence";
import { waitForTransactionSealed } from "./utils";

export const publishCustodyCapTx =
  cadenceFiles["transactions/custody/user/PublishCustodyCap.cdc"];
export const depositTx = cadenceFiles["transactions/custody/user/deposit.cdc"];

export async function depositToCustody(
  fcl: any,
  input: {
    collectionStoragePath: string;
    tokenId: string; // UInt64
    vaultId: string;
    creatorAuth: (acct: unknown) => Promise<unknown> | unknown;
  }
): Promise<string> {
  const cadence = cadenceFiles["transactions/custody/user/deposit.cdc"];
  const txId = await fcl
    .mutate({
      cadence,
      args: (arg: any, t: any) => [
        arg(input.collectionStoragePath, t.String),
        arg(Number(input.tokenId), t.UInt64),
        arg(input.vaultId, t.String),
      ],
      proposer: input.creatorAuth as any,
      payer: input.creatorAuth as any,
      authorizations: [input.creatorAuth as any],
      limit: 9999,
    })
    .catch((e: unknown) => {
      throw new Error(
        `depositToCustody failed: ${String((e as Error).message || e)}`
      );
    });
  
  // Wait for transaction to be sealed via websocket
  await waitForTransactionSealed(fcl, txId as string);
  
  return txId as string;
}
